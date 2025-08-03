// Main UI initialization and event binding for StatSuite

import { bindSettingsUI } from './settings-ui.js';
import { doPopout } from './settings-ui.js';
import { exportChat } from '../export.js';
import { onChatChanged } from '../events.js';

/**
 * Initializes the UI module, binds event listeners.
 */
export function initializeUI() {
    if (!$) {
        console.error("StatSuite UI Error: jQuery not available!");
        return;
    }

    bindSettingsUI();

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
