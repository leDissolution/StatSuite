// StatSuite - StatRegistry: Manages stat definitions, dependencies, and persistence per chat
import { EVENT_STAT_ADDED, EVENT_STAT_REMOVED, EVENT_STATS_BATCH_LOADED } from '../events.js';
import { saveSettingsDebounced } from '../../../../../script.js';
import { saveMetadataDebounced } from '../../../../extensions.js';
import { ExtensionSettings } from '../settings.js';
import { Presets, StatPreset } from './presets-registry.js';

/**
 * @typedef {Object} StatEntryOptions
 * @property {string} defaultValue - The default value for the stat
 * @property {string} [displayName=''] - The display name for the stat
 * @property {string[]} dependencies - Array of stat names this stat depends on
 * @property {number} order - Display order for the stat
 * @property {boolean} [isCustom=false] - Whether this is a custom user-defined stat
 * @property {boolean} [isActive=true] - Whether this stat is currently active
 * @property {boolean} [isManual=false] - Whether this stat requires manual input
 */

/**
 * @typedef {Object} StatConfig
 * @property {string[]} [dependencies] - Array of stat names this stat depends on
 * @property {number} [order] - Display order for the stat
 * @property {string} [defaultValue] - The default value for the stat
 * @property {string} [displayName] - The display name for the stat
 * @property {boolean} [isCustom] - Whether this is a custom user-defined stat
 * @property {boolean} [isActive] - Whether this stat is currently active
 * @property {boolean} [isManual] - Whether this stat requires manual input
 */

/**
 * Represents a single stat entry with its configuration
 */
class StatEntry {
    /**
     * @param {string} name - The name of the stat
     * @param {StatEntryOptions} options - Configuration options for the stat
     */
    constructor(name, { defaultValue, dependencies, order, displayName = '', isCustom = false, isActive = true, isManual = false }) {
        /** @type {string} */
        this.name = name;
        /** @type {string} */
        this.displayName = (!displayName || displayName.trim() === '') ? name : displayName;
        /** @type {string} */
        this.defaultValue = defaultValue;
        /** @type {string[]} */
        this.dependencies = dependencies;
        /** @type {number} */
        this.order = order;
        /** @type {boolean} */
        this.isCustom = isCustom;
        /** @type {boolean} */
        this.isActive = isActive;
        /** @type {boolean} */
        this.isManual = isManual;
    }
}

/** @type {StatEntry[]} */
const DEFAULT_STATS = [
    new StatEntry('pose', { dependencies: [], order: 0, defaultValue: 'unspecified', isActive: true }),
    new StatEntry('location', { dependencies: ['pose'], order: 1, defaultValue: 'unspecified', isActive: true }),
    new StatEntry('outfit', { dependencies: [], order: 2, defaultValue: 'unspecified', isActive: true }),
    new StatEntry('exposure', { dependencies: ['outfit'], order: 3, defaultValue: 'none', isActive: true }),
    new StatEntry('accessories', { dependencies: ['outfit'], order: 4, defaultValue: 'unspecified', isActive: true }),
    new StatEntry('bodyState', { dependencies: [], order: 5, defaultValue: 'normal', isActive: false }),
    new StatEntry('mood', { dependencies: [], order: 6, defaultValue: 'neutral', isActive: false }),
];

/**
 * Manages the registry of stats (official + custom) and synchronizes with chat metadata.
 */
export class StatRegistry {
    constructor() {
        /** @type {Record<string, StatEntry>} */
        this._stats = {};
        /** @type {EventTarget} */
        this._eventTarget = new EventTarget();
    }

