// StatSuite - Preset management for stat activation states
import { ExtensionSettings } from '../settings.js';
import { saveSettingsDebounced } from '../../../../../script.js';

/**
 * Represents a preset of stat activation states.
 * @typedef {Object} StatsPresetOptions
 * @property {string} name - The name of the preset
 * @property {Object.<string, boolean>} statActiveMap - Map of stat name to isActive
 */

/**
 * Class representing a stats preset (activation states for all stats).
 */
export class StatsPreset {
    /**
     * @param {string} name - The name of the preset
     * @param {Object.<string, boolean>} statActiveMap - Map of stat name to isActive
     */
    constructor(name, statActiveMap = {}) {
        /** @type {string} */
        this.name = name;
        /** @type {Object.<string, boolean>} */
        this.statActiveMap = { ...statActiveMap };
    }
}

/**
 * PresetRegistry: Singleton for managing stat activation presets
 */
class PresetRegistry {
    constructor() {
        // No instance state; all data is in ExtensionSettings
    }

    /**
     * Get all stat presets from ExtensionSettings.statsSettings.presets
     * @returns {Record<string, StatsPreset>} presets by name
     */
    getAllPresets() {
        if (!ExtensionSettings.statsSettings) ExtensionSettings.statsSettings = {};
        if (!ExtensionSettings.statsSettings.presets) ExtensionSettings.statsSettings.presets = {};
        return ExtensionSettings.statsSettings.presets;
    }

    /**
     * Get a single preset by name
     * @param {string} name
     * @returns {StatsPreset|null}
     */
    getPreset(name) {
        const all = this.getAllPresets();
        return all[name] || null;
    }

    /**
     * Save or update a stat preset by name
     * @param {StatsPreset} preset
     */
    savePreset(preset) {
        if (!ExtensionSettings.statsSettings) ExtensionSettings.statsSettings = {};
        if (!ExtensionSettings.statsSettings.presets) ExtensionSettings.statsSettings.presets = {};
        ExtensionSettings.statsSettings.presets[preset.name] = {
            name: preset.name,
            statActiveMap: { ...preset.statActiveMap }
        };
        saveSettingsDebounced();
    }

    /**
     * Delete a stat preset by name
     * @param {string} name
     */
    deletePreset(name) {
        if (!ExtensionSettings.statsSettings?.presets) return;
        delete ExtensionSettings.statsSettings.presets[name];
        saveSettingsDebounced();
    }
}

export const Presets = new PresetRegistry();
