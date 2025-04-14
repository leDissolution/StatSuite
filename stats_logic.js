// stats_logic.js - Core logic for stats definition, generation, and processing

// Imports from other modules
import { extensionSettings } from './settings.js';
import { generateStat } from './api.js';
import { displayStats } from './ui.js';
import { CharacterRegistry } from './characters.js'

import { chat, saveChatConditional } from '../../../../script.js';

// Moved from prompts.js
export const Stats = Object.freeze({
    POSE: 'pose',
    LOCATION: 'location',
    OUTFIT: 'outfit',
    EXPOSURE: 'exposure',
    ACCESSORIES: 'accessories',
});

export const supportedStats = [Stats.POSE, Stats.LOCATION, Stats.OUTFIT, Stats.EXPOSURE, Stats.ACCESSORIES];

export const StatConfig = {
    [Stats.POSE]: {
        dependencies: [],
        order: 0,
        defaultValue: "unspecified"
    },
    [Stats.LOCATION]: {
        dependencies: [Stats.POSE],
        order: 1,
        defaultValue: "unspecified"
    },
    [Stats.OUTFIT]: {
        dependencies: [],
        order: 2,
        defaultValue: "unspecified"
    },
    [Stats.EXPOSURE]: {
        dependencies: [Stats.OUTFIT],
        order: 4,
        defaultValue: "none"
    },
    [Stats.ACCESSORIES]: {
        dependencies: [Stats.OUTFIT],
        order: 3,
        defaultValue: "unspecified"
    }
};

// Initialize with CharacterRegistry instance
let _characterRegistryInstance = null;
export function initializeStatsLogic() {
    _characterRegistryInstance = new CharacterRegistry();
    return _characterRegistryInstance;
}

/**
 * Parses a stats string (e.g., `<stats character="Alice" pose="standing" />`)
 * @param {string} statsString
 * @returns {object | null} Parsed stats object or null if invalid.
 */
export function parseStatsString(statsString) {
    const result = {};
    const charMatch = statsString.match(/character="([^"]+)"/);
    if (!charMatch) return null; // Must have a character attribute
    const charName = charMatch[1];
    result[charName] = {};

    const matches = statsString.matchAll(/(\w+)="([^"]+)"/g);
    for (const match of matches) {
        const [_, key, value] = match;
        if (key !== 'character') { // Exclude the character attribute itself
            if (Object.values(Stats).includes(key.toLowerCase())) {
                 result[charName][key.toLowerCase()] = value;
            } else {
                console.warn(`StatSuite: Ignoring unsupported stat key "${key}" during parsing.`);
            }
        }
    }
    // If no valid stats were found besides character, return null or handle as needed
    if (Object.keys(result[charName]).length === 0) {
         console.warn(`StatSuite: No supported stats found for character "${charName}" in string: ${statsString}`);
         return null; // Let's return null if no actual stats are parsed
    }
    return result;
}


/**
 * Gets the relevant previous and current message details for stat generation.
 * @param {number | null} specificMessageIndex Index of the *new* message, or null for the latest.
 * @returns {object | null} Object with message details or null if not applicable.
 */
