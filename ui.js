// ui.js - Handles UI rendering, interactions, and settings binding

// External/Global Dependencies
import {
    animation_duration,
    chat,
} from '../../../../script.js';
import { dragElement } from '../../../../scripts/RossAscends-mods.js';
import { loadMovingUIState } from '../../../../scripts/power-user.js';

// Local Module Dependencies
import { ExtensionSettings, updateSetting } from './settings.js';
import {
    makeStats,
    getRecentMessages,
    parseStatsString,
    setMessageStats,
    supportedStats,
    StatConfig
} from './stats_logic.js';
import { exportChat, exportSingleMessage } from './export.js';
import { onChatChanged, EVENT_CHARACTER_ADDED, EVENT_CHARACTER_REMOVED } from './events.js';

let _characterRegistryInstance = null;

// --- Settings UI Binding --- (Moved from index.js's bindSettingsUI)
function bindSettingsUI() {
    console.log("StatSuite UI: Binding settings UI elements.");
    // Bind Model URL input
    $("#modelUrl").prop("value", ExtensionSettings.modelUrl || '');
    $("#modelUrl").off("input.statSuite").on("input.statSuite", function () {
        updateSetting('modelUrl', $(this).prop("value"));
    });

    // Bind Auto Track Authors checkbox
    $("#autoTrackAuthors").prop("checked", ExtensionSettings.autoTrackMessageAuthors);
    $("#autoTrackAuthors").off("input.statSuite").on("input.statSuite", function () {
        updateSetting('autoTrackMessageAuthors', $(this).prop("checked"));
    });

    // Bind Disable Auto Request Stats checkbox
    $("#enableAutoRequestStats").prop("checked", ExtensionSettings.enableAutoRequestStats);
    $("#enableAutoRequestStats").off("input.statSuite").on("input.statSuite", function () {
        updateSetting('enableAutoRequestStats', $(this).prop("checked"));
    });

    // Bind Show Stats checkbox
    $("#showStats").prop("checked", ExtensionSettings.showStats);
    $("#showStats").off("input.statSuite").on("input.statSuite", function () {
        updateSetting('showStats', $(this).prop("checked"));
    });

    // Bind Collapse Old Stats checkbox
    $("#collapseOldStats").prop("checked", ExtensionSettings.collapseOldStats);
    $("#collapseOldStats").off("input.statSuite").on("input.statSuite", function () {
        updateSetting('collapseOldStats', $(this).prop("checked"));
    });

    // Bind Character Management UI
    $('#add-character-btn').off('click.statSuite').on('click.statSuite', function() {
        const charName = $('#new-character-input').val().trim();
        if (charName && _characterRegistryInstance) {
            _characterRegistryInstance.addCharacter(charName);
            $('#new-character-input').val('');
            renderCharacterList(); // Re-render the list
        }
    });

    _characterRegistryInstance.addEventListener(EVENT_CHARACTER_ADDED, renderCharacterList);
    _characterRegistryInstance.addEventListener(EVENT_CHARACTER_REMOVED, renderCharacterList);

    // Initial rendering of character list
    renderCharacterList();
}

// --- Character List Rendering --- (Moved from index.js)
export function renderCharacterList() {
    if (!_characterRegistryInstance) {
        console.error("StatSuite UI Error: CharacterRegistry instance not available for renderCharacterList.");
        return;
    }
    const container = $('#tracked-characters-list');
    if (!container.length) {
        // console.warn("StatSuite UI: Tracked characters list container not found.");
        return; // Don't proceed if the container isn't in the DOM yet
    }
    container.empty();
    console.log("StatSuite UI: Rendering character list.");

    _characterRegistryInstance.getTrackedCharacters().forEach(char => {
        const charElement = $(`
            <div class="tracked-character">
                <span>${char}</span>
                <div class="character-actions">
                    <i class="fas fa-times remove-character" data-character="${char}" title="Remove ${char}"></i>
                </div>
            </div>
        `);
        container.append(charElement);
    });

    // Add event handlers for remove buttons (use event delegation on container)
    container.off('click.statSuite', '.remove-character').on('click.statSuite', '.remove-character', function() {
        const char = $(this).data('character');
        if (_characterRegistryInstance) {
            _characterRegistryInstance.removeCharacter(char);
            renderCharacterList(); // Re-render after removal
        }
    });
}


