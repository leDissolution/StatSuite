import { StatsBlock } from "../stats/stat-block.js";
export class ChatStatEntry {
    constructor(charactersStats = {}, scenesStats = {}) {
        Object.defineProperty(this, "Characters", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "Scenes", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        this.Characters = {};
        for (const [key, value] of Object.entries(charactersStats)) {
            this.Characters[key] = StatsBlock.fromObject(value);
        }
        this.Scenes = {};
        for (const [key, value] of Object.entries(scenesStats)) {
            this.Scenes[key] = StatsBlock.fromObject(value);
        }
    }
    clone() {
        const chars = {};
        for (const k of Object.keys(this.Characters)) {
            chars[k] = StatsBlock.clone(this.Characters[k]);
        }
        const scenes = {};
        for (const k of Object.keys(this.Scenes)) {
            scenes[k] = StatsBlock.clone(this.Scenes[k]);
        }
        return new ChatStatEntry(chars, scenes);
    }
}
