import { StatsBlock } from "../stats/stat-block.js";

export class ChatStatEntry {
    Characters: Record<string, StatsBlock | null>;
    Scenes: Record<string, StatsBlock | null>;

    constructor(charactersStats: Record<string, StatsBlock | null> = {}, scenesStats: Record<string, StatsBlock | null> = {})
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
        const chars: Record<string, StatsBlock | null> = {};
        for (const k of Object.keys(this.Characters)) {
            chars[k] = StatsBlock.clone(this.Characters[k]);
        }

        const scenes: Record<string, StatsBlock | null> = {};
        for (const k of Object.keys(this.Scenes)) {
            scenes[k] = StatsBlock.clone(this.Scenes[k]);
        }

        return new ChatStatEntry(chars, scenes);
    }
}
