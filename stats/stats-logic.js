// StatSuite - Core logic for stats definition, generation, and processing
import { chat, extension_prompt_types } from '../../../../../script.js';

import { ExtensionSettings } from '../settings.js';
import { generateStat, checkApiConnection, shouldSkipApiCalls, resetConnectionFailure } from '../api.js';
import { displayStats } from '../ui/stats-table.js';
import { Characters } from '../characters/characters-registry.js';
import { statsToStringFull } from '../export.js';
import { Stats } from './stats-registry.js';
import { StatsBlock } from './stat-block.js';
import { Chat } from '../chat/chat-manager.js';

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

    const messageIndex = specificMessageIndex ?? Chat.getLatestMessage()?.index;
    if (messageIndex === undefined) return null;

    const context = Chat.getMessageContext(messageIndex);
    if (!context) return null;

    if (ExtensionSettings.autoTrackMessageAuthors) {
        if (context.previousName) {
            const previousMessage = Chat.getMessage(context.previousIndex);
            Characters.addCharacter(context.previousName, previousMessage?.is_user || false);
        }
        const currentMessage = Chat.getMessage(context.newIndex);
        Characters.addCharacter(context.newName, currentMessage?.is_user || false);
    }

    const finalPreviousStats = {};
    const sourcePreviousStats = context.previousStats || {};
    const activeStats = Stats.getActiveStats();

    Characters.listTrackedCharacterNames().forEach(char => {
        if (!sourcePreviousStats.hasOwnProperty(char)) {
            finalPreviousStats[char] = null;
        } else {
            const charSourceStats = sourcePreviousStats[char] || {};
            const statsBlock = {};
            activeStats.forEach(statEntry => {
                statsBlock[statEntry.name] = charSourceStats[statEntry.name] || statEntry.defaultValue;
            });
            finalPreviousStats[char] = new StatsBlock(statsBlock);
        }
    });

    return {
        ...context,
        previousStats: finalPreviousStats
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
        const statConfig = Stats.getStatEntry(stat);
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
        const orderA = Stats.getStatEntry(a)?.order ?? Infinity;
        const orderB = Stats.getStatEntry(b)?.order ?? Infinity;
        return orderA - orderB;
    });
}

/**
 * Applies the generated/updated stats to the message object and triggers UI update and save.
 * @param {object} stats The complete stats object for the message.
 * @param {number} messageIndex The index of the message in the chat array.
 */
export function setMessageStats(stats, messageIndex) {
    if (!Chat.isValidMessageForStats(messageIndex)) {
        console.error(`StatSuite Error: Invalid messageIndex ${messageIndex} in setMessageStats.`);
        return;
    }

    if (stats && typeof stats === 'object') {
        // Process stats (convert to StatsBlock, normalize values, etc.)
        for (const char of Object.keys(stats)) {
            /** @type {StatsBlock} */
            let statsBlock = stats[char];
            if (!(statsBlock instanceof StatsBlock)) {
                statsBlock = new StatsBlock(statsBlock);
                stats[char] = statsBlock;
            }
            // Normalize specific stat values
            if (statsBlock.hasOwnProperty('bodyState')) {
                statsBlock.bodyState = statsBlock.bodyState.toLowerCase();
            }
            if (statsBlock.hasOwnProperty('mood')) {
                statsBlock.mood = statsBlock.mood.toLowerCase();
            }
        }
    }

    // Get current stats for comparison
    const currentStats = Chat.getMessageStats(messageIndex);
    const statsChanged = JSON.stringify(currentStats) !== JSON.stringify(stats);

    // Store stats using chat manager
    Chat.setMessageStats(messageIndex, stats);

    // Update UI
    if (typeof displayStats === 'function') {
        displayStats(messageIndex, stats);
    } else {
        console.warn("StatSuite Warning: displayStats function not available in stats_logic.");
    }

    // Save if changed
    if (statsChanged) {
        Chat.saveChat();
    }
}

/**
 * Orchestrates the generation of stats for a specific message.
 * @param {number | null} specificMessageIndex Index of the message, or null for latest.
 * @param {string | null} specificChar Character name, or null for all tracked.
 * @param {string | null} specificStat Stat name, or null for all supported.
 * @param {boolean} greedy Use greedy sampling for API call.
 */
