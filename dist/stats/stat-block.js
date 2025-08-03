export class StatsBlock {
    constructor(initial = {}) {
        Object.assign(this, initial);
    }
    get(statKey) {
        return this[statKey] || null;
    }
    set(statKey, value) {
        this[statKey] = value;
    }
    clone() {
        return new StatsBlock(JSON.parse(JSON.stringify(this)));
    }
    static fromObject(obj) {
        if (obj instanceof StatsBlock) {
            return obj;
        }
        const statsBlock = new StatsBlock();
        Object.assign(statsBlock, obj);
        return statsBlock;
    }
}
