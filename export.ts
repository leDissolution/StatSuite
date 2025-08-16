// StatSuite - Export utilities for chat and stats
import { generateExportPrompt } from './prompts.js';
import { ExtensionSettings } from './settings.js';
import { Characters } from './characters/characters-registry.js';
import { StatsBlock } from './stats/stat-block.js';
import { Stats } from './stats/stats-registry.js';
import { substituteParams } from '../../../../../script.js';
import { Chat, MessageContext } from './chat/chat-manager.js';
import { ChatStatEntry } from './chat/chat-stat-entry.js';
import { StatScope } from './stats/stat-entry.js';
import { Scenes } from './scenes/scene-registry.js';

export async function exportChat(): Promise<void> {
    const exportableMessages = Chat.getStatEligibleMessages();
    const exports: Array<string> = [];
    
    for (let i = 0; i < exportableMessages.length; i++) {
        const { message: currentMessage, index: currentIndex } = exportableMessages[i]!;
        
        let previousName: string, previousMes: string;
        let previousStats: ChatStatEntry;

        const currentStats = Chat.getMessageStats(currentIndex);

        if (!currentStats) {
            continue; // Skip if no stats or invalid stats
        }

        if (i === 0) {
            previousName = currentMessage.name;
            previousMes = '';
            previousStats = new ChatStatEntry();
        } else {
            const { message: previousMessage, index: previousIndex } = exportableMessages[i - 1]!;
            previousName = previousMessage.name;
            previousMes = previousMessage.mes;
            previousStats = Chat.getMessageStats(previousIndex) ?? new ChatStatEntry();
        }

        // Add missing characters from currentStats to previousStats with null value
        for (const charName of Object.keys(currentStats.Characters)) {
            if (!(charName in previousStats.Characters)) {
                previousStats.Characters[charName] = null;
            }
        }
        for (const sceneName of Object.keys(currentStats.Scenes)) {
            if (!(sceneName in previousStats.Scenes)) {
                previousStats.Scenes[sceneName] = Scenes.getLatestSceneStats(sceneName, currentIndex);
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

export async function exportSingleMessage(messageContext: MessageContext): Promise<void> {
    if (!messageContext) return;
    let previousStats = messageContext.previousStats ?? new ChatStatEntry();
    let newStats = messageContext.newStats ?? new ChatStatEntry();

    let filteredPreviousStats = new ChatStatEntry();
    for (const charName of Object.keys(newStats.Characters)) {
        filteredPreviousStats.Characters[charName] = previousStats.Characters?.[charName] !== undefined ? previousStats.Characters?.[charName] : null;
    }
    for (const sceneName of Object.keys(newStats.Scenes)) {
        filteredPreviousStats.Scenes[sceneName] = previousStats.Scenes?.[sceneName] !== undefined ? previousStats.Scenes?.[sceneName] : Scenes.getLatestSceneStats(sceneName, messageContext.previousIndex);
    }

    let exportPrompt = generateExportPrompt(
        messageContext.previousName ?? '',
        messageContext.previousMessage ?? '',
        messageContext.newName ?? '',
        messageContext.newMessage ?? '',
        statsToStringFull(filteredPreviousStats),
        statsToStringFull(newStats)
    );

    if (ExtensionSettings.anonymizeClipboardExport) {
        let characterMap: Record<string, string> = {};
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

export function statsToString(name: string, statsBlock: StatsBlock, subject: string): string {
    const attributes = Object.entries(statsBlock)
        .map(([key, value]) => {
            let strValue = String(value)
                .replace(/\\/g, "\\\\")
                .replace(/"/g, '\\"');
            return `${key.toLowerCase()}="${strValue}"`;
        })
        .join(' ');

    return `<stats ${subject}="${name}" ${attributes} />`;
}

export function characterDescription(name: string): string {
    let description = '';

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

export function statsToStringFull(stats: ChatStatEntry | null): string {
    if (!stats) return '';

    const chars = Object.entries(stats.Characters)
        .map(([charName, stats]) => {
            const hadNoStats = !stats;
            const block = stats ?? new StatsBlock();

            for (const statEntry of Stats.getActiveStats(StatScope.Character)) {
                if (block[statEntry.name] === undefined) {
                    block[statEntry.name] = statEntry.defaultValue;
                }
            }

            const base = statsToString(charName, block, StatScope.Character);
            return hadNoStats ? base + characterDescription(charName) : base;
        })
        .join('\n');

    const scenes = Object.entries(stats.Scenes)
        .map(([sceneName, stats]) => {
            const block = stats ?? new StatsBlock();

            for (const statEntry of Stats.getActiveStats(StatScope.Scene)) {
                if (block[statEntry.name] === undefined) {
                    block[statEntry.name] = statEntry.defaultValue;
                }
            }

            return statsToString(sceneName, block, StatScope.Scene);
        })
        .join('\n');

    return scenes + '\n' + chars;
}