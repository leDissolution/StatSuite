import { extension_settings } from "../../../../extensions.js";
import { saveSettingsDebounced } from "../../../../../../../../script.js";
import { fetchAvailableModels } from "./api.js";
export class SuiteSettings {
    constructor() {
        Object.defineProperty(this, "offlineMode", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "modelUrl", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "modelName", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "autoTrackMessageAuthors", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "enableAutoRequestStats", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "showStats", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "collapseOldStats", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "anonymizeClipboardExport", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "stats", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "templates", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        this.offlineMode = false;
        this.modelUrl = '';
        this.modelName = '';
        this.autoTrackMessageAuthors = true;
        this.enableAutoRequestStats = true;
        this.showStats = true;
        this.collapseOldStats = true;
        this.anonymizeClipboardExport = true;
        this.stats = { stats: {}, presets: {} };
        this.templates = [];
    }
}
const extensionName = "StatSuite";
export const ExtensionSettings = extension_settings[extensionName] ?? (extension_settings[extensionName] = new SuiteSettings());
const defaultSettings = new SuiteSettings();
export async function tryGetModels() {
    try {
        const models = await fetchAvailableModels();
        if (models.length === 0) {
            console.warn("StatSuite: No models available from the API.");
            toastr.error("StatSuite: No models available from the API.");
            return [];
        }
        return models;
    }
    catch (error) {
        console.error("StatSuite: Failed to connect to the API.", error);
        return [];
    }
}
export async function initializeSettings() {
    let settingsChanged = false;
    if (Object.keys(ExtensionSettings).length === 0) {
        console.log(`StatSuite: Initializing default settings for ${extensionName}`);
        Object.assign(ExtensionSettings, defaultSettings);
        settingsChanged = true;
    }
    else {
        for (const key in defaultSettings) {
            const typedKey = key;
            if (!ExtensionSettings.hasOwnProperty(key)) {
                console.log(`StatSuite: Adding missing default setting key "${key}"`);
                ExtensionSettings[typedKey] = defaultSettings[typedKey];
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
        else {
            toastr.error("StatSuite: Failed to connect to the API. Please check your settings.");
        }
    }
    if (settingsChanged) {
        saveSettingsDebounced();
    }
    console.log(`StatSuite: Settings initialized/verified.`, ExtensionSettings);
}