export async function makeStats(specificMessageIndex = null, specificChar = null, specificStat = null, greedy = true, copyOver = false) {
    if (!Characters) {
        console.error("StatSuite Error: CharacterRegistry not initialized in stats_logic.");
        return;
    }
    if (!ExtensionSettings.enableAutoRequestStats && specificMessageIndex === null && specificChar === null && specificStat === null) {
        console.log("StatSuite: Automatic stat generation is disabled.");
        return;
    }

    if (shouldSkipApiCalls()) {
        console.log("StatSuite: Skipping stat generation due to recent connection failures. Call resetConnectionFailure() to retry.");
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

    if (specificMessageIndex === null && specificChar === null && specificStat === null) {
        console.log("StatSuite: Testing API connection before automatic stat generation...");
        const connectionOk = await checkApiConnection();
        if (!connectionOk) {
            console.log("StatSuite: API connection test failed. Skipping automatic stat generation.");
            return;
        }
    }

    const resultingStats = messages.newStats ? JSON.parse(JSON.stringify(messages.newStats)) : {};
    const activeStats = Stats.getActiveStats();

    charsToProcess.forEach(char => {
        if (!resultingStats[char]) {
            resultingStats[char] = new StatsBlock();
        } else if (!(resultingStats[char] instanceof StatsBlock)) {
            resultingStats[char] = new StatsBlock(resultingStats[char]);
        }
        activeStats.forEach(statEntry => {
            if (!resultingStats[char].hasOwnProperty(statEntry.name)) {
                if (statEntry.isManual) {
                    if (messages.previousStats && messages.previousStats[char] && messages.previousStats[char][statEntry.name] !== undefined) {
                        resultingStats[char][statEntry.name] = messages.previousStats[char][statEntry.name];
                    } else {
                        resultingStats[char][statEntry.name] = statEntry.defaultValue;
                    }
                } else {
                    resultingStats[char][statEntry.name] = statEntry.defaultValue;
                }
            }
        });
    });    
    
    let statsActuallyGenerated = false;

    const statsToGenerate = Array.isArray(activeStats)
        ? activeStats.filter(s => !s.isManual).map(s => s.name)
        : [];

    for (const char of charsToProcess) {
        if (shouldSkipApiCalls()) {
            console.log(`StatSuite: Stopping stat generation due to connection issues. Processed up to character "${char}".`);
            break;
        }

        const statsToGenerateForChar = specificStat
            ? getRequiredStats(specificStat).filter(stat => !Stats.getStatEntry(stat)?.isManual)
            : statsToGenerate;
        const sortedStatsToGenerate = statsToGenerateForChar.sort((a, b) => Stats.getStatEntry(a).order - Stats.getStatEntry(b).order);

        console.log(`StatSuite: Processing stats for character "${char}"`, sortedStatsToGenerate);

        for (const stat of sortedStatsToGenerate) {
            if (shouldSkipApiCalls()) {
                console.log(`StatSuite: Stopping stat generation due to connection issues. Processed up to stat "${stat}" for character "${char}".`);
                break;
            }

            if (copyOver && messages.previousStats && messages.previousStats[char] && messages.previousStats[char][stat] !== undefined) {
                resultingStats[char][stat] = messages.previousStats[char][stat];
                statsActuallyGenerated = true;
                continue;
            }

            if (specificStat === null || stat === specificStat || (resultingStats[char][stat] == null || resultingStats[char][stat] === Stats.getStatEntry(stat).defaultValue)) {
                const generatedValue = await generateStat(
                    stat,
                    char,
                    messages,
                    resultingStats[char],
                    greedy
                );

                if (typeof generatedValue === 'string' && !generatedValue.startsWith('error')) {
                    resultingStats[char][stat] = generatedValue;
                    statsActuallyGenerated = true;
                } else {
                    console.warn(`StatSuite: Failed to generate stat "${stat}" for "${char}". Error: ${generatedValue}. Keeping previous value: "${resultingStats[char][stat]}"`);
                    if (generatedValue === 'error_network_or_cors' || generatedValue === 'error_api_call_failed') {
                        console.log(`StatSuite: Detected connection issue. Stopping further stat generation.`);
                        break;
                    }
                }
            }
        }
        if (shouldSkipApiCalls()) {
            break;
        }
    }

    if (statsActuallyGenerated) {
        setMessageStats(resultingStats, messages.newIndex);
    } else {
        console.log("StatSuite: No stats were generated in this run.");
    }

    console.log("StatSuite: Generation mutex released.");
}

/**
 * Resets the connection failure state to allow retrying stat generation.
 * Call this when you want to retry after a connection failure.
 */
export function retryStatGeneration() {
    resetConnectionFailure();
    console.log("StatSuite: Connection failure state reset. Stat generation will be attempted again.");
}

export async function injectStatsFromMessage(messageId) {
    const ctx = SillyTavern.getContext();

    ctx.setExtensionPrompt(
        "StatSuite",
        "",
        extension_prompt_types.IN_CHAT,
        0
    )

    const stats = Chat.getMessageStats(messageId);
    if (!stats || Object.keys(stats).length === 0) {
        if (ExtensionSettings.enableAutoRequestStats) {
            await makeStats(messageId);
        }
    } else {
        console.log("StatSuite: Stats already present in the last message. No action taken.");
    }

    const finalStats = Chat.getMessageStats(messageId);
    if (!finalStats) {
        console.warn("StatSuite: No stats found in the last message.");
        return;
    }

    const statsString = statsToStringFull(finalStats);
    const injection = `\n[current state]${statsString}[/current state]\nDO NOT REITERATE THE STATS IN YOUR RESPONSE.`;

    ctx.setExtensionPrompt(
        "StatSuite",
        injection,
        extension_prompt_types.IN_CHAT,
        1
    )
}