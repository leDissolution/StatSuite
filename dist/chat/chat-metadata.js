import { saveMetadataDebounced } from '../../../../../extensions.js';
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
    }
    save() {
        saveMetadataDebounced();
    }
}
