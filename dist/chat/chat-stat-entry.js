import { StatsBlock } from "../stats/stat-block.js";
export class ChatStatEntry {
    constructor(charactersStats = {}, scenesStats = {}) {
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
            chars[k] = this.Characters[k]?.clone() ?? null;
        }
        const scenes = {};
        for (const k of Object.keys(this.Scenes)) {
            scenes[k] = this.Scenes[k]?.clone() ?? null;
        }
        return new ChatStatEntry(chars, scenes);
    }
}
