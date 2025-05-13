import { EVENT_CHARACTER_ADDED, EVENT_CHARACTER_REMOVED } from './events.js';

/**
 * Manages the registry of tracked characters and synchronizes with chat metadata.
 */
export class CharacterRegistry {
    constructor() {
        this._characters = new Set();
        this._eventTarget = new EventTarget();
        this.initializeFromMetadata();
    }

    /**
     * Loads tracked characters from chat metadata.
     */
    initializeFromMetadata() {
        if (!window.chat_metadata) {
            window.chat_metadata = {};
        }
        if (!window.chat_metadata.character_registry) {
            window.chat_metadata.character_registry = {
                trackedCharacters: []
            };
        }
        const trackedChars = window.chat_metadata.character_registry.trackedCharacters;
        this._characters.clear();
        trackedChars.forEach(char => this.addCharacter(char));
    }

    /**
     * Adds a character to the registry and updates metadata.
     * @param {string} name - The character name to add.
     */
    addCharacter(name) {
        if (name && typeof name === 'string') {
            if (!this._characters.has(name)) {
                this._characters.add(name);
                this.saveToMetadata();
                this._eventTarget.dispatchEvent(new CustomEvent(EVENT_CHARACTER_ADDED, { detail: name }));
            }
        }
    }

    /**
     * Removes a character from the registry and updates metadata.
     * @param {string} name - The character name to remove.
     * @returns {boolean} True if removed, false otherwise.
     */
    removeCharacter(name) {
        const removed = this._characters.delete(name);
        if (removed) {
            this.saveToMetadata();
            this._eventTarget.dispatchEvent(new CustomEvent(EVENT_CHARACTER_REMOVED, { detail: name }));
        }
        return removed;
    }

    /**
     * Checks if a character is tracked.
     * @param {string} name - The character name to check.
     * @returns {boolean}
     */
    hasCharacter(name) {
        return this._characters.has(name);
    }

    /**
     * Returns a sorted array of tracked character names.
     * @returns {string[]}
     */
    getTrackedCharacters() {
        return Array.from(this._characters).sort();
    }

    /**
     * Adds an event listener for character registry events.
     * @param {string} type
     * @param {Function} callback
     */
    addEventListener(type, callback) {
        this._eventTarget.addEventListener(type, callback);
    }

    /**
     * Removes an event listener for character registry events.
     * @param {string} type
     * @param {Function} callback
     */
    removeEventListener(type, callback) {
        this._eventTarget.removeEventListener(type, callback);
    }

    /**
     * Saves the current tracked characters to chat metadata.
     */
    saveToMetadata() {
        if (!window.chat_metadata) {
            window.chat_metadata = {};
        }
        window.chat_metadata.character_registry = {
            trackedCharacters: this.getTrackedCharacters()
        };
        if (window.saveMetadataDebounced) {
            window.saveMetadataDebounced();
        }
    }

    /**
     * Clears all tracked characters and updates metadata.
     */
    clear() {
        this._characters.clear();
        this.saveToMetadata();
    }
}