export function displayStats(messageId, stats) {
    const messageDiv = $(`[mesid="${messageId}"]`);
    if (!messageDiv.length) return;
    messageDiv.find('.stats-table-container').remove(); // Clear previous table

    const characters = Object.keys(stats);
    if (characters.length === 0) return; // No stats to display

    const parentDiv = $('<div class="stats-table-container"></div>').css({
        'padding': '5px',
        'font-size': '0.9em',
        'overflow': 'auto'
    });

    if (ExtensionSettings.collapseOldStats) {
        $("details.stats-details").removeAttr('open');
    }

    const container = $('<details class="stats-details"></details>');
    if (ExtensionSettings.showStats) {
        container.attr('open', true);
    }

    // If it is last message, opening the details should scroll to the bottom
    if (messageId === chat.length - 1) {
        container.on('toggle', function () {
            if (this.open) {
                setTimeout(() => {
                    const chat = $("#chat");
                    chat.scrollTop(chat[0].scrollHeight);
                }, 0);
            }
        });
    }

    const summary = $('<summary class="stats-summary">Stats</summary>').css({
        'cursor': 'pointer',
        'align-items': 'center',
        'font-style': 'italic',
        'color': 'var(--SmartThemeBodyColor)',
        'opacity': '0.7',
    });
    container.append(summary);

    parentDiv.append(container);

    const buttonStyle = {
        'cursor': 'pointer',
        'padding': '1px 3px',
        'opacity': '0.3',
        'transition': 'opacity 0.2s'
    };

    const buttonContainer = $('<div class="stats-button-container"></div>').css({
        'float': 'right',
        'display': 'flex',
        'gap': '5px'
    });

    const regenerateButton = $('<div class="stats-regenerate-button fa-solid fa-rotate" title="Click: Regenerate all stats\nAlt+Click: Regenerate with more randomness\nShift+Click: Regenerate all later messages\nCtrl+Click: Regenerate next 5 messages"></div>').css(buttonStyle);
    const editButton = $('<div class="stats-edit-button fa-solid fa-pencil" title="Edit stats"></div>').css(buttonStyle);
    const exportButton = $('<div class="stats-export-button fa-solid fa-copy" title="Copy message export format"></div>').css(buttonStyle);

    buttonContainer.append(regenerateButton, editButton, exportButton);
    buttonContainer.on('mouseenter', '.fa-solid', function () { $(this).css('opacity', '1'); })
                   .on('mouseleave', '.fa-solid', function () { $(this).css('opacity', '0.3'); });
    container.append(buttonContainer);

    const table = $('<table></table>').css({ 'width': '100%', 'border-collapse': 'collapse' });
    const headerRow = $('<tr></tr>');
    headerRow.append($('<th></th>').css('padding', '2px 5px')); // Empty cell top-left
    characters.forEach(char => {
        headerRow.append($('<th></th>').text(char).css('padding', '2px 5px'));
    });
    table.append(headerRow);

    supportedStats.forEach(stat => {
        const row = $('<tr></tr>');
        row.append($('<td></td>').text(stat.toLowerCase()).css({ 'padding': '2px 5px', 'font-weight': 'bold' }));
        characters.forEach(char => {
            const statValue = (stats[char] && stats[char][stat] !== undefined) ? stats[char][stat] : (StatConfig[stat]?.defaultValue || 'unspecified');
            const cell = $('<td></td>')
                .text(statValue)
                .css('padding', '2px 5px')
                .attr('data-character', char)
                .attr('data-stat', stat);
            row.append(cell);
        });
        table.append(row);
    });

    container.append(table);
    messageDiv.find('.mes_text').first().after(parentDiv);

    // --- Button Event Handlers ---
    exportButton.on('click', function () {
        const messages = getRecentMessages(messageId);
        if (messages) {
            exportSingleMessage(messages);
        } else {
            toastr.error("StatSuite: Could not retrieve message context for export.");
        }
    });

    regenerateButton.on('click', async function (e) {
        const currentIndex = messageId;
        const greedy = e.altKey !== true; // More randomness
        let messagesToProcess = [];
        let toastMessage = '';

        try {
            if (e.shiftKey) { // Mega-regeneration (all later)
                messagesToProcess = chat.slice(currentIndex)
                                        .map((msg, idx) => ({ msg, idx: currentIndex + idx }))
                                        .filter(({ msg }) => !msg.is_system);
                                        // .slice(0, 50); // Keep original limit? Or remove? Let's remove for now.
                toastMessage = `Regenerated all stats in ${messagesToProcess.length} messages`;
                console.log(`StatSuite: Mega-regenerating all stats for all characters in ${messagesToProcess.length} messages`);
            } else if (e.ctrlKey) { // Limited regeneration (next 5)
                messagesToProcess = chat.slice(currentIndex)
                                        .map((msg, idx) => ({ msg, idx: currentIndex + idx }))
                                        .filter(({ msg }) => !msg.is_system)
                                        .slice(0, 5);
                toastMessage = `Regenerated stats in ${messagesToProcess.length} messages`;
                console.log(`StatSuite: Regenerating all stats in ${messagesToProcess.length} messages`);
            } else { // Normal single regeneration
                messagesToProcess = [{ idx: messageId }]; // Process only the current index
                console.log(`StatSuite: Regenerating stats for message ${messageId}`);
            }

            for (const { idx } of messagesToProcess) {
                await makeStats(idx, null, null, greedy);
            }

            if (messagesToProcess.length > 0 && toastMessage != "") {
                toastr.success(toastMessage);
            }

        } catch (error) {
            console.error("StatSuite: Error during regeneration:", error);
            toastr.error("StatSuite: An error occurred during regeneration.");
        }
    });

    editButton.on('click', function () {
        const isEditing = container.hasClass('editing');
        if (!isEditing) {
            // --- Enter Edit Mode ---
            container.addClass('editing');
            
            // Add remove buttons to header cells
            table.find('th').not(':first').each(function () {
                const th = $(this);
                if (th.find('.remove-character-btn').length === 0) {
                    const charName = th.text().replace(/×$/, '').trim();
                    const removeBtn = $('<i class="fas fa-times remove-character-btn" title="Remove character"></i>')
                        .css({ cursor: 'pointer', marginLeft: '5px', opacity: '0.7' })
                        .hover(function() { $(this).css('opacity', '1'); }, function() { $(this).css('opacity', '0.7'); })
                        .on('click', function(e) {
                            e.stopPropagation();
                            
                            var messagesToDelete = []

                            if (e.shiftKey) {
                                const confirmDelete = confirm(`Are you sure you want to remove ${charName} from ALL messages?`);
                                if (!confirmDelete) return;

                                messagesToDelete = chat.slice(messageId)
                                                        .map((msg, idx) => ({ msg, idx: messageId + idx }))
                                                        .filter(({ msg }) => !msg.is_system);
                            } else if (e.ctrlKey) {
                                const confirmDelete = confirm(`Remove ${charName} from next 5 messages?`);
                                if (!confirmDelete) return;

                                messagesToDelete = chat.slice(messageId)
                                                        .map((msg, idx) => ({ msg, idx: messageId + idx }))
                                                        .filter(({ msg }) => !msg.is_system /*&& msg.stats?.[char]?.[stat]*/)
                                                        .slice(0, 5);
                            } else { 
                                messagesToDelete = [{ idx: messageId }];
                            }
    
                            for (const { idx } of messagesToDelete) {
                                const currentStats = chat[idx].stats;

                                if (currentStats)
                                {
                                    delete currentStats[charName];
                                    
                                    setMessageStats(currentStats, idx);
                                }
                            }
                            
                            // Exit edit mode
                            container.removeClass('editing');
                            editButton.removeClass('fa-check').addClass('fa-pencil').attr('title', 'Edit stats');
                        });
                    th.append(removeBtn);
                }
            });

            table.find('td[data-character]').each(function () {
                const cell = $(this);
                const value = cell.text();
                const inputContainer = $('<div>').css({ 'display': 'flex', 'gap': '5px', 'align-items': 'center' });
                const input = $('<input type="text">').val(value).css({
                    'flex': '1', 'box-sizing': 'border-box', 'padding': '2px',
                    'border': 'inherit', 'background-color': 'inherit', 'color': 'inherit'
                });
                const statRegenerateButton = $('<div class="fa-solid fa-rotate" title="Click: Regenerate this stat\nAlt+Click: More randomness\nShift+Click: Regenerate in all later messages\nCtrl+Click: Regenerate in next 5 messages"></div>').css({
                    ...buttonStyle, 'font-size': '0.8em'
                });
                statRegenerateButton.hover(function () { $(this).css('opacity', '1'); }, function() { $(this).css('opacity', '0.3'); });

                statRegenerateButton.on('click', async function (e) {
                    e.stopPropagation(); // Prevent triggering edit mode save
                    const char = cell.attr('data-character');
                    const stat = cell.attr('data-stat');
                    const greedy = e.altKey !== true;
                    let messagesToProcess = [];
                    let toastMessage = '';

                    try {
                         if (e.shiftKey) { // Mega-regenerate this stat/char
                            messagesToProcess = chat.slice(messageId)
                                                    .map((msg, idx) => ({ msg, idx: messageId + idx }))
                                                    .filter(({ msg }) => !msg.is_system);
                            toastMessage = `Regenerated ${stat} for ${char} in ${messagesToProcess.length} messages`;
                            console.log(`StatSuite: Mega-regenerating ${stat} for ${char} in ${messagesToProcess.length} messages`);
                        } else if (e.ctrlKey) { // Limited regenerate this stat/char
                             messagesToProcess = chat.slice(messageId)
                                                    .map((msg, idx) => ({ msg, idx: messageId + idx }))
                                                    .filter(({ msg }) => !msg.is_system /*&& msg.stats?.[char]?.[stat]*/)
                                                    .slice(0, 5);
                            toastMessage = `Regenerated ${stat} for ${char} in ${messagesToProcess.length} messages`;
                             console.log(`StatSuite: Regenerating ${stat} for ${char} in ${messagesToProcess.length} messages`);
                        } else {
                            messagesToProcess = [{ idx: messageId }];
                        }

                        for (const { idx } of messagesToProcess) {
                            await makeStats(idx, char, stat, greedy);
                        }
                         if (messagesToProcess.length > 0 && toastMessage != "") {
                            toastr.success(toastMessage);
                         }

                    } catch (error) {
                        console.error(`StatSuite: Error regenerating ${stat} for ${char}:`, error);
                        toastr.error(`StatSuite: Error regenerating ${stat} for ${char}.`);
                    }
                });

                inputContainer.append(statRegenerateButton, input);
                cell.empty().append(inputContainer);
            });
            editButton.removeClass('fa-pencil').addClass('fa-check').attr('title', 'Save changes');
        } else {
            const newStats = JSON.parse(JSON.stringify(stats));
            let changed = false;
            table.find('td[data-character]').each(function () {
                const cell = $(this);
                const char = cell.attr('data-character');
                const stat = cell.attr('data-stat');
                const newValue = cell.find('input').val();
                if (newStats[char][stat] !== newValue) {
                    newStats[char][stat] = newValue;
                    changed = true;
                }
            });

            if (changed) {
                setMessageStats(newStats, messageId);
            } else {
                container.removeClass('editing');
                editButton.removeClass('fa-check').addClass('fa-pencil').attr('title', 'Edit stats');
                displayStats(messageId, stats);
            }
        }
    });
}

