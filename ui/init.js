// Main UI initialization and event binding for StatSuite

import { bindSettingsUI } from './settings-ui.js';
import { doPopout } from './settings-ui.js';
import { exportChat } from '../export.js';
import { onChatChanged } from '../events.js';
import { Characters } from '../characters/characters_registry.js';
import { StatsRegistry } from '../stats/stats_registry.js';

/**
 * Initializes the UI module, binds event listeners.
 */
export function initializeUI() {
    if (!$) {
        console.error("StatSuite UI Error: jQuery not available!");
        return;
    }

    bindSettingsUI(Characters, StatsRegistry);

    // Bind main UI event listeners (previously in index.js jQuery init)
    // Use event delegation on document for dynamically added elements if necessary
    $(document)
        .off('click.statSuite', '#requestStats')
        .on('click.statSuite', '#requestStats', function() {
            // Use the local onRequestStatsClick if present, otherwise fallback
            if (typeof onRequestStatsClick === 'function') {
                onRequestStatsClick();
            } else {
                // fallback: find the first message without stats and trigger makeStats for it
                const firstMessageWithoutStats = chat.findIndex(message => !message.is_system && !message.stats);
                if (firstMessageWithoutStats >= 0) {
                    makeStats(firstMessageWithoutStats);
                } else {
                    toastr.info("All messages appear to have stats already.");
                }
            }
        });
    $(document)
        .off('click.statSuite', '#exportStats')
        .on('click.statSuite', '#exportStats', exportChat);
    $(document)
        .off('click.statSuite', '#reload')
        .on('click.statSuite', '#reload', onChatChanged);
    $(document)
        .off('click.statSuite', '#statBarPopoutButton')
        .on('click.statSuite', '#statBarPopoutButton', function (e) {
            doPopout(e);
            e.stopPropagation();
        });
    console.log("StatSuite UI: Initialization complete.");
}
