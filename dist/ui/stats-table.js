// Handles rendering and editing of the stats table for messages
import { setMessageStats, getRecentMessages, makeStats } from '../stats/stats-logic.js';
import { exportSingleMessage } from '../export.js';
import { chat, saveChatConditional } from '../../../../../../script.js';
import { ExtensionSettings } from '../settings.js';
import { Stats } from '../stats/stats-registry.js';
import { Chat } from '../chat/chat-manager.js';
import { Characters } from '../characters/characters-registry.js';
import { ChatStatEntry } from '../chat/chat-stat-entry.js';
/**
 * Sanitize stat input value before saving.
 * @param {string} value
 * @returns {string}
 */
function sanitizeStatInput(value) {
    if (typeof value !== 'string')
        return value;
    let sanitized = value.replace(/\t/g, '');
    sanitized = sanitized.replace(/\s(a|an|the)\s+/i, ' ');
    sanitized = sanitized.replace(/ {2,}/g, ' ');
    sanitized = sanitized.replace(/ +,/g, ',');
    sanitized = sanitized.trim();
    sanitized = sanitized.replace(/^,|,$/g, '');
    return sanitized;
}
/**
 * Batch regenerate stats for a set of messages.
 * @param {Array<number>} messageIndices - Indices of messages to process.
 * @param {Object} options - { char, stat, greedy, toastMessage }
 */
async function regenerateStatsBatch(messageIndices, { char = null, stat = null, greedy = true, toastMessage = '', copyOver = false } = {}) {
    try {
        for (const idx of messageIndices) {
            await makeStats(idx, char, stat, greedy, copyOver);
        }
        if (messageIndices.length > 1 && toastMessage) {
            toastr.success(toastMessage);
        }
    }
    catch (error) {
        console.error('StatSuite: Error during regeneration:', error);
        toastr.error('StatSuite: An error occurred during regeneration.');
    }
}
/**
 * Utility to compute message indices for regeneration based on key modifiers.
 * @param {number} startIndex - The starting message index.
 * @param {JQuery.MouseDownEvent} e - The event object (for key modifiers).
 * @returns {{indices: number[], description: string}}
 */
function getRegenerationIndices(startIndex, e) {
    let count = 1;
    let description = '';
    if (e.shiftKey) {
        count = 9999;
        description = `all messages from ${startIndex}`;
    }
    else if (e.ctrlKey) {
        count = 5;
        description = `next 5 messages from ${startIndex}`;
    }
    else {
        count = 1;
        description = `message ${startIndex}`;
    }
    const indices = Chat.getMessagesFrom(startIndex, count);
    return { indices, description };
}
/**
 * Renders the table header row with character columns and regen buttons.
 * @param {string[]} characters
 * @param {number} messageId
 * @returns {JQuery<HTMLElement>}
 */
function renderStatsTableHeader(characters, messageId) {
    const headerRow = $('<tr></tr>');
    headerRow.append($('<th></th>'));
    characters.forEach(char => {
        const th = $('<th></th>');
        const colRegenBtn = $('<div class="fa-solid fa-rotate stats-col-regenerate" title="Regenerate all stats for this character\nAlt+Click: Regenerate with more randomness\nShift+Click: Regenerate all later messages\nCtrl+Click: Regenerate next 5 messages\nRight Click: Copy stats from previous message(s)"></div>')
            .css({ cursor: 'pointer', marginRight: '5px', opacity: '0.3', display: 'none', verticalAlign: 'middle' })
            .hover(function () { $(this).css('opacity', '1'); }, function () { $(this).css('opacity', '0.3'); })
            .on('mousedown', async function (e) {
            e.stopPropagation();
            const copyOver = e.button === 2;
            if (copyOver)
                e.preventDefault();
            const { indices, description } = getRegenerationIndices(messageId, e);
            const greedy = e.altKey !== true;
            let toastMessage = '';
            if (indices.length > 1) {
                toastMessage = `Regenerated all stats for ${char} in ${indices.length} messages (${description})`;
            }
            else {
                toastMessage = `Regenerated all stats for ${char} in ${description}`;
            }
            console.log(`StatSuite: Regenerating all stats for ${char} in ${description}${copyOver ? ' (copyOver)' : ''}`);
            await regenerateStatsBatch(indices, { char, greedy, toastMessage, copyOver });
        });
        th.append(colRegenBtn, $('<span></span>').text(char));
        headerRow.append(th);
    });
    return headerRow;
}
/**
 * Renders the table body rows for each stat.
 * @param {string[]} presentStats
 * @param {string[]} characters
 * @param {ChatStatEntry} stats
 * @param {number} messageId
 * @returns {JQuery<HTMLElement>[]}
 */
