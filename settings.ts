import { extension_settings } from "../../../../extensions.js";
import { saveSettingsDebounced } from "../../../../../../../../script.js"
import { fetchAvailableModels } from "./api.js"
import { StatsSettings, TemplateSettings } from "./settings-dtos.js";

export class SuiteSettings {
    offlineMode: boolean;
    modelUrl: string;
    modelName: string;
    autoTrackMessageAuthors: boolean;
    enableAutoRequestStats: boolean;
    alwaysDisabledCharacters: string[];
    showStats: boolean;
    collapseOldStats: boolean;
    anonymizeClipboardExport: boolean;
    stats: StatsSettings;
    templates: TemplateSettings[];
    enableScenes: boolean;

    constructor() {
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
        this.alwaysDisabledCharacters = [];
        this.enableScenes = false;
    }
}

const extensionName = "StatSuite";

export const ExtensionSettings: SuiteSettings = extension_settings[extensionName] ??= new SuiteSettings();
const defaultSettings = new SuiteSettings();

export function shouldRequestStats(charName: string | null): boolean {
    return ExtensionSettings.enableAutoRequestStats && !ExtensionSettings.alwaysDisabledCharacters.includes(charName ?? '');
}

export async function tryGetModels(): Promise<Array<any>> {
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

export async function initializeSettings(): Promise<void> {
    let settingsChanged = false;
    if (Object.keys(ExtensionSettings).length === 0) {
        console.log(`StatSuite: Initializing default settings for ${extensionName}`);
        Object.assign(ExtensionSettings, defaultSettings);
        settingsChanged = true;
    } else {
        for (const key in defaultSettings) {
            const typedKey = key as keyof typeof defaultSettings;

            if (!ExtensionSettings.hasOwnProperty(key)) {
                console.log(`StatSuite: Adding missing default setting key "${key}"`);
                (ExtensionSettings as any)[typedKey] = defaultSettings[typedKey];
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