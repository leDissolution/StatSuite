export var StatScope;
(function (StatScope) {
    StatScope["Character"] = "character";
    StatScope["Scene"] = "scene";
})(StatScope || (StatScope = {}));
export class StatEntry {
    constructor(name, { defaultValue, dependencies, order, displayName = '', isCustom = false, isActive = true, isManual = false, scope = StatScope.Character }) {
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
        Object.defineProperty(this, "defaultValue", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "dependencies", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "order", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "isCustom", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "isActive", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "isManual", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "scope", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
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