export function addPasteButton(messageId) {
    const messageDiv = $(`[mesid="${messageId}"]`);
    if (!messageDiv.length) return;
    const buttonsContainer = messageDiv.find('.extraMesButtons');
    if (!buttonsContainer.length) return; // Don't add if container doesn't exist

    // Remove existing buttons first to prevent duplicates
    buttonsContainer.find('.paste-stats-button, .request-stats-button').remove();

    const buttonStyle = { 'cursor': 'pointer', 'opacity': '0.3', 'transition': 'opacity 0.2s', 'padding': '0 5px' };
    const hoverIn = function () { $(this).css('opacity', '1'); };
    const hoverOut = function () { $(this).css('opacity', '0.3'); };

    // Paste Button
    const pasteButton = $('<div class="paste-stats-button fa-solid fa-clipboard"></div>')
        .css(buttonStyle).attr('title', 'Paste stats from clipboard')
        .hover(hoverIn, hoverOut)
        .on('click', function () { pasteStats(messageId); });
    buttonsContainer.append(pasteButton);

    // Request Button (Regenerate for this message)
    const requestButton = $('<div class="request-stats-button fa-solid fa-rotate"></div>')
        .css(buttonStyle).attr('title', 'Request/Regenerate stats for this message')
        .hover(hoverIn, hoverOut)
        .on('click', function (e) {
             // Allow alt-click for greedy=false
             makeStats(messageId, null, null, e.altKey !== true);
        });
    buttonsContainer.append(requestButton);
}

