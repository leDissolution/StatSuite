import { extension_settings } from "../../../extensions.js";
import { saveSettingsDebounced } from "../../../../../../script.js"
import { fetchAvailableModels } from "./api.js"

/**
 * @typedef {Object} StatsSettings
 * @property {Object.<string, any>} stats
 * @property {Object.<string, any>} presets
 */

/**
 * @typedef {Object} TemplateSettings
 * @property {string} name - The template's name
 * @property {string} templateString - The template string to use
 */

/**
 * @implements {SuiteSettings}
 */
export class SuiteSettings {
    constructor() {
        /** @type {boolean} */
        this.offlineMode = false;
        /** @type {string} */
        this.modelUrl = '';
        /** @type {string} */
        this.modelName = '';
        /** @type {boolean} */
        this.autoTrackMessageAuthors = true;
        /** @type {boolean} */
        this.enableAutoRequestStats = true;
        /** @type {boolean} */
        this.showStats = true;
        /** @type {boolean} */
        this.collapseOldStats = true;
        /** @type {boolean} */
        this.anonymizeClipboardExport = true;
        /** @type {StatsSettings} */
        this.stats = { stats: {}, presets: {} };
        /** @type {TemplateSettings[]} */
        this.templates = [];
    }
}

const extensionName = "StatSuite";
/**
 * Global settings registry for StatSuite.
 * @type {SuiteSettings}
 */
export const ExtensionSettings = extension_settings[extensionName] ??= new SuiteSettings();
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
            toastr.error("StatSuite: No models available from the API.");
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

    if (ExtensionSettings.modelUrl && ExtensionSettings.modelUrl !== defaultSettings.modelUrl && !ExtensionSettings.offlineMode) {
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