// export.js
import { generateExportPrompt } from './prompts.js';
import { chat } from '../../../../script.js';

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

export async function exportSingleMessage(messages) {
    if (!messages) return;

    const exportPrompt = generateExportPrompt(
        messages.previousName,
        messages.previousMessage,
        messages.newName,
        messages.newMessage,
        messages.previousStats ? statsToStringFull(messages.previousStats) : '',
        messages.newStats ? statsToStringFull(messages.newStats) : ''
    );
    try {
        await navigator.clipboard.writeText(exportPrompt);
        toastr.success('Message export copied to clipboard');
    } catch (err) {
        console.error('Failed to copy to clipboard:', err);
        toastr.error('Failed to copy to clipboard');
    }
}

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