export function getRecentMessages(specificMessageIndex = null) {
    if (!_characterRegistryInstance) {
        console.error("StatSuite Error: CharacterRegistry not initialized in stats_logic.");
        return null;
    }
    if (!chat || chat.length === 0) return null; // No chat messages

    let currentMessage;
    let previousMessage;
    let currentIndex;
    let previousIndex;

    if (specificMessageIndex !== null) {
        // Handle specific index
        if (specificMessageIndex < 0 || specificMessageIndex >= chat.length) {
            console.warn(`StatSuite: getRecentMessages called with invalid index ${specificMessageIndex}`);
            return null;
        }
        currentIndex = specificMessageIndex;
        currentMessage = chat[currentIndex];

        if (currentMessage.is_system) return null; // Don't process system messages

        if (currentIndex === 0) {
            // First non-system message case
            previousMessage = null;
            previousIndex = -1;
        } else {
            previousIndex = -1;
            for (let i = currentIndex - 1; i >= 0; i--) {
                if (!chat[i].is_system) {
                    previousMessage = chat[i];
                    previousIndex = i;
                    break;
                }
            }
            if (!previousMessage) { // No previous non-system message found
                 previousMessage = null;
                 previousIndex = -1;
            }
        }
    } else {
        currentIndex = -1;
        previousIndex = -1;
        for (let i = chat.length - 1; i >= 0; i--) {
            if (!chat[i].is_system) {
                if (currentIndex === -1) {
                    currentIndex = i;
                    currentMessage = chat[i];
                } else {
                    previousIndex = i;
                    previousMessage = chat[i];
                    break; // Found both current and previous
                }
            }
        }
        if (!currentMessage) return null; // No non-system messages found
        if (!previousMessage) previousIndex = -1; // Only one non-system message exists
    }

    // Register authors if auto-tracking is enabled
    if (extensionSettings.autoTrackMessageAuthors) {
        if (previousMessage) _characterRegistryInstance.addCharacter(previousMessage.name);
        _characterRegistryInstance.addCharacter(currentMessage.name);
    }

    // Prepare previous stats, ensuring all tracked characters and stats have default values
    const finalPreviousStats = {};
    const sourcePreviousStats = previousMessage ? previousMessage.stats || {} : {};

    _characterRegistryInstance.getTrackedCharacters().forEach(char => {
        finalPreviousStats[char] = {};
        const charSourceStats = sourcePreviousStats[char] || {};
        supportedStats.forEach(stat => {
            finalPreviousStats[char][stat] = charSourceStats[stat] || StatConfig[stat].defaultValue;
        });
    });

    return {
        previousName: previousMessage ? previousMessage.name : null,
        previousMessage: previousMessage ? previousMessage.mes : "",
        previousStats: finalPreviousStats, // Use the processed stats with defaults
        previousIndex: previousIndex,
        newName: currentMessage.name,
        newMessage: currentMessage.mes,
        newStats: currentMessage.stats, // Pass the raw stats from the current message
        newIndex: currentIndex
    };
}


/**
 * Calculates required stats including dependencies.
 * @param {string} targetStat The stat for which dependencies are needed.
 * @returns {string[]} Array of required stats, sorted by order.
 */
export function getRequiredStats(targetStat) {
    const required = new Set();
    function addDependencies(stat) {
        // Check if StatConfig and the specific stat entry exist
        if (!StatConfig || !StatConfig[stat] || !StatConfig[stat].dependencies) {
            console.error(`StatSuite Error: Invalid stat or missing dependencies in StatConfig for "${stat}"`);
            return; // Stop recursion if config is invalid
        }
        StatConfig[stat].dependencies.forEach(dep => {
            if (!required.has(dep)) { // Prevent infinite loops for circular dependencies (though StatConfig shouldn't have them)
                 addDependencies(dep);
                 required.add(dep);
            }
        });
        required.add(stat); // Add the stat itself
    }

    if (StatConfig && StatConfig[targetStat]) {
        addDependencies(targetStat);
    } else {
         console.error(`StatSuite Error: Target stat "${targetStat}" not found in StatConfig.`);
    }

    // Sort based on the order defined in StatConfig
    return Array.from(required).sort((a, b) => {
        const orderA = StatConfig[a] ? StatConfig[a].order : Infinity;
        const orderB = StatConfig[b] ? StatConfig[b].order : Infinity;
        return orderA - orderB;
    });
}

/**
 * Applies the generated/updated stats to the message object and triggers UI update and save.
 * @param {object} stats The complete stats object for the message.
 * @param {number} messageIndex The index of the message in the chat array.
 */
