export class StatEntry {
    name: string;
    displayName: string;
    defaultValue: string;
    dependencies: string[];
    order: number;
    isCustom: boolean;
    isActive: boolean;
    isManual: boolean;

    constructor(name: string, { defaultValue, dependencies, order, displayName = '', isCustom = false, isActive = true, isManual = false }: {
        defaultValue: string;
        dependencies: string[];
        order: number;
        displayName?: string;
        isCustom?: boolean;
        isActive?: boolean;
        isManual?: boolean;
    }) {
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
