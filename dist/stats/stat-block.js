export class StatsBlock {
    constructor(initial = {}) {
        Object.assign(this, initial);
    }
    static clone(statsBlock) {
        if (!statsBlock)
            return null;
        return new StatsBlock(JSON.parse(JSON.stringify(statsBlock)));
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