async function pasteStats(messageId) {
    try {
        // Simple modal implementation
        const modal = $('<div>').css({
            'position': 'fixed', 'top': '50%', 'left': '50%', 'transform': 'translate(-50%, -50%)',
            'background': 'var(--bg-color-chat-bubble-user)', // Use theme variables
            'border': '1px solid var(--border-color-primary)',
            'padding': '20px', 'z-index': '1000', 'border-radius': '5px', 'box-shadow': '0 0 10px rgba(0,0,0,0.5)'
        });
        const textarea = $('<textarea>').css({
            'width': '400px', 'height': '200px', 'margin': '10px 0',
            'background': 'var(--bg-color-textbox)', 'color': 'var(--text-color-primary)',
            'border': '1px solid var(--border-color-secondary)', 'padding': '5px'
        }).attr('placeholder', 'Paste exported message format here...');
        const buttonContainer = $('<div>').css({ 'display': 'flex', 'gap': '10px', 'justify-content': 'flex-end' });
        const applyButton = $('<button class="primary-button">Apply</button>'); // Use standard button class
        const cancelButton = $('<button class="secondary-button">Cancel</button>'); // Use standard button class

        buttonContainer.append(cancelButton, applyButton);
        modal.append(textarea, buttonContainer);
        $('body').append(modal);
        textarea.focus(); // Focus textarea

        cancelButton.on('click', () => modal.remove());

        applyButton.on('click', () => {
            const clipText = textarea.val();
            if (!clipText) {
                toastr.error('No text provided'); return;
            }
            // Try to find the stats block after </message>
            const statMatch = clipText.match(/<\/message>\s*([\s\S]*?)(?:\n\n|$)/);
            if (!statMatch || !statMatch[1]) {
                toastr.error('No stats block found after </message> in pasted text'); return;
            }
            const statsText = statMatch[1].trim();
            const stats = {};
            const statLines = statsText.split('\n');
            let parsedSomething = false;
            statLines.forEach(line => {
                const parsed = parseStatsString(line.trim()); // Use imported parser
                if (parsed) {
                    parsedSomething = true;
                    Object.entries(parsed).forEach(([char, charStats]) => {
                        if (!stats[char]) stats[char] = {};
                        Object.assign(stats[char], charStats); // Merge stats for the same character
                    });
                }
            });

            if (!parsedSomething) {
                toastr.error('Failed to parse any valid stats from the text'); return;
            }

            // Use setMessageStats to apply and save
            setMessageStats(stats, messageId);
            toastr.success('Stats applied successfully from pasted text');
            modal.remove();
        });
    } catch (err) {
        console.error('StatSuite UI Error: Failed to paste stats:', err);
        toastr.error('Failed to show paste stats modal or apply stats');
    }
}

