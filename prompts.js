import { Stats } from './stats_logic.js'; // Added for refactoring

export const ChatMLTokens = Object.freeze({
    START: '<|im_start|>',
    END: '<|im_end|>',
    ROLES: {
        SYSTEM: 'system',
        USER: 'user',
        ASSISTANT: 'assistant'
    }
});


const NON_INSTRUCT_TEMPLATE = `<previousMessage from="{previous_from}"">{previous_message}</previousMessage>
{previous_stats}
<message from="{name}">{message}</message>
<stats character="{req_name}" {existingNewStats}{stat}="`

const EXPORT_TEMPLATE = `<previousMessage from="{previous_from}">{previous_message}</previousMessage>
{previous_stats}
<message from="{name}">{message}</message>
{new_stats}`

export function generateStatPrompt(stat, reqName, previousName, previousMessage, name, message, previousStats, existingNewStats) {
    let existingNewStatsString = "";

    if (existingNewStats) {
        existingNewStatsString = Object.entries(existingNewStats)
            .map(([key, value]) => `${key.toLowerCase()}="${value}"`)
            .join(' ') + ' ';
    } else {
        existingNewStatsString = '';
    }

    const userPrompt = NON_INSTRUCT_TEMPLATE.replace('{previous_from}', previousName)
        .replace('{previous_message}', previousMessage || '')
        .replace('{previous_stats}', previousStats || '')
        .replace('{name}', name)
        .replace('{message}', message || '')
        .replace('{req_name}', reqName)
        .replace('{existingNewStats}', existingNewStatsString)
        .replace('{stat}', stat);

    return userPrompt;
}

export function generateExportPrompt(previousName, previousMessage, name, message, previousStats, newStats) {
    const exportPrompt = EXPORT_TEMPLATE.replace('{previous_from}', previousName)
        .replace('{previous_message}', previousMessage || '')
        .replace('{previous_stats}', previousStats || '')
        .replace('{name}', name)
        .replace('{message}', message || '')
        .replace('{new_stats}', newStats);
    return exportPrompt;
}
