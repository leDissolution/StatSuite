export class CharacterRegistry {
    constructor() {
        this._characters = new Set();
        this.initializeFromMetadata();
    }

    initializeFromMetadata() {
        if (!window.chat_metadata) {
            window.chat_metadata = {};
        }
        
        if (!window.chat_metadata.character_registry) {
            window.chat_metadata.character_registry = {
                trackedCharacters: []
            };
        }

        // Load characters from metadata
        const trackedChars = window.chat_metadata.character_registry.trackedCharacters;
        this._characters.clear();
        trackedChars.forEach(char => this.addCharacter(char));
    }

    addCharacter(name) {
        if (name && typeof name === 'string') {
            this._characters.add(name);
            this.saveToMetadata();
        }
    }

    removeCharacter(name) {
        const removed = this._characters.delete(name);
        if (removed) {
            this.saveToMetadata();
        }
        return removed;
    }

    hasCharacter(name) {
        return this._characters.has(name);
    }

    getTrackedCharacters() {
        return Array.from(this._characters).sort();
    }

    saveToMetadata() {
        if (!window.chat_metadata) {
            window.chat_metadata = {};
        }

        window.chat_metadata.character_registry = {
            trackedCharacters: this.getTrackedCharacters()
        };

        // Use the imported saveMetadataDebounced function
        if (window.saveMetadataDebounced) {
            window.saveMetadataDebounced();
        }
    }

    // Clear all tracked characters
    clear() {
        this._characters.clear();
        this.saveToMetadata();
    }
}
