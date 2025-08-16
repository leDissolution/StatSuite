export class Scene {
    name: string;
    isActive: boolean;

    constructor(name: string, isActive: boolean = true) {
        this.name = name;
        this.isActive = isActive;
    }

    setActive(active: boolean): void {
        this.isActive = active;
    }
}