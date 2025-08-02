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
}
