// StatSuite - Export utilities for chat and stats
import { generateExportPrompt } from './prompts.js';
import { chat } from '../../../../script.js';
import { ExtensionSettings } from './settings.js';
import { Characters } from './characters/characters_registry.js';
import { StatsBlock } from './stats/stat_block.js';
import { Stats } from './stats/stats_registry.js';
import { substituteParams } from '../../../../script.js';

/**
 * Exports the entire chat (excluding system and bracketed messages) to a downloadable text file.
 * @returns {Promise<void>}
 */
export async function exportChat() {
    const allMessages = chat.filter(c => !c.is_system && !/^\[.*\]$/.test(c.mes));
    const exports = [];
    for (let i = 0; i < allMessages.length; i++) {
        let previousMessage, currentMessage, previousName, previousMes, previousStats;
        currentMessage = allMessages[i];
        if (i === 0) {
            previousName = currentMessage.name;
            previousMes = '';
            previousStats = {};
            if (currentMessage.stats && typeof currentMessage.stats === 'object') {
                Object.keys(currentMessage.stats).forEach(charName => {
                    previousStats[charName] = null;
                });
            } else {
                previousStats[currentMessage.name] = null;
            }
        } else {
            previousMessage = allMessages[i - 1];
            previousName = previousMessage.name;
            previousMes = previousMessage.mes;
            previousStats = previousMessage.stats ? { ...previousMessage.stats } : {};
        }
        const currentStats = currentMessage.stats ? { ...currentMessage.stats } : {};

        // Add missing characters from currentStats to previousStats with null value
        for (const charName of Object.keys(currentStats)) {
            if (!(charName in previousStats)) {
                previousStats[charName] = null;
            }
        }

        const prevStatsString = statsToStringFull(previousStats);
        const currStatsString = statsToStringFull(currentStats);

        if (!prevStatsString && !currStatsString) continue;

        const exportPrompt = generateExportPrompt(
            previousName,
            previousMes,
            currentMessage.name,
            currentMessage.mes,
            prevStatsString,
            currStatsString
        );
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
 * Exports a single message context to the clipboard in export format.
 * @param {object} messages - The message context object.
 * @returns {Promise<void>}
 */
export async function exportSingleMessage(messages) {
    if (!messages) return;
    let previousStats = messages.previousStats ? { ...messages.previousStats } : {};
    let newStats = messages.newStats ? { ...messages.newStats } : {};

    let filteredPreviousStats = {};
    for (const charName of Object.keys(newStats)) {
        filteredPreviousStats[charName] = previousStats[charName] !== undefined ? previousStats[charName] : null;
    }

    let exportPrompt = generateExportPrompt(
        messages.previousName,
        messages.previousMessage,
        messages.newName,
        messages.newMessage,
        statsToStringFull(filteredPreviousStats),
        statsToStringFull(newStats)
    );

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
    } catch (err) {
        console.error('Failed to copy to clipboard:', err);
        toastr.error('Failed to copy to clipboard');
    }
}

/**
 * Converts a StatsBlock into string.
 * @param {StatsBlock} stats - The stats object.
 * @returns {string} The formatted stats string.
 */
export function statsToString(name, stats) {
    if (!stats) return '';
    
    const attributes = Object.entries(stats)
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
 * @param {object} stats - The stats object.
 * @returns {string} The formatted stats string.
 */
export function statsToStringFull(stats) {
    return Object.entries(stats)
        .map(([charName, charStats]) => {
            if (charStats) {
                return statsToString(charName, charStats);
            }
            else {
                const description = characterDescription(charName);
                const defaultStats = new StatsBlock();
                Stats.getActiveStats().forEach(stat => {
                    if (charStats?.[stat] !== undefined) {
                        defaultStats.set(stat, charStats[stat]);
                    }
                    else {
                        defaultStats.set(stat, Stats.getStatConfig(stat).defaultValue);
                    }
                });
                return statsToString(charName, defaultStats) + description;
            }
        })
        .join('\n');
}