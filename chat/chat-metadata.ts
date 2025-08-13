import { saveMetadataDebounced } from '../../../../../extensions.js';
import { Character } from '../characters/character.js';
import { Scene } from '../scenes/scene.js';

export class ChatMetadata {
    selectedPreset: string | null = null;
    trackedCharacters: Array<Character> = [];
    trackedScenes: Array<Scene> = [];

    save() {
        saveMetadataDebounced();
    }

    static parse(data: any): ChatMetadata {
        const metadata = new ChatMetadata();
        if (data.selectedPreset) {
            metadata.selectedPreset = data.selectedPreset;
        }
        if (Array.isArray(data.trackedCharacters)) {
            metadata.trackedCharacters = data.trackedCharacters.map((char: any) => {
                if (char instanceof Character) {
                    return char;
                } else if (typeof char === 'object' && char !== null && 'name' in char) {
                    return new Character(char.name, char.isPlayer, char.isActive);
                } else if (typeof char === 'string') {
                    return new Character(char, false);
                }
                return null;
            }).filter((char: Character | null) => char !== null);
        }
        if (Array.isArray(data.trackedScenes)) {
            metadata.trackedScenes = data.trackedScenes.map((scene: any) => {
                if (scene instanceof Scene) {
                    return scene;
                } else if (typeof scene === 'object' && scene !== null && 'name' in scene) {
                    return new Scene(scene.name, scene.isActive);
                } else if (typeof scene === 'string') {
                    return new Scene(scene);
                }
                return null;
            }).filter((scene: Scene | null) => scene !== null);
        }
        return metadata;
    }
}