// StatSuite - Preset management for stat activation states
import { ExtensionSettings } from '../settings.js';
import { saveSettingsDebounced } from '../../../../../script.js';

export class StatPreset {
    constructor({ name, displayName, active, manual, defaultValue }) {
        /** @type {string} */
        this.name = name;
        /** @type {string} */
        this.displayName = displayName;
        /** @type {boolean} */
        this.active = active;
        /** @type {boolean} */
        this.manual = manual;
        /** @type {string} */
        this.defaultValue = defaultValue;
    }
}

/**
 * Class representing a stats preset (activation states for all stats).
 */
export class StatsPreset {
    /**
     * @param {string} name - The name of the preset
     * @param {Object.<string, StatPreset>} [stats] - Optional map of stat presets
     */
    constructor(name, stats = {}) {
        /** @type {string} */
        this.name = name;
        /** @type {Object.<string, StatPreset>} */
        this.stats = stats;
    }

    /**
     * Get a stat preset by name
     * @param {string} name - The name of the stat preset
     * @returns {StatPreset} The stat preset
     */
    get(name) {
        return this.stats[name] || null;
    }

    /**
     * Set a stat preset
     * @param {StatPreset} preset - The stat preset to set
     */
    set(preset) {
        if (!this.stats[preset.name]) {
            this.stats[preset.name] = new StatPreset({
                name: preset.name,
                displayName: preset.displayName || preset.name,
                active: preset.active || false,
                manual: preset.manual || false,
                defaultValue: preset.defaultValue || 'unspecified'
            });
        } else {
            this.stats[preset.name].active = preset.active;
            this.stats[preset.name].manual = preset.manual;
            this.stats[preset.name].displayName = preset.displayName || this.stats[preset.name].displayName;
            this.stats[preset.name].defaultValue = preset.defaultValue || this.stats[preset.name].defaultValue;
        }
    }
}

/**
 * PresetRegistry: Singleton for managing stat activation presets
 */
export class PresetRegistry {
    constructor() {
        /** @type {Object.<string, StatsPreset>} */
        this.presets = {};
        this.selectedPreset = 'default';
    }

    loadFromMetadata() {
        this.presets = {};
        
        if (ExtensionSettings.stats && ExtensionSettings.stats.presets) {
            Object.entries(ExtensionSettings.stats.presets).forEach(([presetName, presetData]) => {
                const preset = new StatsPreset(presetName);
                Object.entries(presetData.stats || {}).forEach(([statName, statData]) => {
                    preset.set(new StatPreset({
                        name: statName,
                        displayName: statData.displayName || statName,
                        active: statData.active || false,
                        manual: statData.manual || false,
                        defaultValue: statData.defaultValue || 'unspecified'
                    }));
                });
                this.presets[presetName] = preset;
            });
        }
        
        if (!this.presets['default']) {
            this.presets['default'] = new StatsPreset('default', {});
        }
    }

    saveToMetadata() {
        if (!ExtensionSettings.stats) ExtensionSettings.stats = {};
        
        const presetsData = {};
        Object.entries(this.presets).forEach(([name, preset]) => {
            presetsData[name] = {
                name: preset.name,
                stats: preset.stats
            };
        });
        
        ExtensionSettings.stats.presets = presetsData;
        saveSettingsDebounced();
    }


    /**
     * Get all stat presets
     * @returns {Record<string, StatsPreset>} presets by name
     */
    getAllPresets() {
        return this.presets;
    }

    /**
     * Get a single preset by name
     * @param {string} name
     * @returns {StatsPreset|null}
     */
    getPreset(name) {
        return this.presets[name] || null;
    }

    /**
     * Get current active preset
     * @return {StatsPreset} The active preset, or a default if none is set
     */
    getActivePreset() {
        return this.getPreset(this.selectedPreset) || new StatsPreset(this.selectedPreset, {});
    }

    setActivePreset(name) {
        if (this.presets[name]) {
            this.selectedPreset = name;
        }
    }

    /**
     * Add a preset to the registry
     * @param {StatsPreset} preset - The preset to add
     */
    addPreset(preset) {
        this.presets[preset.name] = preset;
        this.saveToMetadata();
    }

    /**
     * Delete a stat preset by name
     * @param {string} name
     */
    deletePreset(name) {
        if (name === 'default') {
            console.warn('Cannot delete default preset');
            return;
        }
        
        if (this.presets[name]) {
            delete this.presets[name];
            this.saveToMetadata();
        }
    }
}

export const Presets = new PresetRegistry();
