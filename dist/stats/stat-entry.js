export class StatEntry {
    constructor(name, { defaultValue, dependencies, order, displayName = '', isCustom = false, isActive = true, isManual = false }) {
        this.name = name;
        this.displayName = (!displayName || displayName.trim() === '') ? name : displayName;
        this.defaultValue = defaultValue;
        this.dependencies = dependencies;
        this.order = order;
        this.isCustom = isCustom;
        this.isActive = isActive;
        this.isManual = isManual;
    }
}
