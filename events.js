// StatSuite - Handles core application event listeners
import { eventSource, event_types, chat } from '../../../../script.js';
import { ExtensionSettings } from './settings.js';
import { makeStats } from './stats/stats-logic.js';
import { displayStats } from './ui/stats-table.js';
import { addPasteButton } from './ui/message-buttons.js';
import { Characters } from './characters/characters-registry.js';
import { Stats } from './stats/stats-registry.js';
import { renderCharactersList } from './ui/characters-list.js';
import { Chat } from './chat/chat-manager.js';

export const EVENT_CHARACTER_ADDED = 'character-added';
export const EVENT_CHARACTER_REMOVED = 'character-removed';
export const EVENT_STAT_ADDED = 'stat-added';
export const EVENT_STAT_REMOVED = 'stat-removed';
export const EVENT_STATS_BATCH_LOADED = 'stats-batch-loaded';

export var ExtensionInitialized = false;

/**
 * Handles the CHAT_CHANGED event. Refreshes character registry from metadata and updates UI for all messages.
 */
export function onChatChanged() {
    if (!ExtensionInitialized) {
        return;
    }
    Chat.clearCache();

    if (!Characters) {
        console.error("StatSuite Events Error: CharacterRegistry instance not available for onChatChanged.");
        return;
    }
    Characters.characters.clear();
    renderCharactersList(Characters);
    Characters.initializeFromMetadata();
    Stats.initializeFromMetadata();

    const messages = Chat.getStatEligibleMessages();
    messages.forEach(({ index }) => {
        const stats = Chat.getMessageStats(index);
        if (stats && Object.keys(stats).length > 0) {
            if (typeof displayStats === 'function') {
                displayStats(index, stats);
            } else {
                console.warn("StatSuite Events Warning: displayStats function not available.");
            }
        }
        if (typeof addPasteButton === 'function') {
            addPasteButton(index);
        } else {
            console.warn("StatSuite Events Warning: addPasteButton function not available.");
        }
    });
}

/**
 * Triggers automatic stat generation if enabled and adds UI buttons.
 * @param {number} message_id
 */
function processMessageForStats(message_id) {
    if (!Chat.isValidMessageForStats(message_id)) return;
    if (generating) return;
    
    if (ExtensionSettings.autoTrackMessageAuthors === true) {
        const message = Chat.getMessage(message_id);
        if (message && message.name) {
            Characters.addCharacter(message.name, message.is_user);
        }
    }

    if (ExtensionSettings.enableAutoRequestStats === true) {
        makeStats(message_id);
    }

    addPasteButton(message_id);

    latestMessageIndex = -1;
}

/**
 * Handles MESSAGE_SWIPED event. Re-renders stats for the swiped message.
 * @param {number} messageId - The index of the message that was swiped
 */
function onSwipeChanged(messageId) {
    if (!ExtensionInitialized) return;
    
    if (!Chat.isValidMessageForStats(messageId)) return;
    
    const stats = Chat.getMessageStats(messageId);
    if (stats && Object.keys(stats).length > 0) {
        displayStats(messageId, stats);
    } else {
        makeStats(messageId);
    }
}

var latestMessageIndex = -1;
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
    eventSource.on(event_types.CHARACTER_MESSAGE_RENDERED, (message_id) => {
        if (!Chat.isValidMessageForStats(message_id)) return;

        if (generating) {
            latestMessageIndex = message_id;
        } else {
            processMessageForStats(message_id);
        }
    });
    
    eventSource.on(event_types.GENERATION_STARTED, () => {
        generating = true;
    });

    eventSource.on(event_types.GENERATION_ENDED, () => {
        generating = false;

        if (latestMessageIndex > -1) {
            processMessageForStats(latestMessageIndex);
        }
    });

    eventSource.on(event_types.MESSAGE_SWIPED, onSwipeChanged);
    console.log("StatSuite Events: Event listeners initialized.");

    ExtensionInitialized = true;
}