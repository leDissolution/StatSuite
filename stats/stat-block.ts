export class StatsBlock {
    constructor(initial = {}) {
        Object.assign(this, initial);
    }

    get(statKey: string): string | null {
        return this[statKey] || null;
    }

    set(statKey: string, value: string) {
        this[statKey] = value;
    }

    clone(): StatsBlock {
        return new StatsBlock(
            JSON.parse(JSON.stringify(this))
        );
    }
}