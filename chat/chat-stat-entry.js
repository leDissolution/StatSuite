import { StatsBlock } from "../stats/stat-block.js";

export class ChatStatEntry {
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
        return new ChatStatEntry(
            JSON.parse(JSON.stringify(this.Characters)),
            JSON.parse(JSON.stringify(this.Scenes))
        );
    }
}