    /**
     * Initializes the stat registry from chat metadata.
     * Loads stored stats and syncs with default stat configurations.
     * @returns {void}
     */
    initializeFromMetadata() {
        const preset = Presets.getActivePreset();

        if (ExtensionSettings.stats && ExtensionSettings.stats.stats) {
            Object.entries(ExtensionSettings.stats.stats).forEach(([statName, stat]) => {
                if (stat && statName && !this._stats[statName]) {
                    let statPreset = preset.get(statName);

                    if (!statPreset) {
                        if (!stat.isCustom) {
                            const defaultStat = DEFAULT_STATS.find(s => s.name === statName);
                            if (defaultStat) {
                                statPreset = {
                                    name: defaultStat.name,
                                    displayName: defaultStat.displayName,
                                    active: defaultStat.isActive,
                                    manual: defaultStat.isManual,
                                    defaultValue: defaultStat.defaultValue || 'unspecified'
                                };
                            }
                        }

                        if (!statPreset) {
                            console.warn(`StatSuite Warning: Stat "${stat.name}" not found in presets. Using default configuration.`);
                            statPreset = {
                                name: stat.name,
                                displayName: stat.name,
                                active: false,
                                manual: false,
                                defaultValue: 'unspecified'
                            };
                        }
                    }

                    this._addStatEntryInternal({
                        name: stat.name,
                        dependencies: stat.dependencies || [],
                        order: stat.order,
                        isCustom: stat.isCustom,
                        isActive: statPreset.active,
                        isManual: statPreset.manual,
                        defaultValue: statPreset.defaultValue || 'unspecified',
                        displayName: statPreset.displayName || stat.name
                    });
                }
            });
        }

        this.applyPreset(preset.name);

        DEFAULT_STATS.forEach(stat => {
            if (!this._stats[stat.name]) {
                this._addStatEntryInternal(stat);
            }

            this._stats[stat.name].isCustom = false;
            this._stats[stat.name].defaultValue = stat.defaultValue;

            const statPreset = preset.get(stat.name);
            if (statPreset) {
                statPreset.defaultValue = stat.defaultValue;
            }
        });

        this._eventTarget.dispatchEvent(new CustomEvent(EVENT_STATS_BATCH_LOADED, {
            detail: { statNames: Object.keys(this._stats) }
        }));
    }

    /**
     * Saves the current stat registry to chat metadata.
     * @returns {void}
     */
    saveToMetadata() {
        if (!ExtensionSettings.stats) ExtensionSettings.stats = { stats: {}, presets: {} };
        if (!ExtensionSettings.stats.stats) ExtensionSettings.stats.stats = {};
        
        // Save basic stat configuration (structure only)
        ExtensionSettings.stats.stats = {};
        this.getAllStats().forEach(stat => {
            ExtensionSettings.stats.stats[stat.name] = {
                name: stat.name,
                dependencies: stat.dependencies,
                order: stat.order,
                isCustom: stat.isCustom
            };
        });

        // Save activation states and display settings to the active preset
        const preset = Presets.getActivePreset();
        this.getAllStats().forEach(stat => {
            preset.set(new StatPreset({
                name: stat.name,
                displayName: stat.displayName,
                active: stat.isActive,
                manual: stat.isManual,
                defaultValue: stat.defaultValue
            }));
        });

        Presets.saveToMetadata();
        saveSettingsDebounced();

        if (saveMetadataDebounced) saveMetadataDebounced();
    }

    /**
     * Adds a stat entry to the registry.
     * @param {StatEntry | any} entry - The stat entry to add
     * @returns {boolean} True if successfully added, false otherwise
     */
    addStatEntry(entry) {
        if (!entry || !(entry.name)) return false;
        /** @type {string} */
        const name = entry.name;
        if (this._stats[name]) return false;
        
        try {
            this.addStat(name, {
                dependencies: entry.dependencies,
                order: entry.order,
                defaultValue: entry.defaultValue,
                isCustom: entry.isCustom,
                isActive: entry.isActive,
                isManual: entry.isManual
            });

            this.saveToMetadata();
            this._eventTarget.dispatchEvent(new CustomEvent(EVENT_STAT_ADDED, { detail: name }));
        } catch (error) {
            console.error("StatSuite Error: Failed to add stat entry.", error);
            return false;
        }
        return true;
    }

    /**
     * Adds a new stat to the registry with the given configuration.
     * @param {string} key - The unique key/name for the stat
     * @param {StatConfig} config - Configuration options for the stat
     * @returns {boolean} True if successfully added, false otherwise
     */
    addStat(key, config) {
        if (!key || typeof key !== 'string') return false;
        /** @type {string} */
        const name = key;
        if (this._stats[name]) return false;
        this._stats[name] = new StatEntry(name, {
            dependencies: Array.isArray(config.dependencies) ? config.dependencies : [],
            order: typeof config.order === 'number' ? config.order : Object.keys(this._stats).length,
            defaultValue: config.defaultValue !== undefined ? config.defaultValue : 'unspecified',
            displayName: (!config.displayName || config.displayName.trim() === '') ? name : config.displayName,
            isCustom: config.isCustom !== undefined ? !!config.isCustom : true,
            isActive: config.isActive !== undefined ? !!config.isActive : true,
            isManual: config.isManual !== undefined ? !!config.isManual : false
        });
        this.saveToMetadata();
        this._eventTarget.dispatchEvent(new CustomEvent(EVENT_STAT_ADDED, { detail: name }));
        return true;
    }

