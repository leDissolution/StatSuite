import { saveMetadataDebounced } from '../../../../../extensions.js';
import { Character } from '../characters/character.js';
import { Scene } from '../scenes/scene.js';
export class ChatMetadata {
    constructor() {
        Object.defineProperty(this, "selectedPreset", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: null
        });
        Object.defineProperty(this, "trackedCharacters", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: []
        });
        Object.defineProperty(this, "trackedScenes", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: []
        });
    }
    save() {
        saveMetadataDebounced();
    }
    static parse(data) {
        const metadata = new ChatMetadata();
        if (data.selectedPreset) {
            metadata.selectedPreset = data.selectedPreset;
        }
        if (Array.isArray(data.trackedCharacters)) {
            metadata.trackedCharacters = data.trackedCharacters.map((char) => {
                if (char instanceof Character) {
                    return char;
                }
                else if (typeof char === 'object' && char !== null && 'name' in char) {
                    return new Character(char.name, char.isPlayer, char.isActive);
                }
                else if (typeof char === 'string') {
                    return new Character(char, false);
                }
                return null;
            }).filter((char) => char !== null);
        }
        if (Array.isArray(data.trackedScenes)) {
            metadata.trackedScenes = data.trackedScenes.map((scene) => {
                if (scene instanceof Scene) {
                    return scene;
                }
                else if (typeof scene === 'object' && scene !== null && 'name' in scene) {
                    return new Scene(scene.name, scene.isActive);
                }
                else if (typeof scene === 'string') {
                    return new Scene(scene);
                }
                return null;
            }).filter((scene) => scene !== null);
        }
        return metadata;
    }
}
