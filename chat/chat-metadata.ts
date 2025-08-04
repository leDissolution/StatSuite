import { saveMetadataDebounced } from '../../../../../extensions.js';
import { Character } from '../characters/character.js';

export class ChatMetadata {
    selectedPreset: string | null = null;
    trackedCharacters: Array<Character> = [];

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
        return metadata;
    }
}