export class StatPreset {
    constructor({ name, displayName, active, manual, defaultValue }) {
        this.name = name;
        this.displayName = displayName;
        this.active = active;
        this.manual = manual;
        this.defaultValue = defaultValue;
    }
}
export class StatsPreset {
    constructor(name, stats = {}) {
        this.name = name;
        this.stats = stats;
        this.characters = [];
    }
    get(name) {
        return this.stats[name] || null;
    }
    set(preset) {
        const existingPreset = this.get(preset.name);
        if (existingPreset) {
            existingPreset.active = preset.active;
            existingPreset.manual = preset.manual;
            existingPreset.displayName = preset.displayName || existingPreset.displayName;
            existingPreset.defaultValue = preset.defaultValue || existingPreset.defaultValue;
        }
        else {
            this.stats[preset.name] = new StatPreset({
                name: preset.name,
                displayName: preset.displayName || preset.name,
                active: preset.active ?? false,
                manual: preset.manual ?? false,
                defaultValue: preset.defaultValue || 'unspecified'
            });
        }
    }
}
