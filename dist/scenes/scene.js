import { StatsBlock } from "../stats/stat-block.js";
export class Scene {
    constructor(name, isActive = true) {
        Object.defineProperty(this, "name", {
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
        Object.defineProperty(this, "stats", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        this.name = name;
        this.isActive = isActive;
        this.stats = new StatsBlock();
    }
    setActive(active) {
        this.isActive = active;
    }
}
