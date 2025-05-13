// StatSuite - Export utilities for chat and stats
import { generateExportPrompt } from './prompts.js';
import { chat } from '../../../../script.js';
import { ExtensionSettings } from './settings.js';
import { Characters } from './characters.js';

/**
 * Exports the entire chat (excluding system and bracketed messages) to a downloadable text file.
 * @returns {Promise<void>}
 */
export async function exportChat() {
    const allMessages = chat.filter(c => !c.is_system && !/^\[.*\]$/.test(c.mes));
    const exports = [];
    for (let i = 1; i < allMessages.length; i++) {
        const previousMessage = allMessages[i - 1];
        const currentMessage = allMessages[i];
        if (!previousMessage.stats && !currentMessage.stats) continue;
        const exportPrompt = generateExportPrompt(
            previousMessage.name,
            previousMessage.mes,
            currentMessage.name,
            currentMessage.mes,
            previousMessage.stats ? statsToStringFull(previousMessage.stats) : '',
            currentMessage.stats ? statsToStringFull(currentMessage.stats) : ''
        );
        exports.push(`\\\\-------${i}--------\n` + exportPrompt);
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
 * Exports a single message context to the clipboard in export format.
 * @param {object} messages - The message context object.
 * @returns {Promise<void>}
 */
export async function exportSingleMessage(messages) {
    if (!messages) return;
    let exportPrompt = generateExportPrompt(
        messages.previousName,
        messages.previousMessage,
        messages.newName,
        messages.newMessage,
        messages.previousStats ? statsToStringFull(messages.previousStats) : '',
        messages.newStats ? statsToStringFull(messages.newStats) : ''
    );

    if (ExtensionSettings.anonymizeClipboardExport) {
        let characterMap = {};
        Characters.getTrackedCharacters().forEach((name, index) => {
            characterMap[name] = `Character${index + 1}`;
        });
        
        for (const [originalName, newName] of Object.entries(characterMap)) {
            exportPrompt = exportPrompt.replace(new RegExp(originalName, 'g'), newName);
        }
    }

    try {
        await navigator.clipboard.writeText(exportPrompt);
        toastr.success('Message export copied to clipboard');
    } catch (err) {
        console.error('Failed to copy to clipboard:', err);
        toastr.error('Failed to copy to clipboard');
    }
}

/**
 * Converts a stats object to a string in the export format.
 * @param {object} stats - The stats object.
 * @returns {string} The formatted stats string.
 */
export function statsToStringFull(stats) {
    return Object.entries(stats)
        .map(([charName, charStats]) => {
            const attributes = Object.entries(charStats)
                .map(([key, value]) => `${key.toLowerCase()}="${value}"`)
                .join(' ');
            return `<stats character="${charName}" ${attributes} />`;
        })
        .join('\n');
}