import { EVENT_CHARACTER_ADDED, EVENT_CHARACTER_REMOVED } from './events.js';

export class CharacterRegistry {
    constructor() {
        this._characters = new Set();
        this._eventTarget = new EventTarget();
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
            if (!this._characters.has(name)) {
                this._characters.add(name);
                this.saveToMetadata();
                this._eventTarget.dispatchEvent(new CustomEvent(EVENT_CHARACTER_ADDED, { detail: name }));
            }
        }
    }

    removeCharacter(name) {
        const removed = this._characters.delete(name);
        if (removed) {
            this.saveToMetadata();
            this._eventTarget.dispatchEvent(new CustomEvent(EVENT_CHARACTER_REMOVED, { detail: name }));
        }
        return removed;
    }

    hasCharacter(name) {
        return this._characters.has(name);
    }

    getTrackedCharacters() {
        return Array.from(this._characters).sort();
    }

    addEventListener(type, callback) {
        this._eventTarget.addEventListener(type, callback);
    }

    removeEventListener(type, callback) {
        this._eventTarget.removeEventListener(type, callback);
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
