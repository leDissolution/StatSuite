export class StatPreset {
    constructor(name, displayName, active, manual, defaultValue) {
        Object.defineProperty(this, "name", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "displayName", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "active", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "manual", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "defaultValue", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        this.name = name;
        this.displayName = displayName;
        this.active = active;
        this.manual = manual;
        this.defaultValue = defaultValue;
    }
}
export class StatsPreset {
    constructor(name, stats = {}) {
        Object.defineProperty(this, "name", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "stats", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "characters", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
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
            this.stats[preset.name] = new StatPreset(preset.name, preset.displayName || preset.name, preset.active ?? false, preset.manual ?? false, preset.defaultValue || 'unspecified');
        }
    }
}