function renderStatsTableBody(presentStats, characters, stats, messageId) {
    return presentStats.map(stat => {
        const row = $('<tr></tr>');
        // Row regen button (hidden by default, shown in edit mode)
        const rowRegenBtn = $('<div class="fa-solid fa-rotate stats-row-regenerate" title="Regenerate this stat for all characters\nAlt+Click: More randomness\nShift+Click: Regenerate in all later messages\nCtrl+Click: Next 5 messages\nRight Click: Copy from previous message(s)"></div>')
            .css({ cursor: 'pointer', marginRight: '5px', opacity: '0.3', display: 'none', verticalAlign: 'middle' })
            .hover(function () { $(this).css('opacity', '1'); }, function () { $(this).css('opacity', '0.3'); })
            .on('mousedown', async function (e) {
            e.stopPropagation();
            const copyOver = e.button === 2;
            if (copyOver)
                e.preventDefault();
            const { indices, description } = getRegenerationIndices(messageId, e);
            const greedy = e.altKey !== true;
            let toastMessage = '';
            if (indices.length > 1) {
                toastMessage = `Regenerated ${stat} for all characters in ${indices.length} messages (${description})`;
            }
            else {
                toastMessage = `Regenerated ${stat} for all characters in ${description}`;
            }
            console.log(`StatSuite: Regenerating ${stat} for all characters in ${description}${copyOver ? ' (copyOver)' : ''}`);
            await regenerateStatsBatch(indices, { stat, greedy, toastMessage, copyOver });
        });
        const statLabelTd = $('<td></td>').addClass('stat-label').attr('data-stat-key', stat);
        statLabelTd.append(rowRegenBtn, $('<span></span>').text(Stats.getStatEntry(stat)?.displayName || stat));
        row.append(statLabelTd);
        characters.forEach(char => {
            const statValue = (stats.Characters[char] && stats.Characters[char][stat] !== undefined) ? stats.Characters[char][stat] : (Stats.getStatEntry(stat)?.defaultValue || 'unspecified');
            const cell = $('<td></td>')
                .text(statValue)
                .attr('data-character', char)
                .attr('data-stat', stat);
            row.append(cell);
        });
        return row;
    });
}
/**
 * Utility to get all present stats for the given characters and stats object, sorted by stat order.
 * @param {string[]} characters
 * @param {ChatStatEntry} stats
 * @returns {string[]}
 */
function getPresentStats(characters, stats) {
    const presentStats = characters.reduce((acc, char) => {
        const charStats = stats.Characters[char];
        if (charStats) {
            Object.keys(charStats).forEach(stat => {
                if (!acc.includes(stat)) {
                    acc.push(stat);
                }
            });
        }
        return acc;
    }, []);
    presentStats.sort((a, b) => {
        const aConfig = Stats.getStatEntry(a);
        const bConfig = Stats.getStatEntry(b);
        const aOrder = aConfig.order || 0;
        const bOrder = bConfig.order || 0;
        return aOrder - bOrder;
    });
    return presentStats;
}
/**
 * Renders the button bar (regenerate, edit, export, delete) and binds their events.
 * @param {number} messageId
 * @param {JQuery<HTMLElement>} container
 * @param {JQuery<HTMLElement>} table
 * @param {ChatStatEntry} stats
 * @returns {JQuery<HTMLElement>}
 */
