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
        if (!this.stats[preset.name]) {
            this.stats[preset.name] = new StatPreset({
                name: preset.name,
                displayName: preset.displayName || preset.name,
                active: preset.active || false,
                manual: preset.manual || false,
                defaultValue: preset.defaultValue || 'unspecified'
            });
        }
        else {
            this.stats[preset.name].active = preset.active;
            this.stats[preset.name].manual = preset.manual;
            this.stats[preset.name].displayName = preset.displayName || this.stats[preset.name].displayName;
            this.stats[preset.name].defaultValue = preset.defaultValue || this.stats[preset.name].defaultValue;
        }
    }
}
