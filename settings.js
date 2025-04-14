import { extension_settings } from "../../../extensions.js";
import { saveSettingsDebounced } from "../../../../../../script.js"

const extensionName = "StatSuite";

export const extensionSettings = extension_settings[extensionName] || {};

export const defaultSettings = {
    modelUrl: '',
    autoTrackMessageAuthors: true,
    disableAutoRequestStats: false,
};

export function initializeSettings() {
    let settingsChanged = false;
    if (Object.keys(extensionSettings).length === 0) {
        console.log(`StatSuite: Initializing default settings for ${extensionName}`);
        Object.assign(extensionSettings, defaultSettings);
        settingsChanged = true;
    } else {
        for (const key in defaultSettings) {
            if (!extensionSettings.hasOwnProperty(key)) {
                console.log(`StatSuite: Adding missing default setting key "${key}"`);
                extensionSettings[key] = defaultSettings[key];
                settingsChanged = true;
            }
        }
    }


    console.log(`StatSuite: Settings initialized/verified.`, extensionSettings);
}

export function updateSetting(key, value) {
    if (extensionSettings.hasOwnProperty(key)) {
        extensionSettings[key] = value;
        saveSettingsDebounced();
        console.log(`StatSuite: Setting "${key}" updated.`);
    } else {
        console.warn(`StatSuite: Attempted to update unknown setting "${key}".`);
    }
}