function renderStatsTableControls(messageId, container, table, stats) {
    const buttonContainer = $('<div class="stats-button-container"></div>');
    const regenerateButton = $('<div class="stats-regenerate-button fa-solid fa-rotate" title="Click: Regenerate all stats\nAlt+Click: Regenerate with more randomness\nShift+Click: Regenerate all later messages\nCtrl+Click: Regenerate next 5 messages\nRight Click: Copy stats from previous message(s)"></div>');
    const editButton = $('<div class="stats-edit-button fa-solid fa-pencil" title="Edit stats"></div>');
    const exportButton = $('<div class="stats-export-button fa-solid fa-copy" title="Copy message export format"></div>');
    const deleteButton = $('<div class="stats-delete-button fa-solid fa-trash" title="Delete stats from message(s)"></div>');
    const discardButton = $('<div class="stats-discard-button fa-solid fa-xmark" title="Discard changes" style="display:none;"></div>');
    buttonContainer.append(regenerateButton, editButton, discardButton, exportButton, deleteButton);
    buttonContainer.on('mouseenter', '.fa-solid', function () { $(this).css('opacity', '1'); })
        .on('mouseleave', '.fa-solid', function () { $(this).css('opacity', '0.3'); });
    // Export
    exportButton.on('click', function () {
        const messages = getRecentMessages(messageId);
        if (messages) {
            exportSingleMessage(messages);
        }
        else {
            toastr.error("StatSuite: Could not retrieve message context for export.");
        }
    });
    // Regenerate
    regenerateButton.on('mousedown', async function (e) {
        e.stopPropagation();
        const copyOver = e.button === 2;
        if (copyOver)
            e.preventDefault();
        const { indices, description } = getRegenerationIndices(messageId, e);
        const greedy = e.altKey !== true;
        let toastMessage = '';
        if (indices.length > 1) {
            toastMessage = `Regenerated all stats in ${indices.length} messages (${description})`;
        }
        else {
            toastMessage = `Regenerated stats for ${description}`;
        }
        console.log(`StatSuite: Regenerating stats for ${description}${copyOver ? ' (copyOver)' : ''}`);
        await regenerateStatsBatch(indices, { greedy, toastMessage, copyOver });
    });
    // Delete
    deleteButton.on('mousedown', function (e) {
        e.stopPropagation();
        const { indices, description } = getRegenerationIndices(messageId, e);
        let confirmMsg = '';
        if (indices.length > 1) {
            confirmMsg = `Are you sure you want to delete stats from ${indices.length} messages (${description})?`;
        }
        else {
            confirmMsg = `Are you sure you want to delete stats from message ${messageId}?`;
        }
        if (!confirm(confirmMsg))
            return;
        let changed = false;
        for (const idx of indices) {
            if (Chat.getMessage(idx) && Chat.getMessageStats(idx)) {
                if (Chat.deleteMessageStats(idx)) {
                    changed = true;
                    $(`[mesid="${idx}"]`).find('.stats-table-container').remove();
                }
            }
        }
        if (changed) {
            saveChatConditional();
        }
    });
    // Edit
    editButton.on('click', function () {
        bindStatsTableEditMode(container, table, stats, messageId, editButton, discardButton);
    });
    discardButton.on('click', function () {
        container.removeClass('editing');
        editButton.removeClass('fa-check').addClass('fa-pencil').attr('title', 'Edit stats');
        discardButton.hide();
        // Re-render the stats table to restore original values
        displayStats(messageId, stats);
    });
    return buttonContainer;
}
/**
 * Handles toggling edit mode and saving edits for the stats table.
 * @param {JQuery<HTMLElement>} container
 * @param {JQuery<HTMLElement>} table
 * @param {ChatStatEntry} stats
 * @param {number} messageId
 * @param {JQuery<HTMLElement>} editButton
 * @param {JQuery<HTMLElement>} discardButton
 */