    /**
     * Removes a stat from the registry.
     * @param {string} key - The key/name of the stat to remove
     * @returns {boolean} True if successfully removed, false if stat doesn't exist
     */
    removeStat(key) {
        if (this._stats[key]) {
            delete this._stats[key];
            this.saveToMetadata();
            this._eventTarget.dispatchEvent(new CustomEvent(EVENT_STAT_REMOVED, { detail: key }));
            return true;
        }
        return false;
    }

    /**
     * Checks if a stat exists in the registry.
     * @param {string} key - The key/name of the stat to check
     * @returns {boolean} True if the stat exists, false otherwise
     */
    hasStat(key) {
        return !!this._stats[key];
    }

    /**
     * Gets all stat entries sorted by order.
     * @returns {StatEntry[]} Array of all stat entries
     */
    getAllStats() {
        return Object.values(this._stats)
            .sort((a, b) => (a.order ?? 9999) - (b.order ?? 9999));
    }

    /**
     * Gets all stat names sorted by order.
     * @returns {string[]} Array of all stat names
     */
    getAllStatNames() {
        return this.getAllStats().map(stat => stat.name);
    }

    /**
     * Gets all active stat entries sorted by order.
     * @returns {StatEntry[]} Array of active stat entries
     */
    getActiveStats() {
        return Object.values(this._stats)
            .filter(stat => stat.isActive)
            .sort((a, b) => (a.order ?? 9999) - (b.order ?? 9999));
    }

    /**
     * Gets all active stat names sorted by order.
     * @returns {string[]} Array of active stat names
     */
    getActiveStatNames() {
        return this.getActiveStats().map(stat => stat.name);
    }

    /**
     * Gets the configuration for a specific stat.
     * @param {string} key - The key/name of the stat
     * @returns {StatEntry | null} The stat configuration or null if not found
     */
    getStatEntry(key) {
        return this._stats[key] || null;
    }

    /**
     * Adds an event listener to the registry.
     * @param {string} type - The event type to listen for
     * @param {EventListener} callback - The callback function to execute
     * @returns {void}
     */
    addEventListener(type, callback) {
        this._eventTarget.addEventListener(type, callback);
    }

    /**
     * Removes an event listener from the registry.
     * @param {string} type - The event type to remove the listener from
     * @param {EventListener} callback - The callback function to remove
     * @returns {void}
     */
    removeEventListener(type, callback) {
        this._eventTarget.removeEventListener(type, callback);
    }

    /**
     * Clears all stats from the registry and saves to metadata.
     * @returns {void}
     */
    clearAllStats() {
        this._stats = {};
        this.saveToMetadata();
    }

    /**
     * Internal method to add a stat entry without triggering events or saving.
     * Used during batch loading to avoid multiple re-renders.
     * @param {StatEntry | any} entry - The stat entry to add
     * @returns {boolean} True if successfully added, false otherwise
     * @private
     */
    _addStatEntryInternal(entry) {
        if (!entry || !(entry.name)) return false;
        /** @type {string} */
        const name = entry.name;
        if (this._stats[name]) return false;
        
        try {
            this._stats[name] = new StatEntry(name, {
                dependencies: Array.isArray(entry.dependencies) ? entry.dependencies : [],
                order: typeof entry.order === 'number' ? entry.order : Object.keys(this._stats).length,
                defaultValue: entry.defaultValue !== undefined ? entry.defaultValue : 'unspecified',
                displayName: (!entry.displayName || entry.displayName.trim() === '') ? name : entry.displayName,
                isCustom: entry.isCustom !== undefined ? !!entry.isCustom : true,
                isActive: entry.isActive !== undefined ? !!entry.isActive : true,
                isManual: entry.isManual !== undefined ? !!entry.isManual : false
            });
        } catch (error) {
            console.error("StatSuite Error: Failed to add stat entry.", error);
            return false;
        }
        return true;
    }

    /**
     * Applies a preset to all stats in the registry.
     * @param {string} presetName - The name of the preset to apply
     * @returns {void}
     */
    applyPreset(presetName) {
        const preset = Presets.getPreset(presetName);
        if (!preset) {
            console.warn(`StatSuite Warning: Preset "${presetName}" not found.`);
            return;
        }
        
        this.getAllStats().forEach(stat => {
            const statPreset = preset.get(stat.name);
            if (statPreset) {
                stat.isActive = statPreset.active;
                stat.isManual = statPreset.manual;
                stat.displayName = statPreset.displayName || stat.name;
                stat.defaultValue = statPreset.defaultValue || stat.defaultValue;
            }
        });
        
        Presets.setActivePreset(presetName);
        this.saveToMetadata();
        
        this._eventTarget.dispatchEvent(new CustomEvent('statsChanged'));
    }
}

/** @type {StatRegistry} */
export const Stats = new StatRegistry();
