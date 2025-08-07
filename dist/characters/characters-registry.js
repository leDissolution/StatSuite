import { EVENT_CHARACTER_ADDED, EVENT_CHARACTER_REMOVED } from '../events.js';
import { Character } from './character.js';
import { Chat } from '../chat/chat-manager.js';
export class CharacterRegistry {
    constructor() {
        Object.defineProperty(this, "_characters", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "_eventTarget", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        this._characters = new Set();
        this._eventTarget = new EventTarget();
    }
    initializeFromMetadata() {
        const trackedChars = Chat.Metadata.trackedCharacters;
        this._characters.clear();
        trackedChars.forEach((char) => {
            if (char instanceof Character) {
                this.attachCharacter(char);
            }
            else if (typeof char === 'object' && char !== null && 'name' in char) {
                const rehydrated = new Character(char.name, char.isPlayer, char.isActive);
                this.attachCharacter(rehydrated);
            }
            else if (typeof char === 'string') {
                this.addCharacter(char, false);
            }
        });
    }
    addCharacter(char, isPlayer = false) {
        const character = new Character(char, isPlayer);
        this.attachCharacter(character);
    }
    attachCharacter(char) {
        if (!this.hasCharacter(char.name)) {
            this._characters.add(char);
            this.saveToMetadata();
            this._eventTarget.dispatchEvent(new CustomEvent(EVENT_CHARACTER_ADDED, { detail: char.name }));
            return true;
        }
        return false;
    }
    removeCharacter(name) {
        let removed = false;
        for (const char of this._characters) {
            if (char.name === name) {
                this._characters.delete(char);
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
    hasCharacter(name) {
        for (const charObj of this._characters) {
            if (charObj.name === name)
                return true;
        }
        return false;
    }
    getCharacter(name) {
        for (const charObj of this._characters) {
            if (charObj.name === name)
                return charObj;
        }
        return null;
    }
    getCharacterIx(name) {
        return this.listTrackedCharacters().findIndex(char => char.name === name);
    }
    isPlayer(name) {
        for (const charObj of this._characters) {
            if (charObj.name === name)
                return charObj.isPlayer;
        }
        return false;
    }
    listTrackedCharacterNames() {
        return this.listTrackedCharacters()
            .map(charObj => charObj.name)
            .sort();
    }
    listActiveCharacterNames() {
        return this.listTrackedCharacters()
            .filter(charObj => charObj.isActive)
            .map(charObj => charObj.name)
            .sort();
    }
    listTrackedCharacters() {
        return Array.from(this._characters);
    }
    addEventListener(type, callback) {
        this._eventTarget.addEventListener(type, callback);
    }
    removeEventListener(type, callback) {
        this._eventTarget.removeEventListener(type, callback);
    }
    saveToMetadata() {
        Chat.Metadata.trackedCharacters = this.listTrackedCharacters();
        Chat.Metadata.save();
    }
    clear() {
        this._characters.clear();
        this.saveToMetadata();
    }
}
export const Characters = new CharacterRegistry();
