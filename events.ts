import { eventSource, event_types, chat } from '../../../../../script.js';
import { ExtensionSettings, shouldRequestStats } from './settings.js';
import { makeStats } from './stats/stats-logic.js';
import { displayStats } from './ui/stats-table.js';
import { addPasteButton } from './ui/message-buttons.js';
import { Characters } from './characters/characters-registry.js';
import { Scenes } from './scenes/scene-registry.js';
import { Stats } from './stats/stats-registry.js';
import { Chat } from './chat/chat-manager.js';
import { Presets } from './stats/presets-registry.js';
import { Templates } from './templates/templates-registry.js';
import { ChatStatEntry } from './chat/chat-stat-entry.js';
import { TemplateData } from './templates/template.js';
import { initializeUI } from './ui/init.js';

export const EVENT_CHARACTER_ADDED = 'character-added';
export const EVENT_CHARACTER_REMOVED = 'character-removed';
export const EVENT_SCENE_ADDED = 'scene-added';
export const EVENT_SCENE_REMOVED = 'scene-removed';
export const EVENT_STAT_ADDED = 'stat-added';
export const EVENT_STAT_REMOVED = 'stat-removed';
export const EVENT_STATS_BATCH_LOADED = 'stats-batch-loaded';

export var ExtensionInitialized = false;

export function onChatChanged() {
    if (!ExtensionInitialized) {
        return;
    }

    if (!Characters) {
        console.error("StatSuite Events Error: CharacterRegistry instance not available for onChatChanged.");
        return;
    }

    Chat.initializeFromMetadata();
    Presets.initializeFromMetadata();
    Scenes.initializeFromMetadata();
    Characters.initializeFromMetadata();
    Stats.initializeFromMetadata();
    Templates.initializeFromMetadata();

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

    const stats = Chat.getLatestStats();
    if (stats) {
        Templates.renderTemplatesIntoVariables(TemplateData.fromMessageStatEntry(stats));
    }

    initializeUI();
}

const messageLock: boolean[] = [];

async function processMessageForStats(message_id: number) {
    if (!Chat.isValidMessageForStats(message_id)) return;
    if (generating) return;
    if (messageLock[message_id]) {
        console.warn(`StatSuite Warning: Message ${message_id} is already being processed.`);
        return;
    }

    messageLock[message_id] = true;

    try
    {
        if (ExtensionSettings.autoTrackMessageAuthors === true) {
            const message = Chat.getMessage(message_id);
            if (message && message.name) {
                Characters.addCharacter(message.name, message.is_user);
            }
        }

        if (shouldRequestStats(Chat.currentCharacter)) {
            await makeStats(message_id);
        }

        addPasteButton(message_id);

        const stats = Chat.getMessageStats(message_id);
        if (stats) {
            Templates.renderTemplatesIntoVariables(TemplateData.fromMessageStatEntry(stats));
        }
    }
    finally
    {
        latestMessageIndex = -1;
        messageLock[message_id] = false;
    }
}

function onSwipeChanged(messageId: number) {
    if (!ExtensionInitialized) return;
    if (!ExtensionSettings.enableAutoRequestStats) return;
    if (!Chat.isValidMessageForStats(messageId)) return;

    const message = chat[messageId]!;

    if (message.swipe_id! >= message.swipes!.length) // swipe_id out of bounds means new swipe request before message is generated
    {
        displayStats(messageId, new ChatStatEntry({'...': null}));
        return;
    } 

    let stats = Chat.getMessageStats(messageId);
    if (stats) {
        displayStats(messageId, stats);
    } else {
        makeStats(messageId);
    }

    stats = Chat.getMessageStats(messageId);
    if (stats) {
        Templates.renderTemplatesIntoVariables(TemplateData.fromMessageStatEntry(stats));
    }
}

let latestMessageIndex = -1;
let generating = false;

export function initializeEventListeners() {
    if (!eventSource) {
        console.error("StatSuite Events Error: eventSource is not available!");
        return;
    }
    console.log("StatSuite Events: Initializing event listeners...");
    eventSource.on(event_types.CHAT_CHANGED, onChatChanged);
    eventSource.on(event_types.CHARACTER_MESSAGE_RENDERED, (/** @type {number} */ message_id: number) => {
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