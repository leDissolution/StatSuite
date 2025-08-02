// StatSuite API - Handles communication with the external stat generation API
import { ExtensionSettings } from './settings.js';
import { generateStatPrompt } from './prompts.js';
import { statsToStringFull } from './export.js';
import { Stats } from './stats/stats-registry.js';
const API_URL = '{0}/v1/completions';
const LIST_MODELS_URL = '{0}/v1/models';
let connectionFailureDetected = false;
let lastConnectionCheck = 0;
const CONNECTION_CHECK_INTERVAL = 10000; // 10 seconds
/**
 * Quickly tests if the API connection is available.
 * @returns {Promise<boolean>} True if connection is working, false otherwise (or offline).
 */
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
/**
 * Resets the connection failure flag (call this when user wants to retry).
 */
export function resetConnectionFailure() {
    connectionFailureDetected = false;
    lastConnectionCheck = 0;
}
/**
 * Checks if we should skip API calls due to recent connection failures or offline mode.
 * @returns {boolean} True if we should skip API calls.
 */
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
/**
 * Fetches the list of available models from the API.
 * @returns {Promise<Array>} List of available models.
 */
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
/**
 * Generates a specific stat for a character using the external API.
 * @param {string} stat The stat to generate (e.g., from Stats enum).
 * @param {string} char The character name.
 * @param {object} messages Object containing previous/new message details (previousName, previousMessage, newName, newMessage, previousStats).
 * @param {object} existingStats Current stats for the character in the new message, used for dependencies.
 * @param {boolean} greedy Whether to use greedy sampling.
 * @returns {Promise<string>} The generated stat value or an error string (e.g., 'error', 'error_missing_url').
 */
export async function generateStat(stat, char, messages, existingStats = {}, greedy = true) {
    const statConfig = Stats.getStatEntry(stat);
    if (!statConfig) {
        console.error(`StatSuite API Error: StatRegistry not loaded or stat "${stat}" invalid.`);
        return 'error_invalid_config';
    }
    const dependencies = {};
    if (statConfig.dependencies.length > 0) {
        statConfig.dependencies.forEach(dep => {
            if (existingStats && existingStats[dep]) {
                dependencies[dep] = existingStats[dep];
            }
        });
    }
    const statPrompt = generateStatPrompt(stat, char, messages.previousName, messages.previousMessage, messages.newName, messages.newMessage, statsToStringFull(messages.previousStats), dependencies);
    console.log(`Generating ${stat} for ${char}:`, statPrompt);
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
            timeout: 15000, // 15 second timeout to fail faster
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
            return result;
        }
        else {
            console.error(`Error generating ${stat} for ${char}: Invalid API response structure`, response);
            return 'error_invalid_response';
        }
    }
    catch ( /** @type {any} */error) {
        console.error(`Error generating ${stat} for ${char}:`, error);
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
