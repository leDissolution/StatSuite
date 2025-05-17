import { EVENT_CHARACTER_ADDED, EVENT_CHARACTER_REMOVED } from '../events.js';
import { chat_metadata } from '../../../../../script.js';
import { saveMetadataDebounced } from '../../../../extensions.js';

/**
 * Manages the registry of tracked characters and synchronizes with chat metadata.
 */
export class CharacterRegistry {
    constructor() {
        this.characters = new Set();
        this._eventTarget = new EventTarget();
    }

    /**
     * Loads tracked characters from chat metadata.
     */
    initializeFromMetadata() {
        const chatMetadata = chat_metadata.StatSuite;

        const trackedChars = chatMetadata?.trackedCharacters || [];

        this.characters.clear();
        trackedChars.forEach(char => this.addCharacter(char));
    }

    /**
     * Adds a character to the registry and updates metadata.
     * @param {string} name - The character name to add.
     */
    addCharacter(name) {
        if (name && typeof name === 'string') {
            if (!this.characters.has(name)) {
                this.characters.add(name);
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
        const removed = this.characters.delete(name);
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
        return this.characters.has(name);
    }

    /**
     * Returns a sorted array of tracked character names.
     * @returns {string[]}
     */
    getTrackedCharacters() {
        return Array.from(this.characters).sort();
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
        if (!chat_metadata.StatSuite) {
            chat_metadata.StatSuite = {};
        }

        chat_metadata.StatSuite.trackedCharacters = Array.from(this.characters);

        if (saveMetadataDebounced) {
            saveMetadataDebounced();
        }
    }

    /**
     * Clears all tracked characters and updates metadata.
     */
    clear() {
        this.characters.clear();
        this.saveToMetadata();
    }
}

export const Characters = new CharacterRegistry();
