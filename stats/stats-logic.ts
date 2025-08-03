import { extension_prompt_types } from '../../../../../../script.js';

import { ExtensionSettings } from '../settings.js';
import { generateStat, checkApiConnection, shouldSkipApiCalls, resetConnectionFailure } from '../api.js';
import { displayStats } from '../ui/stats-table.js';
import { Characters } from '../characters/characters-registry.js';
import { statsToStringFull } from '../export.js';
import { Stats } from './stats-registry.js';
import { StatsBlock } from './stat-block.js';
import { Chat, MessageContext } from '../chat/chat-manager.js';
import { ChatStatEntry } from '../chat/chat-stat-entry.js';

export function parseSingleStatsString(statsString: string): { [key: string]: StatsBlock } | null {
    const result: { [key: string]: StatsBlock } = {};
    const charMatch = statsString.match(/character="([^"]+)"/);
    if (!charMatch) return null;
    
    const charName = charMatch[1];
    if (!charName) return null;

    result[charName] = new StatsBlock();

    const matches = statsString.matchAll(/(\w+)="([^"]+)"/g);
    for (const match of matches) {
        const [_, key, value] = match;
        if (key && key !== 'character' && value) {
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

export function getRecentMessages(specificMessageIndex: number | null = null): MessageContext | null {
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

    const finalPreviousStats = new ChatStatEntry({}, {});
    const sourcePreviousStats = context.previousStats || new ChatStatEntry({}, {});
    const activeStats = Stats.getActiveStats();

    Characters.listActiveCharacterNames().forEach(char => {
        if (!sourcePreviousStats.Characters.hasOwnProperty(char)) {
            finalPreviousStats.Characters[char] = null;
        } else {
            const charSourceStats = sourcePreviousStats.Characters[char] || {};
            const statsBlock = new StatsBlock();
            activeStats.forEach(statEntry => {
                statsBlock[statEntry.name] = charSourceStats[statEntry.name] || statEntry.defaultValue;
            });
            finalPreviousStats.Characters[char] = new StatsBlock(statsBlock);
        }
    });

    return {
        ...context,
        previousStats: finalPreviousStats
    };
}

export function getRequiredStats(targetStat: string): string[] {
    const required = new Set<string>();
    function addDependencies(stat: string) {
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

export function setMessageStats(stats: ChatStatEntry, messageIndex: number) {
    if (!Chat.isValidMessageForStats(messageIndex)) {
        console.error(`StatSuite Error: Invalid messageIndex ${messageIndex} in setMessageStats.`);
        return;
    }

    const currentStats = Chat.getMessageStats(messageIndex);
    const statsChanged = JSON.stringify(currentStats) !== JSON.stringify(stats);

    Chat.setMessageStats(messageIndex, stats);

    displayStats(messageIndex, stats);

    if (statsChanged) {
        Chat.saveChat();
    }
}

export async function makeStats(specificMessageIndex: number | null = null, specificChar: string | null = null, specificStat: string | null = null, greedy: boolean = true, copyOver = false) {
    if (!Characters) {
        console.error("StatSuite Error: CharacterRegistry not initialized in stats_logic.");
        return;
    }
    if (!ExtensionSettings.enableAutoRequestStats && specificMessageIndex === null && specificChar === null && specificStat === null) {
        console.log("StatSuite: Automatic stat generation is disabled.");
        return;
    }

    if (!ExtensionSettings.offlineMode && shouldSkipApiCalls()) {
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

    const charsToProcess = specificChar ? [specificChar] : Characters.listActiveCharacterNames();
    if (charsToProcess.length === 0) {
        console.log("StatSuite: No characters are being tracked.");
        toastr.error("StatSuite: No characters are being tracked. Please add characters to the registry.");
        return;
    }

    if (!ExtensionSettings.offlineMode && specificMessageIndex === null && specificChar === null && specificStat === null) {
        console.log("StatSuite: Testing API connection before automatic stat generation...");
        const connectionOk = await checkApiConnection();
        if (!connectionOk) {
            console.log("StatSuite: API connection test failed. Skipping automatic stat generation.");
            return;
        }
    }

    const resultingStats = messages.newStats ? messages.newStats.clone() : new ChatStatEntry({}, {});

    if (!messages.newStats) {
        displayStats(messages.newIndex, new ChatStatEntry({'...': null}, {}));
    }

    var activeStats = Stats.getActiveStats();

    if (ExtensionSettings.offlineMode) {
        activeStats = activeStats.filter(stat => stat.isManual);
    }

    charsToProcess.forEach(charName => {
        let charStats = resultingStats.Characters[charName];

        if (!charStats) {
            charStats = new StatsBlock();
        } else if (!(charStats instanceof StatsBlock)) {
            charStats = new StatsBlock(charStats);
        }
        activeStats.forEach(statEntry => {
            if (!charStats.hasOwnProperty(statEntry.name)) {
                charStats[statEntry.name] = statEntry.defaultValue;
            }

            if (statEntry.isManual) {
                if (messages.previousStats && messages.previousStats.Characters[charName] && messages.previousStats.Characters[charName][statEntry.name] !== undefined) {
                    charStats[statEntry.name] = messages.previousStats.Characters[charName][statEntry.name]!;
                }
            }
        });

        resultingStats.Characters[charName] = charStats;
    });    
    
    let statsActuallyGenerated = false;

    if (!ExtensionSettings.offlineMode) {
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
            const sortedStatsToGenerate = statsToGenerateForChar.sort((a, b) => Stats.getStatEntry(a)?.order ?? 0 - (Stats.getStatEntry(b)?.order ?? 0));

            console.log(`StatSuite: Processing stats for character "${char}"`, sortedStatsToGenerate);

            for (const stat of sortedStatsToGenerate) {
                if (shouldSkipApiCalls()) {
                    console.log(`StatSuite: Stopping stat generation due to connection issues. Processed up to stat "${stat}" for character "${char}".`);
                    break;
                }

                const charStats = resultingStats.Characters[char];
                if (!charStats) continue;

                if (copyOver && messages.previousStats && messages.previousStats.Characters[char] && messages.previousStats.Characters[char][stat] !== undefined) {
                    charStats[stat] = messages.previousStats.Characters[char][stat];
                    statsActuallyGenerated = true;
                    continue;
                }

                if (specificStat === null || stat === specificStat || (charStats[stat] == null || charStats[stat] === Stats.getStatEntry(stat)?.defaultValue)) {
                    const generatedValue = await generateStat(
                        stat,
                        char,
                        messages,
                        charStats,
                        greedy
                    );

                    if (typeof generatedValue === 'string' && !generatedValue.startsWith('error')) {
                        charStats[stat] = generatedValue;
                        statsActuallyGenerated = true;
                    } else {
                        console.warn(`StatSuite: Failed to generate stat "${stat}" for "${char}". Error: ${generatedValue}. Keeping previous value: "${charStats[stat]}"`);
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
    }

    if (ExtensionSettings.offlineMode || statsActuallyGenerated) {
        setMessageStats(resultingStats, messages.newIndex);
    } else {
        console.log("StatSuite: No stats were generated in this run.");
    }

    console.log("StatSuite: Generation mutex released.");
}

export function retryStatGeneration() {
    resetConnectionFailure();
    console.log("StatSuite: Connection failure state reset. Stat generation will be attempted again.");
}

export async function injectStatsFromMessage(messageId: number) {
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