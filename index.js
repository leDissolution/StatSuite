// index.js - Main script for the StatSuite extension
// ====================================================

//#region Global Imports
import { saveMetadataDebounced } from "../../../extensions.js";
//#endregion

//#region Local Imports
import { initializeSettings } from './settings.js';
import { initializeStatsLogic, injectStatsFromMessage } from './stats_logic.js';
import { initializeUI } from './ui.js';
import { initializeEventListeners, onChatChanged } from './events.js';
//#endregion

export const extensionName = "StatSuite";
export const extensionFolderPath = `scripts/extensions/third-party/${extensionName}`;

const characterRegistry = initializeStatsLogic();
window.saveMetadataDebounced = saveMetadataDebounced;

export async function injectStats(chat, _ctx, abort, type) {
    if (type == "regenerate" || type == "quiet" || type == "impersonate" || type == "continue") {
        return;
    }

    var messageId = chat.length - 1;
    while (messageId >= 0 && chat[messageId].is_system) {
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
    initializeUI(characterRegistry);
    initializeEventListeners(characterRegistry);
    onChatChanged();

    console.log("StatSuite: Extension initialized.");
});