// index.js - Main script for the StatSuite extension
// ====================================================

//#region Global Imports
import { saveMetadataDebounced } from "../../../extensions.js";
//#endregion

//#region Local Imports
import { initializeSettings } from './settings.js';
import { injectStatsFromMessage } from './stats/stats-logic.js';
import { initializeUI } from './ui/init.js';
import { initializeEventListeners, onChatChanged } from './events.js';
import { Chat } from './chat/chat-manager.js';
//#endregion

export const extensionName = "StatSuite";
export const extensionFolderPath = `scripts/extensions/third-party/${extensionName}`;

window.saveMetadataDebounced = saveMetadataDebounced;

export async function injectStats(chat, _ctx, abort, type) {
    if (type == "regenerate" || type == "quiet" || type == "impersonate" || type == "continue") {
        return;
    }

    var messageId = chat.length - 1;
    while (messageId >= 0 && Chat.getMessage(messageId).is_system) {
        messageId--;
    }

    if (messageId > -1) {
        await injectStatsFromMessage(messageId);
    }
}

globalThis.injectStats = injectStats;

jQuery(async () => {
    try {
        const settingsHtml = await $.get(`${extensionFolderPath}/settings.html`);
        $("#extensions_settings").append(settingsHtml);
    } catch (error) {
        console.error("StatSuite Error: Failed to load settings.html", error);
    }

    // Initialize core modules
    await initializeSettings();
    initializeUI();
    initializeEventListeners();

    onChatChanged();

    console.log("StatSuite: Extension initialized.");
});