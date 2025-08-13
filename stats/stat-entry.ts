export enum StatScope {
    Character = 'character',
    Scene = 'scene',
}

export class StatEntry {
    name: string;
    displayName: string;
    defaultValue: string;
    dependencies: string[];
    order: number;
    isCustom: boolean;
    isActive: boolean;
    isManual: boolean;
    scope: StatScope;

    constructor(name: string, { defaultValue, dependencies, order, displayName = '', isCustom = false, isActive = true, isManual = false, scope = StatScope.Character }: {
        defaultValue: string;
        dependencies: string[];
        order: number;
        displayName?: string;
        isCustom?: boolean;
        isActive?: boolean;
        isManual?: boolean;
        scope: StatScope;
    }) {
        this.name = name;
        this.displayName = (!displayName || displayName.trim() === '') ? name : displayName;
        this.defaultValue = defaultValue;
        this.dependencies = dependencies;
        this.order = order;
        this.isCustom = isCustom;
        this.isActive = isActive;
        this.isManual = isManual;
        this.scope = scope;
    }
}
