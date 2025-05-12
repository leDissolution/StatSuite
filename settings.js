import { extension_settings } from "../../../extensions.js";
import { saveSettingsDebounced } from "../../../../../../script.js"

const extensionName = "StatSuite";

export class SuiteSettings {
    constructor() {
        this.modelUrl = '';
        this.autoTrackMessageAuthors = true;
        this.enableAutoRequestStats = true;
        this.showStats = true;
        this.collapseOldStats = true;
    }
}

export const ExtensionSettings = extension_settings[extensionName] || new SuiteSettings();
const defaultSettings = new SuiteSettings();

export function initializeSettings() {
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

    if (settingsChanged) {
        saveSettingsDebounced();
    }

    console.log(`StatSuite: Settings initialized/verified.`, ExtensionSettings);
}

export function updateSetting(key, value) {
    if (ExtensionSettings.hasOwnProperty(key)) {
        ExtensionSettings[key] = value;
        saveSettingsDebounced();
        console.log(`StatSuite: Setting "${key}" updated.`);
    } else {
        console.warn(`StatSuite: Attempted to update unknown setting "${key}".`);
    }
}