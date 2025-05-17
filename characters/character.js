// Character class for tracked characters in StatSuite
export class Character {
    /**
     * @param {string} name - The character's name
     * @param {boolean} [isPlayer=false] - Whether this character is a player
     */
    constructor(name, isPlayer = false) {
        this.name = name;
        this.isPlayer = isPlayer;
    }
}