function bindStatsTableEditMode(container, table, stats, messageId, editButton, discardButton) {
    const isEditing = container.hasClass('editing');
    if (!isEditing) {
        container.addClass('editing');
        if (discardButton)
            discardButton.show();
        table.find('th').not(':first').each(function () {
            const th = $(this);
            if (th.find('.remove-character-btn').length === 0) {
                const charName = th.text().replace(/×$/, '').trim();
                const removeBtn = $('<i class="fas fa-times remove-character-btn" title="Remove character"></i>')
                    .css({ cursor: 'pointer', marginLeft: '5px', opacity: '0.7' })
                    .hover(function () { $(this).css('opacity', '1'); }, function () { $(this).css('opacity', '0.7'); })
                    .on('click', function (e) {
                    e.stopPropagation();
                    var messagesToDelete = [];
                    if (e.shiftKey) {
                        const confirmDelete = confirm(`Are you sure you want to remove ${charName} from ALL messages?`);
                        if (!confirmDelete)
                            return;
                        messagesToDelete = Chat.getStatEligibleMessages().slice(messageId)
                            .map((msg, idx) => ({ msg, idx: messageId + idx }))
                            .filter(({ msg }) => !msg.is_system);
                    }
                    else if (e.ctrlKey) {
                        const confirmDelete = confirm(`Remove ${charName} from next 5 messages?`);
                        if (!confirmDelete)
                            return;
                        messagesToDelete = Chat.getStatEligibleMessages().slice(messageId)
                            .map((msg, idx) => ({ msg, idx: messageId + idx }))
                            .filter(({ msg }) => !msg.is_system)
                            .slice(0, 5);
                    }
                    else {
                        messagesToDelete = [{ idx: messageId }];
                    }
                    for (const { idx } of messagesToDelete) {
                        const currentStats = Chat.getMessageStats(idx);
                        if (currentStats) {
                            delete currentStats.Characters[charName];
                            setMessageStats(currentStats, idx);
                        }
                    }
                    container.removeClass('editing');
                    editButton.removeClass('fa-check').addClass('fa-pencil').attr('title', 'Edit stats');
                    saveChatConditional();
                });
                th.append(removeBtn);
            }
        });
        // Add remove stat button to each stat row label
        table.find('td.stat-label').each(function () {
            const td = $(this);
            if (td.find('.remove-stat-btn').length === 0) {
                const statKey = td.attr('data-stat-key');
                const statName = td.find('span').text().trim();
                const removeStatBtn = $('<i class="fas fa-times remove-stat-btn" title="Remove stat"></i>')
                    .css({ cursor: 'pointer', marginLeft: '5px', opacity: '0.7' })
                    .hover(function () { $(this).css('opacity', '1'); }, function () { $(this).css('opacity', '0.7'); })
                    .on('click', function (e) {
                    e.stopPropagation();
                    var messagesToDelete = [];
                    if (e.shiftKey) {
                        const confirmDelete = confirm(`Are you sure you want to remove stat '${statName}' from ALL messages?`);
                        if (!confirmDelete)
                            return;
                        messagesToDelete = Chat.getStatEligibleMessages().slice(messageId)
                            .map((msg, idx) => ({ msg, idx: messageId + idx }))
                            .filter(({ msg }) => !msg.is_system);
                    }
                    else if (e.ctrlKey) {
                        const confirmDelete = confirm(`Remove stat '${statName}' from next 5 messages?`);
                        if (!confirmDelete)
                            return;
                        messagesToDelete = Chat.getStatEligibleMessages().slice(messageId)
                            .map((msg, idx) => ({ msg, idx: messageId + idx }))
                            .filter(({ msg }) => !msg.is_system)
                            .slice(0, 5);
                    }
                    else {
                        messagesToDelete = [{ idx: messageId }];
                    }
                    for (const { idx } of messagesToDelete) {
                        const currentStats = Chat.getMessageStats(idx);
                        if (currentStats) {
                            for (const char in currentStats.Characters) {
                                if (currentStats.Characters[char] && currentStats.Characters[char][statKey] !== undefined) {
                                    delete currentStats.Characters[char][statKey];
                                }
                            }
                            setMessageStats(currentStats, idx);
                        }
                    }
                    container.removeClass('editing');
                    editButton.removeClass('fa-check').addClass('fa-pencil').attr('title', 'Edit stats');
                    saveChatConditional();
                });
                td.append(removeStatBtn);
            }
        });
        table.find('td[data-character]').each(function () {
            const cell = $(this);
            const value = cell.text();
            const inputContainer = $('<div>').addClass('stat-input-container');
            const input = $('<input type="text">').val(value).addClass('stat-input');
            const statRegenerateButton = $('<div class="fa-solid fa-rotate" title="Click: Regenerate this stat\nAlt+Click: More randomness\nShift+Click: Regenerate in all later messages\nCtrl+Click: Regenerate in next 5 messages\nRight Click: Copy from previous message(s)"></div>').addClass('stats-regenerate-button stat-cell-regenerate');
            statRegenerateButton.on('mousedown', async function (e) {
                e.stopPropagation();
                const copyOver = e.button === 2;
                if (copyOver)
                    e.preventDefault();
                const char = cell.attr('data-character');
                const stat = cell.attr('data-stat');
                const { indices, description } = getRegenerationIndices(messageId, e);
                const greedy = e.altKey !== true;
                let toastMessage = '';
                if (indices.length > 1) {
                    toastMessage = `Regenerated ${stat} for ${char} in ${indices.length} messages (${description})`;
                }
                else {
                    toastMessage = `Regenerated ${stat} for ${char} in ${description}`;
                }
                console.log(`StatSuite: Regenerating ${stat} for ${char} in ${description}${copyOver ? ' (copyOver)' : ''}`);
                await regenerateStatsBatch(indices, { char, stat, greedy, toastMessage, copyOver });
            });
            inputContainer.append(statRegenerateButton, input);
            cell.empty().append(inputContainer);
        });
        table.find('.stats-col-regenerate, .stats-row-regenerate').css('display', 'inline-block');
        editButton.removeClass('fa-pencil').addClass('fa-check').attr('title', 'Save changes');
    }
    else {
        const newStats = JSON.parse(JSON.stringify(stats));
        let changed = false;
        table.find('td[data-character]').each(function () {
            const cell = $(this);
            const char = cell.attr('data-character');
            const stat = cell.attr('data-stat');
            const newValue = sanitizeStatInput(cell.find('input').val());
            if (newStats.Characters[char][stat] !== newValue) {
                newStats.Characters[char][stat] = newValue;
                changed = true;
            }
        });
        if (changed) {
            setMessageStats(newStats, messageId);
        }
        else {
            container.removeClass('editing');
            editButton.removeClass('fa-check').addClass('fa-pencil').attr('title', 'Edit stats');
            displayStats(messageId, stats);
        }
        table.find('.stats-col-regenerate, .stats-row-regenerate').css('display', 'none');
    }
}
/**
 * Renders the stats table and controls for a message.
 * @param {number} messageId
 * @param {ChatStatEntry} stats
 */
