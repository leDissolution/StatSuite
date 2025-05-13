// StatSuite - Handles core application event listeners
import { eventSource, event_types, chat } from '../../../../script.js';
import { ExtensionSettings } from './settings.js';
import { makeStats } from './stats_logic.js';
import { displayStats } from './ui/stats-table.js';
import { addPasteButton } from './ui/message-buttons.js';
import { Characters } from './characters.js';

export const EVENT_CHARACTER_ADDED = 'character-added';
export const EVENT_CHARACTER_REMOVED = 'character-removed';

/**
 * Handles the CHAT_CHANGED event. Refreshes character registry from metadata and updates UI for all messages.
 */
export function onChatChanged() {
    // Use global CharacterRegistry if not set
    if (!Characters) {
        Characters = new CharacterRegistry();
    }
    if (!Characters) {
        console.error("StatSuite Events Error: CharacterRegistry instance not available for onChatChanged.");
        return;
    }
    Characters.initializeFromMetadata();
    if (chat && Array.isArray(chat)) {
        chat.forEach((message, index) => {
            if (!message.is_system) {
                if (message.stats) {
                    if (typeof displayStats === 'function') {
                        displayStats(index, message.stats);
                    } else {
                        console.warn("StatSuite Events Warning: displayStats function not available.");
                    }
                }
                if (typeof addPasteButton === 'function') {
                    addPasteButton(index);
                } else {
                    console.warn("StatSuite Events Warning: addPasteButton function not available.");
                }
            }
        });
    }
}

/**
 * Handles CHARACTER_MESSAGE_RENDERED and USER_MESSAGE_RENDERED events.
 * Triggers automatic stat generation if enabled and adds UI buttons.
 * @param {number} message_id
 */
function onMessageRendered(message_id) {
    if (chat[message_id].is_system) return;
    if (!generating) {
        if (ExtensionSettings.enableAutoRequestStats === true) {
            makeStats(message_id);
        }
    }
    if (ExtensionSettings.autoTrackMessageAuthors === true) {
        const characterName = chat[message_id].name;
        if (characterName) {
            addCharacter(characterName);
        }
    }
    if (typeof addPasteButton === 'function') {
        addPasteButton(message_id);
    } else {
        console.warn("StatSuite Events Warning: addPasteButton function not available.");
    }
}

var generating = false;

/**
 * Initializes the event listeners for StatSuite extension.
 */
export function initializeEventListeners() {
    if (!eventSource) {
        console.error("StatSuite Events Error: eventSource is not available!");
        return;
    }
    console.log("StatSuite Events: Initializing event listeners...");
    eventSource.on(event_types.CHAT_CHANGED, onChatChanged);
    eventSource.on(event_types.CHARACTER_MESSAGE_RENDERED, onMessageRendered);
    eventSource.on(event_types.GENERATION_STARTED, () => { generating = true; });
    eventSource.on(event_types.GENERATION_ENDED, () => { generating = false; });
    console.log("StatSuite Events: Event listeners initialized.");
}