export class StatsBlock {
    constructor(initial = {}) {
        Object.assign(this, initial);
    }

    /**
     * @param {string} statKey
     */
    get(statKey) {
        return this[statKey];
    }

    /**
     * @param {string} statKey
     * @param {string} value
     */
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

    /**
     * @param {any} obj
     */
    static isStatBlock(obj) {
        return obj instanceof StatsBlock;
    }
}
