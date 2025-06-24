// StatBlock class for per-character stats
// Maintains compatibility with plain objects
export class StatsBlock {
    constructor(initial = {}) {
        Object.assign(this, initial);
    }

    get(statKey) {
        return this[statKey];
    }

    set(statKey, value) {
        this[statKey] = value;
    }

    // For backwards compatibility: allow iteration and serialization as plain object
    toJSON() {
        const obj = {};
        for (const key of Object.keys(this)) {
            obj[key] = this[key];
        }
        return obj;
    }

    static isStatBlock(obj) {
        return obj instanceof StatsBlock;
    }
}
