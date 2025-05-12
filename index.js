// index.js - Main script for the StatSuite extension
// ====================================================

//#region Global Imports
import { saveMetadataDebounced } from "../../../extensions.js";
//#endregion

//#region Local Imports
import { initializeSettings } from './settings.js';
import { initializeStatsLogic, injectStatsFromLastMessage } from './stats_logic.js';
import { initializeUI } from './ui.js';
import { initializeEventListeners } from './events.js';
//#endregion

export const extensionName = "StatSuite";
export const extensionFolderPath = `scripts/extensions/third-party/${extensionName}`;

const characterRegistry = initializeStatsLogic();
window.saveMetadataDebounced = saveMetadataDebounced;

export async function injectStats(chat, _ctx, abort, type) {
    if (type == "regenerate" || type == "swipe" || type == "quiet" || type == "impersonate" || type == "continue") {
        return;
    }

    await injectStatsFromLastMessage();
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
    initializeSettings();
    initializeUI(characterRegistry);
    initializeEventListeners(characterRegistry);

    console.log("StatSuite: Extension initialized.");
});