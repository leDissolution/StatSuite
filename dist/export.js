// StatSuite - Export utilities for chat and stats
import { generateExportPrompt } from './prompts.js';
import { ExtensionSettings } from './settings.js';
import { Characters } from './characters/characters-registry.js';
import { StatsBlock } from './stats/stat-block.js';
import { Stats } from './stats/stats-registry.js';
import { substituteParams } from '../../../../../script.js';
import { Chat } from './chat/chat-manager.js';
import { ChatStatEntry } from './chat/chat-stat-entry.js';
import { StatScope } from './stats/stat-entry.js';
import { Scenes } from './scenes/scene-registry.js';
export async function exportChat() {
    const exportableMessages = Chat.getStatEligibleMessages();
    const exports = [];
    let exportIndex = 0;
    for (let i = 0; i < exportableMessages.length; i++) {
        const { message: currentMessage, index: currentIndex } = exportableMessages[i];
        let previousName, previousMes;
        let previousStats;
        if (currentMessage.exportStats === false) {
            continue;
        }
        const currentStats = Chat.getMessageStats(currentIndex)?.clone();
        if (!currentStats) {
            continue; // Skip if no stats or invalid stats
        }
        if (i === 0) {
            previousName = currentMessage.name;
            previousMes = '';
            previousStats = new ChatStatEntry();
        }
        else {
            const { message: previousMessage, index: previousIndex } = exportableMessages[i - 1];
            previousName = previousMessage.name;
            previousMes = previousMessage.mes;
            previousStats = Chat.getMessageStats(previousIndex)?.clone() ?? new ChatStatEntry();
        }
        // Add missing characters from currentStats to previousStats with null value
        for (const charName of Object.keys(currentStats.Characters)) {
            if (!(charName in previousStats.Characters)) {
                previousStats.Characters[charName] = null;
            }
            if (!currentStats.Characters[charName] && !previousStats.Characters[charName]) {
                delete currentStats.Characters[charName];
                delete previousStats.Characters[charName];
            }
        }
        for (const sceneName of Object.keys(currentStats.Scenes)) {
            if (!(sceneName in previousStats.Scenes)) {
                previousStats.Scenes[sceneName] = Scenes.getLatestSceneStats(sceneName, currentIndex);
            }
        }
        const prevStatsString = statsToStringFull(previousStats, false);
        const currStatsString = statsToStringFull(currentStats, false);
        if (!prevStatsString && !currStatsString)
            continue;
        const exportPrompt = generateExportPrompt(previousName, previousMes, currentMessage.name, currentMessage.mes, prevStatsString, currStatsString);
        exports.push(`\\\\-------${exportIndex + 1}--------\n` + exportPrompt);
        exportIndex += 1;
    }
    const exportString = exports.join('\n\n');
    const blob = new Blob([exportString], { type: 'text/plain' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'chat_export.txt';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(link.href);
}
export async function exportSingleMessage(messageContext) {
    if (!messageContext)
        return;
    let previousStats = messageContext.previousStats ?? new ChatStatEntry();
    let newStats = messageContext.newStats ?? new ChatStatEntry();
    let filteredPreviousStats = new ChatStatEntry();
    for (const charName of Object.keys(newStats.Characters)) {
        filteredPreviousStats.Characters[charName] = previousStats.Characters?.[charName] !== undefined ? previousStats.Characters?.[charName] : null;
    }
    for (const sceneName of Object.keys(newStats.Scenes)) {
        filteredPreviousStats.Scenes[sceneName] = previousStats.Scenes?.[sceneName] !== undefined ? previousStats.Scenes?.[sceneName] : Scenes.getLatestSceneStats(sceneName, messageContext.previousIndex ?? -1);
    }
    for (const sceneName of Object.keys(previousStats.Scenes)) {
        if (!filteredPreviousStats.Scenes[sceneName]) {
            filteredPreviousStats.Scenes[sceneName] = previousStats.Scenes[sceneName] ?? null;
        }
    }
    let exportPrompt = generateExportPrompt(messageContext.previousName ?? '', messageContext.previousMessage ?? '', messageContext.newName ?? '', messageContext.newMessage ?? '', statsToStringFull(filteredPreviousStats, false), statsToStringFull(newStats, false));
    if (ExtensionSettings.anonymizeClipboardExport) {
        let characterMap = {};
        Characters.listTrackedCharacterNames().forEach((name, index) => {
            characterMap[name] = `Character${index + 1}`;
        });
        for (const [originalName, newName] of Object.entries(characterMap)) {
            exportPrompt = exportPrompt.replace(new RegExp(originalName, 'g'), newName);
        }
    }
    try {
        await navigator.clipboard.writeText(exportPrompt);
        toastr.success('Message export copied to clipboard');
    }
    catch (err) {
        console.error('Failed to copy to clipboard:', err);
        toastr.error('Failed to copy to clipboard');
    }
}
export function sanitizeForXML(input) {
    return input.replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/\\/g, "\\\\")
        .replace(/"/g, '\\"')
        .trim();
}
export function statsToString(name, statsBlock, subject) {
    const attributes = Object.entries(statsBlock)
        .map(([key, value]) => {
        return `${key.toLowerCase()}="${sanitizeForXML(String(value))}"`;
    })
        .join(' ');
    return `<stats ${subject}="${sanitizeForXML(name)}" ${attributes} />`;
}
export function characterDescription(name) {
    let description = '';
    if (Characters.isPlayer(name)) {
        description = substituteParams("{{persona}}");
    }
    else {
        var context = SillyTavern.getContext();
        let char = substituteParams(`{{char}}`);
        if (!char) {
            char = context.characters.find(c => c.name === name)?.name || context.characters.find(c => c.name.startsWith(name))?.name || '';
        }
        if (char.includes(name)) {
            description = substituteParams("{{description}}");
            if (!description) {
                description = context.characters.find(c => c.name === char)?.description || '';
                if (description) {
                    description = substituteParams(description);
                }
            }
        }
    }
    description = `<character name="${sanitizeForXML(name)}" description="${sanitizeForXML(description)}" />`;
    return description;
}
export function statsToStringFull(stats, fillMissingWithDefaults = true) {
    if (!stats)
        return '';
    const chars = Object.entries(stats.Characters)
        .map(([charName, stats]) => {
        if (!stats)
            return characterDescription(charName);
        const block = StatsBlock.fromObject(stats);
        if (fillMissingWithDefaults) {
            for (const statEntry of Stats.getActiveStats(StatScope.Character)) {
                if (block[statEntry.name] === undefined) {
                    block[statEntry.name] = statEntry.defaultValue;
                }
            }
        }
        return statsToString(charName, block, StatScope.Character);
    })
        .join('\n');
    const scenes = Object.entries(stats.Scenes)
        .map(([sceneName, stats]) => {
        if (!stats)
            return ''; // No scene description for now
        const block = StatsBlock.fromObject(stats);
        if (fillMissingWithDefaults) {
            for (const statEntry of Stats.getActiveStats(StatScope.Scene)) {
                if (block[statEntry.name] === undefined) {
                    block[statEntry.name] = statEntry.defaultValue;
                }
            }
        }
        return statsToString(sceneName, block, StatScope.Scene);
    })
        .join('\n');
    return [chars, scenes].join('\n').trim();
}
