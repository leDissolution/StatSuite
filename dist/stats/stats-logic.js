import { extension_prompt_types } from '../../../../../../script.js';
import { ExtensionSettings, shouldRequestStats, getActiveScopes } from '../settings.js';
import { generateStat, checkApiConnection, shouldSkipApiCalls, resetConnectionFailure } from '../api.js';
import { displayStats } from '../ui/stats-table.js';
import { Characters } from '../characters/characters-registry.js';
import { Scenes } from '../scenes/scene-registry.js';
import { Stats } from './stats-registry.js';
import { StatsBlock } from './stat-block.js';
import { Chat } from '../chat/chat-manager.js';
import { ChatStatEntry } from '../chat/chat-stat-entry.js';
import { Templates } from '../templates/templates-registry.js';
import { TemplateData } from '../templates/template.js';
import { StatScope } from './stat-entry.js';
export function parseSingleStatsString(statsString) {
    const result = {};
    const charMatch = statsString.match(/character="([^"]+)"/);
    if (!charMatch)
        return null;
    const charName = charMatch[1];
    if (!charName)
        return null;
    result[charName] = new StatsBlock();
    const matches = statsString.matchAll(/(\w+)="([^"]+)"/g);
    for (const match of matches) {
        const [_, key, value] = match;
        if (key && key !== 'character' && value) {
            if (Stats.hasStat(key.toLowerCase())) {
                result[charName][key.toLowerCase()] = value;
            }
            else {
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
export function getRecentMessages(specificMessageIndex = null) {
    if (!Characters) {
        console.error("StatSuite Error: CharacterRegistry not initialized in stats_logic.");
        return null;
    }
    const messageIndex = specificMessageIndex ?? Chat.getLatestMessage()?.index;
    if (messageIndex === undefined)
        return null;
    const context = Chat.getMessageContext(messageIndex);
    if (!context)
        return null;
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
    Characters.listActiveCharacterNames().forEach(char => {
        if (!sourcePreviousStats.Characters.hasOwnProperty(char)) {
            finalPreviousStats.Characters[char] = null;
        }
        else {
            const charSourceStats = sourcePreviousStats.Characters[char] || {};
            const statsBlock = new StatsBlock();
            Stats.getActiveStats(StatScope.Character).forEach(statEntry => {
                statsBlock[statEntry.name] = charSourceStats[statEntry.name] || statEntry.defaultValue;
            });
            finalPreviousStats.Characters[char] = new StatsBlock(statsBlock);
        }
    });
    finalPreviousStats.Scenes = JSON.parse(JSON.stringify(sourcePreviousStats.Scenes || {}));
    return {
        ...context,
        previousStats: finalPreviousStats
    };
}
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
    }
    else {
        console.error(`StatSuite Error: Target stat "${targetStat}" not found in StatConfig.`);
    }
    return Array.from(required).sort((a, b) => {
        const orderA = Stats.getStatEntry(a)?.order ?? Infinity;
        const orderB = Stats.getStatEntry(b)?.order ?? Infinity;
        return orderA - orderB;
    });
}
export function setMessageStats(stats, messageIndex) {
    if (!Chat.isValidMessageForStats(messageIndex)) {
        console.error(`StatSuite Error: Invalid messageIndex ${messageIndex} in setMessageStats.`);
        return;
    }
    const currentStats = Chat.getMessageStats(messageIndex);
    const statsChanged = JSON.stringify(currentStats) !== JSON.stringify(stats);
    Chat.setMessageStats(messageIndex, stats);
    displayStats(messageIndex, stats, getActiveScopes());
    if (statsChanged) {
        Chat.saveChat();
    }
}
export async function makeStats(specificMessageIndex = null, specificSubject = null, specificStat = null, greedy = true, copyOver = false, scope = null) {
    if (!Characters) {
        console.error("StatSuite Error: CharacterRegistry not initialized in stats_logic.");
        return;
    }
    if (!shouldRequestStats(Chat.currentCharacter) && specificMessageIndex === null && specificSubject === null && specificStat === null) {
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
    const scopesToProcess = scope ? [scope] : getActiveScopes();
    if (!ExtensionSettings.offlineMode && specificMessageIndex === null && specificSubject === null && specificStat === null) {
        console.log("StatSuite: Testing API connection before automatic stat generation...");
        const connectionOk = await checkApiConnection();
        if (!connectionOk) {
            console.log("StatSuite: API connection test failed. Skipping automatic stat generation.");
            return;
        }
    }
    const resultingStats = messages.newStats ? messages.newStats.clone() : new ChatStatEntry({}, {});
    if (!messages.newStats) {
        displayStats(messages.newIndex, new ChatStatEntry({ '...': null }, {}), getActiveScopes());
    }
    // Iterate over requested scopes and generate accordingly
    for (const currentScope of scopesToProcess) {
        if (currentScope === StatScope.Scene) {
            const hasAnyCharacterStats = Object.keys(resultingStats.Characters || {}).length > 0;
            if (!hasAnyCharacterStats) {
                console.log('StatSuite: Skipping Scene generation because no character stats are present yet.');
                continue;
            }
            if (!specificSubject && !specificStat) {
                resultingStats.Scenes = {};
            }
        }
        const subjectsToProcess = (() => {
            if (specificSubject)
                return [specificSubject];
            if (currentScope === StatScope.Character)
                return Characters.listActiveCharacterNames();
            if (currentScope === StatScope.Scene)
                return Scenes.listActiveSceneNames(messages.newIndex);
            return [];
        })();
        let activeStats = Stats.getActiveStats(currentScope);
        if (ExtensionSettings.offlineMode) {
            activeStats = activeStats.filter(stat => stat.isManual);
        }
        subjectsToProcess.forEach(subjectName => {
            const bucket = resultingStats.ofScope(currentScope);
            let subjectStats = bucket[subjectName];
            if (!subjectStats) {
                subjectStats = new StatsBlock();
            }
            else if (!(subjectStats instanceof StatsBlock)) {
                subjectStats = new StatsBlock(subjectStats);
            }
            activeStats.forEach(statEntry => {
                if (!subjectStats.hasOwnProperty(statEntry.name)) {
                    subjectStats[statEntry.name] = statEntry.defaultValue;
                }
                if (statEntry.isManual) {
                    const prevBucket = messages.previousStats?.ofScope(currentScope);
                    const prevStats = prevBucket?.[subjectName];
                    if (prevStats && prevStats[statEntry.name] !== undefined) {
                        subjectStats[statEntry.name] = prevStats[statEntry.name];
                    }
                }
            });
            bucket[subjectName] = subjectStats;
            const oldBucket = messages.previousStats?.ofScope(currentScope);
            if (!oldBucket[subjectName]) {
                if (currentScope == StatScope.Scene)
                    oldBucket[subjectName] = Scenes.getLatestSceneStats(subjectName, messages.previousIndex);
                else
                    oldBucket[subjectName] = null;
            }
        });
        let statsActuallyGenerated = false;
        if (!ExtensionSettings.offlineMode) {
            const statsToGenerate = Array.isArray(activeStats)
                ? activeStats.filter(s => !s.isManual).map(s => s.name)
                : [];
            for (const subject of subjectsToProcess) {
                if (shouldSkipApiCalls()) {
                    console.log(`StatSuite: Stopping stat generation due to connection issues. Processed up to ${currentScope} "${subject}".`);
                    break;
                }
                const statsToGenerateForSubject = specificStat
                    ? getRequiredStats(specificStat).filter(stat => !Stats.getStatEntry(stat)?.isManual)
                    : statsToGenerate;
                const sortedStatsToGenerate = statsToGenerateForSubject.sort((a, b) => (Stats.getStatEntry(a)?.order ?? 0) - (Stats.getStatEntry(b)?.order ?? 0));
                console.log(`StatSuite: Processing stats for ${currentScope} "${subject}"`, sortedStatsToGenerate);
                for (const stat of sortedStatsToGenerate) {
                    if (shouldSkipApiCalls()) {
                        console.log(`StatSuite: Stopping stat generation due to connection issues. Processed up to stat "${stat}" for ${currentScope} "${subject}".`);
                        break;
                    }
                    const subjectStats = resultingStats.ofScope(currentScope)[subject];
                    if (!subjectStats)
                        continue;
                    const prevBucket = messages.previousStats?.ofScope(currentScope);
                    const prevStats = prevBucket?.[subject];
                    if (copyOver && prevStats && prevStats[stat] !== undefined) {
                        subjectStats[stat] = prevStats[stat];
                        statsActuallyGenerated = true;
                        continue;
                    }
                    if (specificStat === null || stat === specificStat || (subjectStats[stat] == null || subjectStats[stat] === Stats.getStatEntry(stat)?.defaultValue)) {
                        const generatedValue = await generateStat(stat, subject, messages, subjectStats, greedy);
                        if (typeof generatedValue === 'string' && !generatedValue.startsWith('error')) {
                            subjectStats[stat] = generatedValue;
                            statsActuallyGenerated = true;
                        }
                        else {
                            console.warn(`StatSuite: Failed to generate stat "${stat}" for "${subject}". Error: ${generatedValue}. Keeping previous value: "${subjectStats[stat]}"`);
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
        }
        else {
            console.log("StatSuite: No stats were generated in this run.");
        }
    }
    console.log("StatSuite: Generation mutex released.");
}
export function retryStatGeneration() {
    resetConnectionFailure();
    console.log("StatSuite: Connection failure state reset. Stat generation will be attempted again.");
}
export async function injectStatsFromMessage(messageId) {
    const ctx = SillyTavern.getContext();
    ctx.setExtensionPrompt("StatSuite", "", extension_prompt_types.IN_CHAT, 0);
    const stats = Chat.getMessageStats(messageId);
    if (!stats || Object.keys(stats).length === 0) {
        if (shouldRequestStats(Chat.currentCharacter)) {
            await makeStats(messageId);
        }
    }
    else {
        console.log("StatSuite: Stats already present in the last message. No action taken.");
    }
    const finalStats = Chat.getMessageStats(messageId);
    if (!finalStats) {
        console.warn("StatSuite: No stats found in the last message.");
        return;
    }
    Templates.getEnabledTemplates().forEach(template => {
        const text = template.render(TemplateData.fromMessageStatEntry(finalStats));
        if (!text)
            return;
        ctx.variables.local.set(template.variableName, text);
        if (template.injectAtDepth) {
            ctx.setExtensionPrompt("StatSuite" + `.${template.name.replace(/\s+/g, '_')}`, text, extension_prompt_types.IN_CHAT, template.injectAtDepthValue);
        }
        else {
            console.warn(`StatSuite: Template "${template.name}" did not produce an injection.`);
        }
    });
}
