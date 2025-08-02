export class Character {
    constructor(name, isPlayer = false, isActive = true) {
        this.name = name;
        this.isPlayer = isPlayer;
        this.isActive = isActive;
    }
}
