import { StatsBlock } from "../stats/stat-block.js";

export class ChatStatEntry {
    /** @type {Record<string, StatsBlock>} */
    Characters;
    /** @type {Record<string, StatsBlock>} */
    Scenes;

    /**
     * @param {Record<string, StatsBlock>} charactersStats - Stats for characters
     * @param {Record<string, StatsBlock>} scenesStats - Stats for scenes
     * @constructor
     */
    constructor(charactersStats = {}, scenesStats = {})
    {
        this.Characters = charactersStats;
        this.Scenes = scenesStats;
    }

    /**
     * Returns a deep copy of the stats entry.
     * @returns {ChatStatEntry}
     */
    clone() {
        /** @type {Record<string, StatsBlock>} */
        const chars = {};
        for (const k of Object.keys(this.Characters)) chars[k] = this.Characters[k].clone();
        /** @type {Record<string, StatsBlock>} */
        const scenes = {};
        for (const k of Object.keys(this.Scenes)) scenes[k] = this.Scenes[k].clone();

        return new ChatStatEntry(chars, scenes);
    }
}
