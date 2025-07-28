import { EVENT_CHARACTER_ADDED, EVENT_CHARACTER_REMOVED } from '../events.js';
import { chat_metadata } from '../../../../../script.js';
import { saveMetadataDebounced } from '../../../../extensions.js';
import { Character } from './character.js';

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
        trackedChars.forEach(char => {
            if (char instanceof Character) {
                this.attachCharacter(char);
            } else if (typeof char === 'object' && char !== null && 'name' in char) {
                const rehydrated = new Character(char.name, char.isPlayer, char.isActive);
                this.attachCharacter(rehydrated);
            } else if (typeof char === 'string') {
                this.addCharacter(char, false);
            }
        });
    }

    /**
     * Adds a character to the registry and updates metadata.
     * @param {string} char - The character to add.
     * @param {boolean} isPlayer - Whether the character is a player character.
     */
    addCharacter(char, isPlayer = false) {
        const character = new Character(char, isPlayer);
        
        this.attachCharacter(character);
    }

    /**
     * Attaches a character to the registry and updates metadata.
     * @param {Character} char - The character to attach.
     * @returns {boolean} True if added, false otherwise.
     */
    attachCharacter(char) {
        if (!this.hasCharacter(char.name)) {
            this.characters.add(char);
            this.saveToMetadata();
            this._eventTarget.dispatchEvent(new CustomEvent(EVENT_CHARACTER_ADDED, { detail: char.name }));
            return true;
        }

        return false;
    }

    /**
     * Removes a character from the registry and updates metadata.
     * @param {string} name - The character name to remove.
     * @returns {boolean} True if removed, false otherwise.
     */
    removeCharacter(name) {
        let removed = false;
        for (const char of this.characters) {
            if (char.name === name) {
                this.characters.delete(char);
                removed = true;
                break;
            }
        }
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
        for (const charObj of this.characters) {
            if (charObj.name === name) return true;
        }
        return false;
    }

    /**
     * Gets the index of a character by name.
     * @param {string} name - The character name to retrieve.
     * @returns {number} The index of the character, or -1 if not found.
     */
    getCharacterIx(name) {
        return Array.from(this.characters).findIndex(char => char.name === name);
    }

    /**
     * Checks if a character is a player character.
     * @param {string} name - The character name to check.
     * @returns {boolean}
     */
    isPlayer(name) {
        for (const charObj of this.characters) {
            if (charObj.name === name) return charObj.isPlayer;
        }
        return false;
    }

    /**
     * Returns a sorted array of tracked character names.
     * @returns {string[]}
     */
    listTrackedCharacterNames() {
        return Array.from(this.characters)
            .map(charObj => charObj.name)
            .sort();
    }

    listActiveCharacterNames() {
        return Array.from(this.characters)
            .filter(charObj => charObj.isActive)
            .map(charObj => charObj.name)
            .sort();
    }

    /**
     * Returns array of tracked characters.
     * @returns {Character[]}
     */
    listTrackedCharacters() {
        return Array.from(this.characters);
    }

    /**
     * Adds an event listener for character registry events.
     * @param {string} type
     * @param {(event: CustomEvent) => void} callback
     */
    addEventListener(type, callback) {
        this._eventTarget.addEventListener(type, callback);
    }

    /**
     * Removes an event listener for character registry events.
     * @param {string} type
     * @param {(event: CustomEvent) => void} callback
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