export function setMessageStats(stats, messageIndex) {
    if (messageIndex < 0 || messageIndex >= chat.length) {
        console.error(`StatSuite Error: Invalid messageIndex ${messageIndex} in setMessageStats.`);
        return;
    }
    const message = chat[messageIndex];
    if (!message || message.is_system) {
        console.error(`StatSuite Error: Attempted to set stats on invalid or system message at index ${messageIndex}.`);
        return;
    }

    // Simple deep comparison to check if stats actually changed
    const statsChanged = JSON.stringify(message.stats) !== JSON.stringify(stats);

    message.stats = stats;

    if (typeof displayStats === 'function') {
        displayStats(messageIndex, stats);
    } else {
        console.warn("StatSuite Warning: displayStats function not available in stats_logic.");
    }

    if (statsChanged) {
        saveChatConditional(); // Assumes global availability
    }
}


/**
 * Orchestrates the generation of stats for a specific message.
 * @param {number | null} specificMessageIndex Index of the message, or null for latest.
 * @param {string | null} specificChar Character name, or null for all tracked.
 * @param {string | null} specificStat Stat name, or null for all supported.
 * @param {boolean} greedy Use greedy sampling for API call.
 */
export async function makeStats(specificMessageIndex = null, specificChar = null, specificStat = null, greedy = true) {
    if (!_characterRegistryInstance) {
        console.error("StatSuite Error: CharacterRegistry not initialized in stats_logic.");
        return;
    }
    if (extensionSettings.disableAutoRequestStats && specificMessageIndex === null && specificChar === null && specificStat === null) {
        console.log("StatSuite: Automatic stat generation is disabled.");
        return;
    }

    const messages = getRecentMessages(specificMessageIndex);
    if (!messages) {
        return;
    }

    // Don't generate if the message content is empty
    if (!messages.newMessage || messages.newMessage.trim() === "") {
        console.log("StatSuite: Skipping stat generation for empty message.");
        return;
    }

    const charsToProcess = specificChar ? [specificChar] : _characterRegistryInstance.getTrackedCharacters();
    if (charsToProcess.length === 0) {
        console.log("StatSuite: No characters are being tracked.");
        return;
    }

    // Start with existing stats from the message, or an empty object
    const resultingStats = messages.newStats ? JSON.parse(JSON.stringify(messages.newStats)) : {};

    // Ensure structure exists for all characters being processed
    charsToProcess.forEach(char => {
        if (!resultingStats[char]) {
            resultingStats[char] = {};
        }
        supportedStats.forEach(statKey => {
            if (!resultingStats[char].hasOwnProperty(statKey)) {
                resultingStats[char][statKey] = StatConfig[statKey].defaultValue;
            }
        });
    });


    let statsActuallyGenerated = false; // Flag to check if any API call was made

    for (const char of charsToProcess) {
        // Determine which stats need generation for this character
        const statsToGenerateForChar = specificStat
            ? getRequiredStats(specificStat) // Get specific stat + dependencies
            : supportedStats; // Get all supported stats (already sorted by StatConfig definition)

        // Sort stats based on StatConfig order to handle dependencies correctly
        const sortedStatsToGenerate = statsToGenerateForChar.sort((a, b) => StatConfig[a].order - StatConfig[b].order);

        console.log(`StatSuite: Processing stats for character "${char}"`, sortedStatsToGenerate);

        for (const stat of sortedStatsToGenerate) {
            // Check if the stat is relevant (either specifically requested or part of the full set)
            if (specificStat === null || statsToGenerateForChar.includes(stat)) {
                const generatedValue = await generateStat(
                    stat,
                    char,
                    messages,
                    resultingStats[char],
                    greedy
                );
                statsActuallyGenerated = true;

                if (typeof generatedValue === 'string' && !generatedValue.startsWith('error')) {
                    resultingStats[char][stat] = generatedValue;
                } else {
                    console.warn(`StatSuite: Failed to generate stat "${stat}" for "${char}". Error: ${generatedValue}. Keeping previous value: "${resultingStats[char][stat]}"`);
                }
            }
        }
    }

    // Only update if stats were actually generated or potentially modified
    if (statsActuallyGenerated) {
         setMessageStats(resultingStats, messages.newIndex);
    } else {
        console.log("StatSuite: No stats were generated in this run.");
    }
}