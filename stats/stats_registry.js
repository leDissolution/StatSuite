// StatSuite - StatRegistry: Manages stat definitions, dependencies, and persistence per chat
import { EVENT_STAT_ADDED, EVENT_STAT_REMOVED } from '../events.js';
import { chat_metadata } from '../../../../../script.js';
import { saveMetadataDebounced } from '../../../../extensions.js';

class StatEntry {
    /**
     * @param {string} name
     * @param {object} options
     * @param {any} options.defaultValue
     * @param {string[]} options.dependencies
     * @param {number} options.order
     * @param {boolean} [options.isCustom]
     * @param {boolean} [options.isActive]
     */
    constructor(name, { defaultValue, dependencies, order, isCustom = false, isActive = true }) {
        this.name = name;
        this.defaultValue = defaultValue;
        this.dependencies = dependencies;
        this.order = order;
        this.isCustom = isCustom;
        this.isActive = isActive;
    }
}

const DEFAULT_STATS = [
    new StatEntry('pose', { dependencies: [], order: 0, defaultValue: 'unspecified', isActive: true }),
    new StatEntry('location', { dependencies: ['pose'], order: 1, defaultValue: 'unspecified', isActive: true }),
    new StatEntry('outfit', { dependencies: [], order: 2, defaultValue: 'unspecified', isActive: true }),
    new StatEntry('exposure', { dependencies: ['outfit'], order: 3, defaultValue: 'none', isActive: true }),
    new StatEntry('accessories', { dependencies: [], order: 4, defaultValue: 'unspecified', isActive: true }),
    new StatEntry('bodyState', { dependencies: [], order: 5, defaultValue: 'normal', isActive: false }),
    new StatEntry('mood', { dependencies: [], order: 6, defaultValue: 'neutral', isActive: false }),
];

/**
 * Manages the registry of stats (official + custom) and synchronizes with chat metadata.
 */
export class StatRegistry {
    constructor() {
        this._stats = {};
        this._eventTarget = new EventTarget();
    }

    initializeFromMetadata() {
        const storedStats = chat_metadata.StatSuite?.statsRegistry || null;
        this._stats = {};
        if (Array.isArray(storedStats) && storedStats.length > 0) {
            storedStats.forEach(stat => this.addStatEntry(stat));

            // if any of the default stats are missing, add them as inactive
            const missingDefaultStats =
                this._stats.length > 0 ?
                    DEFAULT_STATS.filter(defaultStat => !this._stats.some(stat => stat.name === defaultStat.name)) :
                    DEFAULT_STATS;
            missingDefaultStats.forEach(stat => {
                this.addStatEntry(new StatEntry(stat.name, {
                    dependencies: stat.dependencies,
                    order: stat.order,
                    defaultValue: stat.defaultValue,
                    isCustom: false,
                    isActive: false
                }));
            });
        } else {
            DEFAULT_STATS.forEach(stat => this.addStatEntry(stat));
        }
    }

    saveToMetadata() {
        if (!chat_metadata.StatSuite) chat_metadata.StatSuite = {};
        chat_metadata.StatSuite.statsRegistry = Object.values(this._stats);
        if (saveMetadataDebounced) saveMetadataDebounced();
    }

    addStatEntry(entry) {
        if (!entry || !(entry.name)) return false;
        const name = entry.name;
        if (this._stats[name]) return false;
        
        try {
            this.addStat(name, {
                dependencies: entry.dependencies,
                order: entry.order,
                defaultValue: entry.defaultValue,
                isCustom: entry.isCustom,
                isActive: entry.isActive
            });

            this.saveToMetadata();
            this._eventTarget.dispatchEvent(new CustomEvent(EVENT_STAT_ADDED, { detail: name }));
        } catch (error) {
            console.error("StatSuite Error: Failed to add stat entry.", error);
            return false;
        }
        return true;
    }

    addStat(key, config) {
        if (!key || typeof key !== 'string') return false;
        const name = key;
        if (this._stats[name]) return false;
        this._stats[name] = new StatEntry(name, {
            dependencies: Array.isArray(config.dependencies) ? config.dependencies : [],
            order: typeof config.order === 'number' ? config.order : Object.keys(this._stats).length,
            defaultValue: config.defaultValue !== undefined ? config.defaultValue : 'unspecified',
            isCustom: config.isCustom !== undefined ? !!config.isCustom : true,
            isActive: config.isActive !== undefined ? !!config.isActive : true
        });
        this.saveToMetadata();
        this._eventTarget.dispatchEvent(new CustomEvent(EVENT_STAT_ADDED, { detail: name }));
        return true;
    }

    removeStat(key) {
        if (this._stats[key]) {
            delete this._stats[key];
            this.saveToMetadata();
            this._eventTarget.dispatchEvent(new CustomEvent(EVENT_STAT_REMOVED, { detail: key }));
            return true;
        }
        return false;
    }

    hasStat(key) {
        return !!this._stats[key];
    }

    getAllStats() {
        // Returns all stats, sorted by order
        return Object.values(this._stats)
            .sort((a, b) => (a.order ?? 9999) - (b.order ?? 9999))
            .map(stat => stat.name);
    }

    getActiveStats() {
        // Returns all active stats, sorted by order
        return Object.values(this._stats)
            .filter(stat => stat.isActive)
            .sort((a, b) => (a.order ?? 9999) - (b.order ?? 9999))
            .map(stat => stat.name);
    }

    getStatConfig(key) {
        return this._stats[key] || null;
    }

    addEventListener(type, callback) {
        this._eventTarget.addEventListener(type, callback);
    }

    removeEventListener(type, callback) {
        this._eventTarget.removeEventListener(type, callback);
    }

    clearAllStats() {
        this._stats = {};
        this.saveToMetadata();
    }
}

export const Stats = new StatRegistry();
