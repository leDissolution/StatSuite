export class Character {
    name: string;
    isPlayer: boolean;
    isActive: boolean;

    constructor(name: string, isPlayer: boolean = false, isActive: boolean = true) {
        this.name = name;
        this.isPlayer = isPlayer;
        this.isActive = isActive;
    }
}
