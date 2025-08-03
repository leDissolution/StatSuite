import { saveMetadataDebounced } from '../../../../../extensions.js';
import { Character } from '../characters/character.js';

export class ChatMetadata {
    selectedPreset: string | null = null;
    trackedCharacters: Array<Character> = [];

    save() {
        saveMetadataDebounced();
    }
}