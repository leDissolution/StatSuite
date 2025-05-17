// StatSuite - Core logic for stats definition, generation, and processing
import { chat, saveChatConditional, extension_prompt_types } from '../../../../../script.js';

import { ExtensionSettings } from '../settings.js';
import { generateStat } from '../api.js';
import { displayStats } from '../ui/stats-table.js';
import { Characters } from '../characters/characters_registry.js';
import { statsToStringFull } from '../export.js';
import { Stats } from './stats_registry.js';
import { StatsBlock } from './stat_block.js';

/**
 * Adds a custom stat to StatSuite at runtime.
 * @param {string} statKey - The unique key for the stat (lowercase, no spaces).
 * @param {object} config - The config object: { dependencies: [], order: number, defaultValue: any }
 * @returns {boolean} True if added, false if already exists or invalid.
 */
export function addCustomStat(statKey, config) {
    return Stats.addStat(statKey, config);
}

/**
 * Parses a stats string (e.g., `<stats character="Alice" pose="standing" />`)
 * @param {string} statsString
 * @returns {object | null} Parsed stats object or null if invalid.
 */
export function parseStatsString(statsString) {
    const result = {};
    const charMatch = statsString.match(/character="([^"]+)"/);
    if (!charMatch) return null;
    const charName = charMatch[1];
    result[charName] = {};

    const matches = statsString.matchAll(/(\w+)="([^"]+)"/g);
    for (const match of matches) {
        const [_, key, value] = match;
        if (key !== 'character') {
            if (Stats.hasStat(key.toLowerCase())) {
                result[charName][key.toLowerCase()] = value;
            } else {
                console.warn(`StatSuite: Ignoring unsupported stat key "${key}" during parsing.`);
            }
        }
    }
    if (Object.keys(result[charName]).length === 0) {
        console.warn(`StatSuite: No supported stats found for character "${charName}" in string: ${statsString}`);
        return null;
    }
    return result;
}

/**
 * Gets the relevant previous and current message details for stat generation.
 * @param {number | null} specificMessageIndex Index of the *new* message, or null for the latest.
 * @returns {object | null} Object with message details or null if not applicable.
 */
