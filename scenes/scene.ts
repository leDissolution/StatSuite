import { StatsBlock } from "../stats/stat-block.js";

export class Scene {
    name: string;
    isActive: boolean;
    stats: StatsBlock;

    constructor(name: string, isActive: boolean = true) {
        this.name = name;
        this.isActive = isActive;
        this.stats = new StatsBlock();
    }

    setActive(active: boolean): void {
        this.isActive = active;
    }
}