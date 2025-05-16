import { extension_settings } from "../../../extensions.js";
import { saveSettingsDebounced, chat_metadata } from "../../../../../../script.js"
import { fetchAvailableModels } from "./api.js"
import { addCustomStat } from './stats_logic.js';
import { onChatChanged } from "./events.js";

const extensionName = "StatSuite";

export class SuiteSettings {
    constructor() {
        this.modelUrl = '';
        this.modelName = '';
        this.autoTrackMessageAuthors = true;
        this.enableAutoRequestStats = true;
        this.showStats = true;
        this.collapseOldStats = true;
        this.anonymizeClipboardExport = true;
    }
}

export const ExtensionSettings = extension_settings[extensionName] || new SuiteSettings();
const defaultSettings = new SuiteSettings();

/**
 * Attempts to fetch available models from the API and handles errors.
 * @returns {Promise<Array>} List of available models or empty array on failure.
 */
export async function tryGetModels() {
    try {
        const models = await fetchAvailableModels();
        if (models.length === 0) {
            console.warn("StatSuite: No models available from the API.");
            toast.error("StatSuite: No models available from the API.");
            return [];
        }
        return models;
    } catch (error) {
        console.error("StatSuite: Failed to connect to the API.", error);
        return [];
    }
}

/**
 * Initializes StatSuite settings, applying defaults and verifying model selection.
 * @returns {Promise<void>}
 */
export async function initializeSettings() {
    let settingsChanged = false;
    if (Object.keys(ExtensionSettings).length === 0) {
        console.log(`StatSuite: Initializing default settings for ${extensionName}`);
        Object.assign(ExtensionSettings, defaultSettings);
        settingsChanged = true;
    } else {
        for (const key in defaultSettings) {
            if (!ExtensionSettings.hasOwnProperty(key)) {
                console.log(`StatSuite: Adding missing default setting key "${key}"`);
                ExtensionSettings[key] = defaultSettings[key];
                settingsChanged = true;
            }
        }
    }
    if (ExtensionSettings.modelUrl && ExtensionSettings.modelUrl !== defaultSettings.modelUrl) {
        const models = await tryGetModels();
        if (models.length > 0) {
            if (!ExtensionSettings.modelName || !models.includes(ExtensionSettings.modelName)) {
                ExtensionSettings.modelName = models[0].id;
                settingsChanged = true;
            }
        }
        else
        {
            toastr.error("StatSuite: Failed to connect to the API. Please check your settings.");
        }
    }
    if (settingsChanged) {
        saveSettingsDebounced();
    }
    // Load custom stats after settings are initialized
    loadCustomStatsFromChat();
    console.log(`StatSuite: Settings initialized/verified.`, ExtensionSettings);
}

/**
 * Updates a single setting and persists the change.
 * @param {string} key - The setting key to update.
 * @param {*} value - The new value for the setting.
 */
export function updateSetting(key, value) {
    if (ExtensionSettings.hasOwnProperty(key)) {
        ExtensionSettings[key] = value;
        saveSettingsDebounced();
        console.log(`StatSuite: Setting "${key}" updated.`);
    } else {
        console.warn(`StatSuite: Attempted to update unknown setting "${key}".`);
    }
}

/**
 * Gets the custom stats array for the current chat from chat_metadata.
 * @returns {Array<{key: string, config: object}>}
 */
export function getCustomStatsForChat() {
    if (!chat_metadata.StatSuite) chat_metadata.StatSuite = {};
    if (!Array.isArray(chat_metadata.StatSuite.customStats)) chat_metadata.StatSuite.customStats = [];
    return chat_metadata.StatSuite.customStats;
}

/**
 * Adds a custom stat to the current chat and saves.
 * @param {string} key - Stat key (lowercase, no spaces)
 * @param {object} config - Stat config object
 */
export function addCustomStatToChat(key, config) {
    const arr = getCustomStatsForChat();
    if (arr.some(s => s.key === key)) return false;
    arr.push({ key, config });
    if (typeof saveMetadataDebounced === 'function') saveMetadataDebounced();
    onChatChanged();
    return true;
}

/**
 * Removes a custom stat from the current chat and saves.
 * @param {string} key - Stat key to remove
 */
export function removeCustomStatFromChat(key) {
    const arr = getCustomStatsForChat();
    const idx = arr.findIndex(s => s.key === key);
    if (idx === -1) return false;
    arr.splice(idx, 1);
    if (typeof saveMetadataDebounced === 'function') saveMetadataDebounced();
    onChatChanged();
    return true;
}

/**
 * Loads all custom stats from the current chat into StatSuite.
 */
export function loadCustomStatsFromChat() {
    const arr = getCustomStatsForChat();
    for (const { key, config } of arr) {
        addCustomStat(key, config);
    }
}