function doPopout(e) {
    const target = e.target;
    const statBarPopoutId = "statBarPopout";
    const statBarPopoutIdJ = "#" + statBarPopoutId;

    if ($(statBarPopoutIdJ).length === 0) {
        // --- Create Popout ---
        console.debug('StatSuite UI: Creating popout panel.');
        const drawer = $(target).closest('.inline-drawer'); // Find the parent drawer
        const originalElement = drawer.find('.inline-drawer-content').first();
        if (!originalElement.length) {
             console.error("StatSuite UI Error: Could not find '.inline-drawer-content' for popout.");
             return;
        }
        const originalHTMLClone = originalElement.html(); // Clone content
        const template = $('#zoomed_avatar_template').html(); // Use template for frame
        if (!template) {
             console.error("StatSuite UI Error: Could not find '#zoomed_avatar_template'.");
             return;
        }

        const controlBarHtml = `<div class="panelControlBar flex-container">
		  <div id="statBarPopoutheader" class="fa-solid fa-grip drag-grabber hoverglow"></div>
		  <div id="statBarPopoutClose" class="fa-solid fa-circle-xmark hoverglow dragClose" title="Close Popout"></div>
	    </div>`;
        const newElement = $(template); // Create frame from template
        newElement.attr('id', statBarPopoutId)
            .removeClass('zoomed_avatar') // Remove template class
            .addClass('draggable') // Add draggable class
            .css({ "right": "0", "top": "auto", "left": "auto", "bottom": "auto", "position": "fixed" }) // Ensure position fixed
            .empty(); // Clear template content

        // Add control bar and original content
        newElement.append(controlBarHtml).append(originalHTMLClone);

        // Add placeholder to original location
        originalElement.html('<div class="flex-container alignitemscenter justifyCenter wide100p"><small><i>StatSuite settings popped out</i></small></div>');

        // Append to body or a specific container for moving divs
        $('#movingDivs').append(newElement); // Assume #movingDivs exists

        // Make content scrollable if needed (adjust selector if content ID changes)
        newElement.find('#statsDrawerContent').addClass('scrollY'); // Add scrollY to the content part

        // Re-bind UI elements inside the new popout
        bindSettingsUI(); // Re-bind settings inputs/buttons inside the popout
        loadMovingUIState(); // Load saved position
        $(statBarPopoutIdJ).css('display', 'flex').fadeIn(animation_duration);
        dragElement(newElement);
        
        $('#statBarPopoutClose').off('click').on('click', function () {
            $('#statsDrawerContent').removeClass('scrollY');
            const objectivePopoutHTML = $('#statsDrawerContent');
            $(statBarPopoutIdJ).fadeOut(animation_duration, () => {
                originalElement.empty();
                originalElement.html(objectivePopoutHTML);
                $(statBarPopoutIdJ).remove();
                bindSettingsUI();
            });
        });
    } else {
        // --- Close Popout ---
        console.debug('StatSuite UI: Closing existing popout panel.');
        // Trigger the close button's click handler to ensure proper cleanup
        $('#statBarPopoutClose').trigger('click');
    }
}

