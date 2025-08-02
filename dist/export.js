// StatSuite - Export utilities for chat and stats
import { generateExportPrompt } from './prompts.js';
import { ExtensionSettings } from './settings.js';
import { Characters } from './characters/characters-registry.js';
import { StatsBlock } from './stats/stat-block.js';
import { Stats } from './stats/stats-registry.js';
import { substituteParams } from '../../../../../script.js';
import { Chat } from './chat/chat-manager.js';
import { ChatStatEntry } from './chat/chat-stat-entry.js';
/**
 * Exports the entire chat (excluding system and bracketed messages) to a downloadable text file.
 * @returns {Promise<void>}
 */
export async function exportChat() {
    const exportableMessages = Chat.getStatEligibleMessages();
    const exports = [];
    for (let i = 0; i < exportableMessages.length; i++) {
        const { message: currentMessage, index: currentIndex } = exportableMessages[i];
        let previousName, previousMes;
        /** @type {ChatStatEntry} */
        let previousStats;
        const currentStats = Chat.getMessageStats(currentIndex);
        if (!currentStats) {
            continue; // Skip if no stats or invalid stats
        }
        if (i === 0) {
            previousName = currentMessage.name;
            previousMes = '';
            previousStats = new ChatStatEntry();
            Object.keys(currentStats.Characters).forEach(charName => {
                previousStats.Characters[charName] = null;
            });
        }
        else {
            const { message: previousMessage, index: previousIndex } = exportableMessages[i - 1];
            previousName = previousMessage.name;
            previousMes = previousMessage.mes;
            previousStats = Chat.getMessageStats(previousIndex);
        }
        // Add missing characters from currentStats to previousStats with null value
        for (const charName of Object.keys(currentStats.Characters)) {
            if (!(charName in previousStats.Characters)) {
                previousStats.Characters[charName] = null;
            }
        }
        const prevStatsString = statsToStringFull(previousStats);
        const currStatsString = statsToStringFull(currentStats);
        if (!prevStatsString && !currStatsString)
            continue;
        const exportPrompt = generateExportPrompt(previousName, previousMes, currentMessage.name, currentMessage.mes, prevStatsString, currStatsString);
        exports.push(`\\\\-------${i + 1}--------\n` + exportPrompt);
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
/**
     * @typedef MessageContext
     * @property {string|null} previousName - Name of the previous message sender
     * @property {string} previousMessage - The text of the previous message
     * @property {ChatStatEntry} previousStats - Stats object for the previous message
     * @property {number} previousIndex - Index of the previous message
     * @property {string} newName - Name of the current message sender
     * @property {string} newMessage - The text of the current message
     * @property {ChatStatEntry} newStats - Stats object for the current message
     * @property {number} newIndex - Index of the current message
     */
/**
 * Exports a single message context to the clipboard in export format.
 * @param {MessageContext} messageContext - The message context object.
 * @returns {Promise<void>}
 */
export async function exportSingleMessage(messageContext) {
    if (!messageContext)
        return;
    let previousStats = messageContext.previousStats ?? new ChatStatEntry();
    let newStats = messageContext.newStats ?? new ChatStatEntry();
    let filteredPreviousStats = new ChatStatEntry();
    for (const charName of Object.keys(newStats.Characters)) {
        filteredPreviousStats.Characters[charName] = previousStats.Characters?.[charName] !== undefined ? previousStats.Characters?.[charName] : null;
    }
    let exportPrompt = generateExportPrompt(messageContext.previousName, messageContext.previousMessage, messageContext.newName, messageContext.newMessage, statsToStringFull(filteredPreviousStats), statsToStringFull(newStats));
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
/**
 * Converts a StatsBlock into string.
 * @param {StatsBlock} statsBlock - The stats object.
 * @returns {string} The formatted stats string.
 */
export function statsToString(name, statsBlock) {
    const attributes = Object.entries(statsBlock)
        .map(([key, value]) => {
        let strValue = String(value)
            .replace(/\\/g, "\\\\")
            .replace(/"/g, '\\"');
        return `${key.toLowerCase()}="${strValue}"`;
    })
        .join(' ');
    return `<stats character="${name}" ${attributes} />`;
}
/**
 * Generates a character description string.
 * @param {string} name - The character name.
 * @returns {string} The character description string.
 */
export function characterDescription(name) {
    var description = '';
    if (Characters.isPlayer(name)) {
        description = substituteParams("{{persona}}");
    }
    else {
        const char = substituteParams(`{{char}}`);
        if (char.includes(name)) {
            description = substituteParams("{{description}}");
        }
    }
    description = `\n<character name="${name}" description="${description}" />`;
    return description;
}
/**
 * Converts a stats object to a string in the export format.
 * @param {ChatStatEntry|null} stats - The stats object.
 * @returns {string} The formatted stats string.
 */
export function statsToStringFull(stats) {
    if (!stats)
        return '';
    return Object.entries(stats.Characters)
        .map(([charName, statsBlock]) => {
        if (statsBlock) {
            return statsToString(charName, statsBlock);
        }
        else {
            const description = characterDescription(charName);
            const statsBlock = new StatsBlock();
            Stats.getActiveStats().forEach(statEntry => {
                if (statsBlock?.[statEntry.name] !== undefined) {
                    statsBlock.set(statEntry.name, statsBlock[statEntry.name]);
                }
                else {
                    statsBlock.set(statEntry.name, statEntry.defaultValue);
                }
            });
            return statsToString(charName, statsBlock) + description;
        }
    })
        .join('\n');
}
