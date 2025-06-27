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
 * Handles CHARACTER_MESSAGE_RENDERED and USER_MESSAGE_RENDERED events.
 * Triggers automatic stat generation if enabled and adds UI buttons.
 * @param {number} message_id
 */
function onMessageRendered(message_id) {
    // Use centralized validation instead of individual checks
    if (!Chat.isValidMessageForStats(message_id)) return;
    
    if (!generating) {
        if (ExtensionSettings.enableAutoRequestStats === true) {
            makeStats(message_id);
        }
    }
    if (ExtensionSettings.autoTrackMessageAuthors === true) {
        const message = Chat.getMessage(message_id);
        if (message && message.name) {
            Characters.addCharacter(message.name, message.is_user);
        }
    }
    if (typeof addPasteButton === 'function') {
        addPasteButton(message_id);
    } else {
        console.warn("StatSuite Events Warning: addPasteButton function not available.");
    }
}

/**
 * Handles MESSAGE_SWIPED event. Re-renders stats for the swiped message.
 * @param {number} messageId - The index of the message that was swiped
 */
function onSwipeChanged(messageId) {
    if (!ExtensionInitialized) return;
    
    // Validate that this is a stat-eligible message
    if (!Chat.isValidMessageForStats(messageId)) return;
    
    // Get stats for the new swipe and re-render
    const stats = Chat.getMessageStats(messageId);
    if (stats && Object.keys(stats).length > 0) {
        if (typeof displayStats === 'function') {
            displayStats(messageId, stats);
        } else {
            console.warn("StatSuite Events Warning: displayStats function not available for swipe update.");
        }
    } else {
        // Clear stats display if no stats for this swipe
        if (typeof displayStats === 'function') {
            displayStats(messageId, {});
        }
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
    eventSource.on(event_types.MESSAGE_SWIPED, onSwipeChanged);
    console.log("StatSuite Events: Event listeners initialized.");

    ExtensionInitialized = true;
}