// --- Click Handler for Request Stats Button --- (Moved from index.js)
function onRequestStatsClick() {
    console.log("StatSuite UI: Request Stats button clicked.");
    // Find the first message without stats and trigger makeStats for it
    const firstMessageWithoutStats = chat.findIndex(message => !message.is_system && !message.stats);
    if (firstMessageWithoutStats >= 0) {
        makeStats(firstMessageWithoutStats);
    } else {
        console.log("StatSuite: No messages without stats found to request.");
        toastr.info("All messages appear to have stats already.");
    }
}


// --- Initialization ---
/**
 * Initializes the UI module, binds event listeners.
 * @param {CharacterRegistry} registryInstance Instance of CharacterRegistry.
 */
export function initializeUI(registryInstance) {
    if (!$) {
        console.error("StatSuite UI Error: jQuery not available!");
        return;
    }
     if (!registryInstance) {
        console.error("StatSuite UI Error: CharacterRegistry instance not provided for initialization.");
        return;
    }
    _characterRegistryInstance = registryInstance;

    console.log("StatSuite UI: Initializing...");

    // Bind settings UI elements (now includes character list binding)
    bindSettingsUI();

    // Bind main UI event listeners (previously in index.js jQuery init)
    // Use event delegation on document for dynamically added elements if necessary
    $(document).off('click.statSuite', '#requestStats').on('click.statSuite', '#requestStats', onRequestStatsClick);
    $(document).off('click.statSuite', '#exportStats').on('click.statSuite', '#exportStats', exportChat); // exportChat from export.js
    $(document).off('click.statSuite', '#reload').on('click.statSuite', '#reload', onChatChanged); // Use stored callback
    $(document).off('click.statSuite', '#statBarPopoutButton').on('click.statSuite', '#statBarPopoutButton', function (e) {
        doPopout(e);
        e.stopPropagation(); // Prevent event bubbling
    });

    console.log("StatSuite UI: Initialization complete.");
}