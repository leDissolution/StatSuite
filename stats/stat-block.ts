export class StatsBlock {
    [key: string]: string | null;

    constructor(initial = {}) {
        Object.assign(this, initial);
    }

    static clone(statsBlock: StatsBlock | null | undefined): StatsBlock | null {
        if (!statsBlock) return null;

        return new StatsBlock(
            JSON.parse(JSON.stringify(statsBlock))
        );
    }

    static fromObject(obj: any): StatsBlock {
        if (obj instanceof StatsBlock) {
            return obj;
        }
        
        const statsBlock = new StatsBlock();
        Object.assign(statsBlock, obj);
        return statsBlock;
    }
}