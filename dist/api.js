// StatSuite API - Handles communication with the external stat generation API
import { ExtensionSettings } from './settings.js';
import { generateStatPrompt } from './prompts.js';
import { statsToString, statsToStringFull } from './export.js';
import { Stats } from './stats/stats-registry.js';
import { StatScope } from './stats/stat-entry.js';
const API_URL = '{0}/v1/completions';
const LIST_MODELS_URL = '{0}/v1/models';
let connectionFailureDetected = false;
let lastConnectionCheck = 0;
const CONNECTION_CHECK_INTERVAL = 10000;
export async function checkApiConnection() {
    if (ExtensionSettings.offlineMode) {
        return false;
    }
    if (!ExtensionSettings.modelUrl) {
        console.error('StatSuite API Error: Model URL is not set in settings.');
        return false;
    }
    try {
        const response = await $.ajax({
            url: LIST_MODELS_URL.replace('{0}', ExtensionSettings.modelUrl),
            method: 'GET',
            timeout: 500,
            dataType: 'json'
        });
        connectionFailureDetected = false;
        lastConnectionCheck = Date.now();
        return response && response.data;
    }
    catch (error) {
        console.error('StatSuite API Error: Connection check failed.', error);
        connectionFailureDetected = true;
        lastConnectionCheck = Date.now();
        return false;
    }
}
export function resetConnectionFailure() {
    connectionFailureDetected = false;
    lastConnectionCheck = 0;
}
export function shouldSkipApiCalls() {
    if (ExtensionSettings.offlineMode) {
        return true;
    }
    const now = Date.now();
    if (now - lastConnectionCheck > CONNECTION_CHECK_INTERVAL) {
        connectionFailureDetected = false;
        return false;
    }
    return connectionFailureDetected;
}
export async function fetchAvailableModels() {
    if (!ExtensionSettings.modelUrl) {
        console.error('StatSuite API Error: Model URL is not set in settings.');
        return [];
    }
    try {
        const response = await $.get(LIST_MODELS_URL.replace('{0}', ExtensionSettings.modelUrl));
        if (response && response.data) {
            return response.data;
        }
        else {
            console.error('StatSuite API Error: Invalid response structure from model listing.');
            return [];
        }
    }
    catch (error) {
        console.error('StatSuite API Error: Failed to fetch available models.', error);
        throw error;
    }
}
const noop_token = '!!no_change!!';
export async function generateStat(stat, subject, messages, existingStats, greedy = true) {
    const statConfig = Stats.getStatEntry(stat);
    if (!statConfig) {
        console.error(`StatSuite API Error: StatRegistry not loaded or stat "${stat}" invalid.`);
        return 'error_invalid_config';
    }
    const dependencies = {};
    if (statConfig.dependencies.length > 0) {
        statConfig.dependencies.forEach(dep => {
            const existingValue = existingStats[dep];
            if (existingValue) {
                dependencies[dep] = existingValue;
            }
        });
    }
    const subjectAttr = statConfig.scope === StatScope.Scene ? 'scene' : 'character';
    let contextStr = '';
    if (statConfig.scope === StatScope.Scene) {
        let statStrings = [];
        if (messages.newStats?.Characters) {
            for (const [char, stats] of Object.entries(messages.newStats.Characters)) {
                if (stats) {
                    statStrings.push(statsToString(char, stats, StatScope.Character));
                }
            }
        }
        contextStr = `\n${statStrings.join('\n')}`;
    }
    const statPrompt = generateStatPrompt(stat, subject, messages.previousName ?? '', messages.previousMessage ?? '', messages.newName ?? '', messages.newMessage ?? '', statsToStringFull(messages.previousStats), contextStr, dependencies, subjectAttr);
    console.log(`Generating ${stat} for ${subject}:`, statPrompt);
    try {
        if (!ExtensionSettings.modelUrl) {
            console.error('StatSuite API Error: Model URL is not set in settings.');
            return 'error_missing_url';
        }
        const response = await $.ajax({
            url: API_URL.replace('{0}', ExtensionSettings.modelUrl),
            method: 'POST',
            contentType: 'application/json',
            dataType: 'json',
            timeout: 60000,
            data: JSON.stringify({
                model: ExtensionSettings.modelName,
                prompt: statPrompt,
                temperature: greedy ? 0 : 1,
                top_p: 1
            })
        });
        if (response && response.choices && response.choices.length > 0 && typeof response.choices[0].text === 'string') {
            const text = response.choices[0].text;
            const quoteMatch = text.match(/(?<!\\)"/);
            const quoteIndex = quoteMatch ? quoteMatch.index : -1;
            let result = quoteIndex !== -1 ? text.substring(0, quoteIndex).trim() : text.trim();
            // unescape quotes and backslashes
            result = result.replace(/\\"/g, '"').replace(/\\\\/g, '\\');
            if (result === noop_token) {
                result = messages.previousStats?.Characters[subject]?.[stat] ?? Stats.getStatEntry(stat)?.defaultValue ?? '';
            }
            return result;
        }
        else {
            console.error(`Error generating ${stat} for ${subject}: Invalid API response structure`, response);
            return 'error_invalid_response';
        }
    }
    catch ( /** @type {any} */error) {
        console.error(`Error generating ${stat} for ${subject}:`, error);
        // Mark connection as failed for quick bailout in subsequent calls
        if (error.status === 0 || error.statusText === 'timeout' || error.readyState === 0) {
            connectionFailureDetected = true;
            lastConnectionCheck = Date.now();
        }
        let errorType = 'error_api_call_failed';
        if (error.status === 404)
            errorType = 'error_model_not_found';
        if (error.status === 0)
            errorType = 'error_network_or_cors';
        return errorType;
    }
}
