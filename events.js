// events.js - Handles core application event listeners

// Global Dependencies
import { eventSource, event_types, chat } from '../../../../script.js';

// Local Module Dependencies
import { makeStats } from './stats_logic.js';
import { displayStats, addPasteButton } from './ui.js';

// Event Constants
export const EVENT_CHARACTER_ADDED = 'character-added';
export const EVENT_CHARACTER_REMOVED = 'character-removed';

// Need CharacterRegistry instance - passed during initialization
let _characterRegistryInstance = null;

/**
 * Handles the CHAT_CHANGED event.
 * Refreshes character registry from metadata and updates UI for all messages.
 */
export function onChatChanged() {
    if (!_characterRegistryInstance) {
        console.error("StatSuite Events Error: CharacterRegistry instance not available for onChatChanged.");
        return;
    }
    console.log("StatSuite Events: Handling CHAT_CHANGED event.");
    // Ensure registry is initialized with latest metadata
    _characterRegistryInstance.initializeFromMetadata();

    // Update UI for all messages
    if (chat && Array.isArray(chat)) {
        chat.forEach((message, index) => {
            if (!message.is_system) {
                // Call UI functions
                if (message.stats) {
                    // Ensure displayStats is available before calling
                    if (typeof displayStats === 'function') {
                        displayStats(index, message.stats);
                    } else {
                         console.warn("StatSuite Events Warning: displayStats function not available.");
                    }
                }
                 // Ensure addPasteButton is available before calling
                if (typeof addPasteButton === 'function') {
                    addPasteButton(index);
                } else {
                    console.warn("StatSuite Events Warning: addPasteButton function not available.");
                }
            }
        });
    }
    // TODO: Consider calling renderCharacterList() from ui.js if the settings panel might be open.
    // This requires importing or passing renderCharacterList. For now, leave it out.
}

/**
 * Handles CHARACTER_MESSAGE_RENDERED and USER_MESSAGE_RENDERED events.
 * Triggers automatic stat generation if enabled and adds UI buttons.
 */
export function onMessageRendered() {
    console.log("StatSuite Events: Handling MessageRendered event.");
    // Trigger automatic stat generation if enabled (makeStats checks internally)
    // Ensure makeStats is available
     if (typeof makeStats === 'function') {
        makeStats(); // Called with no args for latest message processing
     } else {
         console.warn("StatSuite Events Warning: makeStats function not available.");
     }


    // Add paste/request buttons to the newly rendered message
    // Find the index of the last message
    let lastMessageIndex = -1;
     if (chat && Array.isArray(chat)) {
        for (let i = chat.length - 1; i >= 0; i--) {
            if (!chat[i].is_system) {
                lastMessageIndex = i;
                break;
            }
        }
    }

    // Auto-track message authors if enabled
    if (lastMessageIndex !== -1 && getSettings()?.autoTrackMessageAuthors) {
        const characterName = chat[lastMessageIndex].name;
        if (characterName) {
            addCharacter(characterName);
        }
    }

    if (lastMessageIndex !== -1) {
        // Ensure addPasteButton is available
        if (typeof addPasteButton === 'function') {
            addPasteButton(lastMessageIndex);
        } else {
             console.warn("StatSuite Events Warning: addPasteButton function not available.");
        }
    }
}

/**
 * Initializes the event listeners.
 * @param {CharacterRegistry} registryInstance Instance of CharacterRegistry.
 */
export function initializeEventListeners(registryInstance) {
     if (!eventSource) {
        console.error("StatSuite Events Error: eventSource is not available!");
        return;
    }
     if (!registryInstance) {
        console.error("StatSuite Events Error: CharacterRegistry instance not provided for initialization.");
        return;
    }
    _characterRegistryInstance = registryInstance;

    console.log("StatSuite Events: Initializing event listeners...");

    // Register core application event listeners
    eventSource.on(event_types.CHAT_CHANGED, onChatChanged);
    eventSource.on(event_types.CHARACTER_MESSAGE_RENDERED, onMessageRendered);
    eventSource.on(event_types.USER_MESSAGE_RENDERED, onMessageRendered);

    console.log("StatSuite Events: Event listeners initialized.");
}