import { StatsBlock } from "../stats/stat-block.js";

export class ChatStatEntry {
    Characters: Record<string, StatsBlock>;
    Scenes: Record<string, StatsBlock>;

    constructor(charactersStats: Record<string, StatsBlock> = {}, scenesStats: Record<string, StatsBlock> = {})
    {
        this.Characters = {};
        for (const [key, value] of Object.entries(charactersStats)) {
            this.Characters[key] = StatsBlock.fromObject(value);
        }

        this.Scenes = {};
        for (const [key, value] of Object.entries(scenesStats)) {
            this.Scenes[key] = StatsBlock.fromObject(value);
        }
    }

    clone(): ChatStatEntry {
        const chars: Record<string, StatsBlock> = {};
        for (const k of Object.keys(this.Characters)) chars[k] = this.Characters[k].clone();

        const scenes: Record<string, StatsBlock> = {};
        for (const k of Object.keys(this.Scenes)) scenes[k] = this.Scenes[k].clone();

        return new ChatStatEntry(chars, scenes);
    }
}
