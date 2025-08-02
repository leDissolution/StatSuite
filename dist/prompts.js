// StatSuite - Prompt template utilities for stat and export generation
const NON_INSTRUCT_TEMPLATE = `<previousMessage from="{previous_from}">{previous_message}</previousMessage>
{previous_stats}
<message from="{name}">{message}</message>
<stats character="{req_name}" {existingNewStats}{stat}="`;
const EXPORT_TEMPLATE = `<previousMessage from="{previous_from}">{previous_message}</previousMessage>
{previous_stats}
<message from="{name}">{message}</message>
{new_stats}`;
/**
 * Generates a prompt for stat generation using the provided context.
 * @param {string} stat - The stat to generate.
 * @param {string} reqName - The character name for the stat.
 * @param {string} previousName - The previous message's author.
 * @param {string} previousMessage - The previous message content.
 * @param {string} name - The current message's author.
 * @param {string} message - The current message content.
 * @param {string} previousStats - The previous stats string.
 * @param {object} existingNewStats - Existing stats for the new message (dependencies).
 * @returns {string} The generated prompt string.
 */
export function generateStatPrompt(stat, reqName, previousName, previousMessage, name, message, previousStats, existingNewStats) {
    let existingNewStatsString = "";
    if (existingNewStats) {
        existingNewStatsString = Object.entries(existingNewStats)
            .map(([key, value]) => `${key.toLowerCase()}="${value}"`)
            .join(' ') + ' ';
    }
    else {
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
/**
 * Generates a prompt for exporting stats using the provided context.
 * @param {string} previousName - The previous message's author.
 * @param {string} previousMessage - The previous message content.
 * @param {string} name - The current message's author.
 * @param {string} message - The current message content.
 * @param {string} previousStats - The previous stats string.
 * @param {string} newStats - The new stats string.
 * @returns {string} The generated export prompt string.
 */
export function generateExportPrompt(previousName, previousMessage, name, message, previousStats, newStats) {
    const exportPrompt = EXPORT_TEMPLATE.replace('{previous_from}', previousName)
        .replace('{previous_message}', previousMessage || '')
        .replace('{previous_stats}', previousStats || '')
        .replace('{name}', name)
        .replace('{message}', message || '')
        .replace('{new_stats}', newStats);
    return exportPrompt;
}