export function displayStats(messageId, stats) {
    const messageDiv = $(`[mesid="${messageId}"]`);
    if (!messageDiv.length)
        return;
    messageDiv.find('.stats-table-container').remove();
    const characters = Object.keys(stats.Characters);
    if (characters.length === 0)
        return;
    const registryChars = characters.filter(c => Characters.getCharacterIx(c) !== -1);
    const unknownChars = characters.filter(c => Characters.getCharacterIx(c) === -1);
    registryChars.sort((a, b) => Characters.getCharacterIx(a) - Characters.getCharacterIx(b));
    unknownChars.sort((a, b) => a.localeCompare(b));
    const sortedCharacters = [...registryChars, ...unknownChars];
    const parentDiv = $('<div class="stats-table-container"></div>');
    if (ExtensionSettings && ExtensionSettings.collapseOldStats) {
        $("details.stats-details").removeAttr('open');
    }
    const container = $('<details class="stats-details"></details>');
    if (messageId === chat.length - 1) {
        container.on('toggle', function () {
            if (( /** @type {HTMLDetailsElement} */(this)).open) {
                setTimeout(() => {
                    const chatDiv = $("#chat");
                    chatDiv.scrollTop(chatDiv[0].scrollHeight);
                }, 0);
            }
        });
    }
    if (ExtensionSettings && ExtensionSettings.showStats) {
        container.attr('open', 'open');
    }
    const summary = $('<summary class="stats-summary">Stats</summary>');
    container.append(summary);
    parentDiv.append(container);
    // Use new helpers for header, body, and controls
    const table = $('<table class="stats-table"></table>');
    table.append(renderStatsTableHeader(sortedCharacters, messageId));
    const presentStats = getPresentStats(sortedCharacters, stats);
    renderStatsTableBody(presentStats, sortedCharacters, stats, messageId).forEach(row => table.append(row));
    container.append(renderStatsTableControls(messageId, container, table, stats));
    container.append(table);
    messageDiv.find('.mes_text').first().after(parentDiv);
}