export function getRecentMessages(specificMessageIndex = null) {
    if (!Characters) {
        console.error("StatSuite Error: CharacterRegistry not initialized in stats_logic.");
        return null;
    }
    if (!chat || chat.length === 0) return null;

    let currentMessage;
    let previousMessage;
    let currentIndex;
    let previousIndex;

    if (specificMessageIndex !== null) {
        if (specificMessageIndex < 0 || specificMessageIndex >= chat.length) {
            console.warn(`StatSuite: getRecentMessages called with invalid index ${specificMessageIndex}`);
            return null;
        }
        currentIndex = specificMessageIndex;
        currentMessage = chat[currentIndex];

        if (currentMessage.is_system || /^\[.*\]$/.test(currentMessage.mes)) return null;

        if (currentIndex === 0) {
            previousMessage = null;
            previousIndex = -1;
        } else {
            previousIndex = -1;
            for (let i = currentIndex - 1; i >= 0; i--) {
                if (!chat[i].is_system && !/^\[.*\]$/.test(chat[i].mes)) {
                    previousMessage = chat[i];
                    previousIndex = i;
                    break;
                }
            }
            if (!previousMessage) {
                previousMessage = null;
                previousIndex = -1;
            }
        }
    } else {
        currentIndex = -1;
        previousIndex = -1;
        for (let i = chat.length - 1; i >= 0; i--) {
            if (!chat[i].is_system && !/^\[.*\]$/.test(chat[i].mes)) {
                if (currentIndex === -1) {
                    currentIndex = i;
                    currentMessage = chat[i];
                } else {
                    previousIndex = i;
                    previousMessage = chat[i];
                    break;
                }
            }
        }
        if (!currentMessage) return null;
        if (!previousMessage) previousIndex = -1;
    }

    if (ExtensionSettings.autoTrackMessageAuthors) {
        if (previousMessage) Characters.addCharacter(previousMessage.name, previousMessage.is_user);
        Characters.addCharacter(currentMessage.name, currentMessage.is_user);
    }

    const finalPreviousStats = {};
    const sourcePreviousStats = previousMessage ? previousMessage.stats || {} : {};
    const activeStats = Stats.getActiveStats();

    Characters.listTrackedCharacterNames().forEach(char => {
        if (!sourcePreviousStats.hasOwnProperty(char)) {
            finalPreviousStats[char] = null;
        } else {
            const charSourceStats = sourcePreviousStats[char] || {};
            const statsObj = {};
            activeStats.forEach(stat => {
                statsObj[stat] = charSourceStats[stat] || Stats.getStatConfig(stat).defaultValue;
            });
            finalPreviousStats[char] = new StatsBlock(statsObj);
        }
    });

    return {
        previousName: previousMessage ? previousMessage.name : null,
        previousMessage: previousMessage ? previousMessage.mes : "",
        previousStats: finalPreviousStats,
        previousIndex: previousIndex,
        newName: currentMessage.name,
        newMessage: currentMessage.mes,
        newStats: currentMessage.stats,
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
        const statConfig = Stats.getStatConfig(stat);
        if (!statConfig || !statConfig.dependencies) {
            console.error(`StatSuite Error: Invalid stat or missing dependencies in StatConfig for "${stat}"`);
            return;
        }
        statConfig.dependencies.forEach(dep => {
            if (!required.has(dep)) {
                addDependencies(dep);
                required.add(dep);
            }
        });
        required.add(stat);
    }
    if (Stats.hasStat(targetStat)) {
        addDependencies(targetStat);
    } else {
        console.error(`StatSuite Error: Target stat "${targetStat}" not found in StatConfig.`);
    }
    return Array.from(required).sort((a, b) => {
        const orderA = Stats.getStatConfig(a)?.order ?? Infinity;
        const orderB = Stats.getStatConfig(b)?.order ?? Infinity;
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

    if (stats && typeof stats === 'object') {
        for (const char of Object.keys(stats)) {
            if (!(stats[char] instanceof StatsBlock)) {
                stats[char] = new StatsBlock(stats[char]);
            }
        }
    }

    const statsChanged = JSON.stringify(message.stats) !== JSON.stringify(stats);

    message.stats = stats;

    if (typeof displayStats === 'function') {
        displayStats(messageIndex, stats);
    } else {
        console.warn("StatSuite Warning: displayStats function not available in stats_logic.");
    }

    if (statsChanged) {
        saveChatConditional();
    }

    if (messageIndex === chat.length - 1) {
        const chat = $("#chat");
        chat.scrollTop(chat[0].scrollHeight);
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
    if (!Characters) {
        console.error("StatSuite Error: CharacterRegistry not initialized in stats_logic.");
        return;
    }
    if (!ExtensionSettings.enableAutoRequestStats && specificMessageIndex === null && specificChar === null && specificStat === null) {
        console.log("StatSuite: Automatic stat generation is disabled.");
        return;
    }

    const messages = getRecentMessages(specificMessageIndex);
    if (!messages) {
        return;
    }

    if (!messages.newMessage || messages.newMessage.trim() === "") {
        console.log("StatSuite: Skipping stat generation for empty message.");
        return;
    }

    const charsToProcess = specificChar ? [specificChar] : Characters.listTrackedCharacterNames();
    if (charsToProcess.length === 0) {
        console.log("StatSuite: No characters are being tracked.");
        return;
    }

    const resultingStats = messages.newStats ? JSON.parse(JSON.stringify(messages.newStats)) : {};
    const activeStats = Stats.getActiveStats();

    charsToProcess.forEach(char => {
        if (!resultingStats[char]) {
            resultingStats[char] = new StatsBlock();
        } else if (!(resultingStats[char] instanceof StatsBlock)) {
            resultingStats[char] = new StatsBlock(resultingStats[char]);
        }
        activeStats.forEach(statKey => {
            if (!resultingStats[char].hasOwnProperty(statKey)) {
                resultingStats[char][statKey] = Stats.getStatConfig(statKey).defaultValue;
            }
        });
    });

    let statsActuallyGenerated = false;

    for (const char of charsToProcess) {
        const statsToGenerateForChar = specificStat
            ? getRequiredStats(specificStat)
            : activeStats;
        const sortedStatsToGenerate = statsToGenerateForChar.sort((a, b) => Stats.getStatConfig(a).order - Stats.getStatConfig(b).order);

        console.log(`StatSuite: Processing stats for character "${char}"`, sortedStatsToGenerate);

        for (const stat of sortedStatsToGenerate) {
            if (specificStat === null || stat === specificStat || (resultingStats[char][stat] == null || resultingStats[char][stat] === Stats.getStatConfig(stat).defaultValue)) {
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

    if (statsActuallyGenerated) {
        setMessageStats(resultingStats, messages.newIndex);
    } else {
        console.log("StatSuite: No stats were generated in this run.");
    }

    console.log("StatSuite: Generation mutex released.");
}

export async function injectStatsFromMessage(messageId) {
    const message = chat[messageId];
    if (!message.stats || Object.keys(message.stats).length === 0) {
        if (ExtensionSettings.enableAutoRequestStats) {
            await makeStats(messageId);
        }
    } else {
        console.log("StatSuite: Stats already present in the last message. No action taken.");
    }

    if (!message.stats) {
        console.warn("StatSuite: No stats found in the last message.");
        return;
    }

    const statsString = statsToStringFull(message.stats);
    const injection = `\n[[CURRENT STATE]]${statsString}[[/CURRENT STATE]]`;

    const ctx = SillyTavern.getContext();

    ctx.setExtensionPrompt(
        "StatSuite",
        injection,
        extension_prompt_types.IN_CHAT,
        0
    )
}