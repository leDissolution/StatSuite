import { EVENT_STAT_ADDED, EVENT_STAT_REMOVED, EVENT_STATS_BATCH_LOADED } from '../events.js';
import { saveSettingsDebounced } from '../../../../../../script.js';
import { saveMetadataDebounced } from '../../../../../extensions.js';
import { ExtensionSettings } from '../settings.js';
import { Presets } from './presets-registry.js';
import { StatPreset } from './preset.js';
import { StatEntry, StatScope } from './stat-entry.js';

const DEFAULT_STATS: StatEntry[] = [
    // Default character stats
    new StatEntry('pose', { dependencies: [], order: 0, defaultValue: 'unspecified', isActive: true, scope: StatScope.Character }),
    new StatEntry('location', { dependencies: ['pose'], order: 1, defaultValue: 'unspecified', isActive: true, scope: StatScope.Character }),
    new StatEntry('outfit', { dependencies: [], order: 2, defaultValue: 'unspecified', isActive: true, scope: StatScope.Character }),
    new StatEntry('exposure', { dependencies: ['outfit'], order: 3, defaultValue: 'none', isActive: true, scope: StatScope.Character }),
    new StatEntry('accessories', { dependencies: ['outfit'], order: 4, defaultValue: 'unspecified', isActive: true, scope: StatScope.Character }),
    new StatEntry('bodyState', { dependencies: [], order: 5, defaultValue: 'normal', isActive: false, scope: StatScope.Character }),
    new StatEntry('mood', { dependencies: [], order: 6, defaultValue: 'neutral', isActive: false, scope: StatScope.Character }),


    // Default scene stats
    new StatEntry('furniture', { dependencies: [], order: 0, defaultValue: 'unspecified', isActive: true, scope: StatScope.Scene })
];

export class StatRegistry {
    private _stats: { [s: string]: StatEntry; };
    private _eventTarget: EventTarget;
    constructor() {
        this._stats = {};
        this._eventTarget = new EventTarget();
    }

    initializeFromMetadata(): void {
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
                        displayName: statPreset.displayName || stat.name,
                        scope: stat.scope || 'character'
                    });
                }
            });
        }

        this.applyPreset(preset.name);

        DEFAULT_STATS.forEach(stat => {
            if (!this._stats[stat.name]) {
                this._addStatEntryInternal(stat);
            }

            this._stats[stat.name]!.isCustom = false;
            this._stats[stat.name]!.defaultValue = stat.defaultValue;

            const statPreset = preset.get(stat.name);
            if (statPreset) {
                statPreset.defaultValue = stat.defaultValue;
            }
        });

        this._eventTarget.dispatchEvent(new CustomEvent(EVENT_STATS_BATCH_LOADED, {
            detail: { statNames: Object.keys(this._stats) }
        }));
    }

    saveToMetadata(): void {
        if (!ExtensionSettings.stats) ExtensionSettings.stats = { stats: {}, presets: {} };
        if (!ExtensionSettings.stats.stats) ExtensionSettings.stats.stats = {};
        
        ExtensionSettings.stats.stats = {};
        this.getAllStats(null).forEach(stat => {
            ExtensionSettings.stats.stats[stat.name] = {
                name: stat.name,
                dependencies: stat.dependencies,
                order: stat.order,
                isCustom: stat.isCustom,
                scope: stat.scope
            };
        });

        const preset = Presets.getActivePreset();
        this.getAllStats(null).forEach(stat => {
            preset.set(new StatPreset(
                stat.name,
                stat.displayName,
                stat.isActive,
                stat.isManual,
                stat.defaultValue
            ));
        });

        Presets.saveToMetadata();
        saveSettingsDebounced();
        saveMetadataDebounced();
    }

    addStat(stat: StatEntry): boolean {
        const added = this._addStatEntryInternal(stat);

        if (!added) return false;

        this._eventTarget.dispatchEvent(new CustomEvent(EVENT_STAT_ADDED, { detail: stat.name }));

        return true;
    }

    private _addStatEntryInternal(entry: StatEntry): boolean {
        if (!entry || !(entry.name)) return false;

        const name: string = entry.name;
        if (this._stats[name]) return false;
        
        try {
            this._stats[name] = new StatEntry(name, {
                dependencies: Array.isArray(entry.dependencies) ? entry.dependencies : [],
                order: typeof entry.order === 'number' ? entry.order : Object.keys(this._stats).length,
                defaultValue: entry.defaultValue !== undefined ? entry.defaultValue : 'unspecified',
                displayName: (!entry.displayName || entry.displayName.trim() === '') ? name : entry.displayName,
                isCustom: entry.isCustom !== undefined ? !!entry.isCustom : true,
                isActive: entry.isActive !== undefined ? !!entry.isActive : true,
                isManual: entry.isManual !== undefined ? !!entry.isManual : false,
                scope: entry.scope !== undefined ? entry.scope : StatScope.Character
            });
        } catch (error) {
            console.error("StatSuite Error: Failed to add stat entry.", error);
            return false;
        }
        return true;
    }

    removeStat(name: string): boolean {
        if (this._stats[name]) {
            delete this._stats[name];
            this.saveToMetadata();
            
            this._eventTarget.dispatchEvent(new CustomEvent(EVENT_STAT_REMOVED, { detail: name }));
            
            return true;
        }

        return false;
    }

    hasStat(name: string): boolean {
        return !!this._stats[name];
    }

    getAllStats(scope: StatScope | null): StatEntry[] {
        return Object.values(this._stats)
            .filter(stat => scope === null || stat.scope === scope)
            .sort((a, b) => (a.order ?? 9999) - (b.order ?? 9999));
    }

    getAllStatNames(scope: StatScope | null): string[] {
        return this.getAllStats(scope).map(stat => stat.name);
    }

    getActiveStats(scope: StatScope | null): StatEntry[] {
        return this.getAllStats(scope).filter(stat => stat.isActive);
    }

    getActiveStatNames(scope: StatScope | null): string[] {
        return this.getActiveStats(scope).map(stat => stat.name);
    }

    getStatEntry(name: string): StatEntry | null {
        return this._stats[name] || null;
    }

    addEventListener(type: string, callback: EventListener): void {
        this._eventTarget.addEventListener(type, callback);
    }

    removeEventListener(type: string, callback: EventListener): void {
        this._eventTarget.removeEventListener(type, callback);
    }

    /**
     * Applies a preset to all stats in the registry.
     * @param {string} presetName - The name of the preset to apply
     * @returns {void}
     */
    applyPreset(presetName: string): void {
        const preset = Presets.getPreset(presetName);
        if (!preset) {
            console.warn(`StatSuite Warning: Preset "${presetName}" not found.`);
            return;
        }

        this.getAllStats(null).forEach(stat => {
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
export const Stats: StatRegistry = new StatRegistry();
