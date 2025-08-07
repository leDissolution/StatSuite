export class StatPreset {
    name: string;
    displayName: string;
    active: boolean;
    manual: boolean;
    defaultValue: string;

    constructor(name: string, displayName: string, active: boolean, manual: boolean, defaultValue: string) {
        this.name = name;
        this.displayName = displayName;
        this.active = active;
        this.manual = manual;
        this.defaultValue = defaultValue;
    }
}

export class StatsPreset {
    name: string;
    stats: {  [s: string]: StatPreset; };
    characters: string[];

    constructor(name: string, stats: { [s: string]: StatPreset; } = {}) {
        this.name = name;
        this.stats = stats;
        this.characters = [];
    }

    get(name: string): StatPreset | null {
        return this.stats[name] || null;
    }

    set(preset: StatPreset) {
        const existingPreset = this.get(preset.name);

        if (existingPreset) {
            existingPreset.active = preset.active;
            existingPreset.manual = preset.manual;
            existingPreset.displayName = preset.displayName || existingPreset.displayName;
            existingPreset.defaultValue = preset.defaultValue || existingPreset.defaultValue;
        } else {
            this.stats[preset.name] = new StatPreset(
                preset.name,
                preset.displayName || preset.name,
                preset.active ?? false,
                preset.manual ?? false,
                preset.defaultValue || 'unspecified'
            );
        }
    }
}