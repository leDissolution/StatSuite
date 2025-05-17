// Handles rendering and editing of the stats table for messages

import { setMessageStats, getRecentMessages, makeStats } from '../stats/stats_logic.js';
import { exportSingleMessage } from '../export.js';
import { chat, saveChatConditional } from '../../../../../script.js';
import { ExtensionSettings } from '../settings.js';
import { Stats } from '../stats/stats_registry.js';

/**
 * Batch regenerate stats for a set of messages.
 * @param {Array<number>} messageIndices - Indices of messages to process.
 * @param {Object} options - { char, stat, greedy, toastMessage }
 */
async function regenerateStatsBatch(messageIndices, { char = null, stat = null, greedy = true, toastMessage = '' } = {}) {
    try {
        for (const idx of messageIndices) {
            await makeStats(idx, char, stat, greedy);
        }
        if (messageIndices.length > 1 && toastMessage) {
            toastr.success(toastMessage);
        }
    } catch (error) {
        console.error('StatSuite: Error during regeneration:', error);
        toastr.error('StatSuite: An error occurred during regeneration.');
    }
}

/**
 * Utility to compute message indices for regeneration based on key modifiers.
 * @param {number} startIndex - The starting message index.
 * @param {KeyboardEvent} e - The event object (for key modifiers).
 * @returns {{indices: number[], description: string}}
 */
function getRegenerationIndices(startIndex, e) {
    let indices = [];
    let description = '';
    if (e.shiftKey) {
        indices = chat.slice(startIndex)
            .map((msg, idx) => startIndex + idx)
            .filter(idx => !chat[idx].is_system);
        description = `all messages from ${startIndex}`;
    } else if (e.ctrlKey) {
        indices = chat.slice(startIndex)
            .map((msg, idx) => startIndex + idx)
            .filter(idx => !chat[idx].is_system)
            .slice(0, 5);
        description = `next 5 messages from ${startIndex}`;
    } else {
        indices = [startIndex];
        description = `message ${startIndex}`;
    }
    return { indices, description };
}

/**
 * Renders the stats table and controls for a message.
 * @param {number} messageId
 * @param {object} stats
 */
export function displayStats(messageId, stats) {
    const messageDiv = $(`[mesid="${messageId}"]`);
    if (!messageDiv.length) return;
    messageDiv.find('.stats-table-container').remove();
    const characters = Object.keys(stats);
    if (characters.length === 0) return;
    const parentDiv = $('<div class="stats-table-container"></div>');
    if (ExtensionSettings && ExtensionSettings.collapseOldStats) {
        $("details.stats-details").removeAttr('open');
    }
    const container = $('<details class="stats-details"></details>');
    if (ExtensionSettings && ExtensionSettings.showStats) {
        container.attr('open', true);
    }
    if (messageId === chat.length - 1) {
        container.on('toggle', function () {
            if (this.open) {
                setTimeout(() => {
                    const chatDiv = $("#chat");
                    chatDiv.scrollTop(chatDiv[0].scrollHeight);
                }, 0);
            }
        });
    }
    const summary = $('<summary class="stats-summary">Stats</summary>');
    container.append(summary);
    parentDiv.append(container);
    const buttonContainer = $('<div class="stats-button-container"></div>');
    const regenerateButton = $('<div class="stats-regenerate-button fa-solid fa-rotate" title="Click: Regenerate all stats\nAlt+Click: Regenerate with more randomness\nShift+Click: Regenerate all later messages\nCtrl+Click: Regenerate next 5 messages"></div>');
    const editButton = $('<div class="stats-edit-button fa-solid fa-pencil" title="Edit stats"></div>');
    const exportButton = $('<div class="stats-export-button fa-solid fa-copy" title="Copy message export format"></div>');
    buttonContainer.append(regenerateButton, editButton, exportButton);
    buttonContainer.on('mouseenter', '.fa-solid', function () { $(this).css('opacity', '1'); })
                   .on('mouseleave', '.fa-solid', function () { $(this).css('opacity', '0.3'); });
    container.append(buttonContainer);
    const table = $('<table class="stats-table"></table>');
    const headerRow = $('<tr></tr>');
    headerRow.append($('<th></th>'));
    characters.forEach(char => {
        const th = $('<th></th>');
        const colRegenBtn = $('<div class="fa-solid fa-rotate stats-col-regenerate" title="Regenerate all stats for this character\nAlt+Click: More randomness\nShift+Click: All later messages\nCtrl+Click: Next 5 messages"></div>')
            .css({ cursor: 'pointer', marginRight: '5px', opacity: '0.3', display: 'none', verticalAlign: 'middle' })
            .hover(function() { $(this).css('opacity', '1'); }, function() { $(this).css('opacity', '0.3'); })
            .on('click', async function(e) {
                e.stopPropagation();
                const { indices, description } = getRegenerationIndices(messageId, e);
                const greedy = e.altKey !== true;
                let toastMessage = '';
                if (indices.length > 1) {
                    toastMessage = `Regenerated all stats for ${char} in ${indices.length} messages (${description})`;
                } else {
                    toastMessage = `Regenerated all stats for ${char} in ${description}`;
                }
                console.log(`StatSuite: Regenerating all stats for ${char} in ${description}`);
                await regenerateStatsBatch(indices, { char, greedy, toastMessage });
            });
        th.append(colRegenBtn, $('<span></span>').text(char));
        headerRow.append(th);
    });
    table.append(headerRow);
    const presentStats = characters.reduce((acc, char) => {
        const charStats = stats[char];
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
        const aConfig = Stats.getStatConfig(a) || {};
        const bConfig = Stats.getStatConfig(b) || {};
        const aOrder = aConfig.order || 0;
        const bOrder = bConfig.order || 0;
        return aOrder - bOrder;
    });
    presentStats.forEach(stat => {
        const row = $('<tr></tr>');
        // Row regen button (hidden by default, shown in edit mode)
        const rowRegenBtn = $('<div class="fa-solid fa-rotate stats-row-regenerate" title="Regenerate this stat for all characters\nAlt+Click: More randomness\nShift+Click: All later messages\nCtrl+Click: Next 5 messages"></div>')
            .css({ cursor: 'pointer', marginRight: '5px', opacity: '0.3', display: 'none', verticalAlign: 'middle' })
            .hover(function() { $(this).css('opacity', '1'); }, function() { $(this).css('opacity', '0.3'); })
            .on('click', async function(e) {
                e.stopPropagation();
                const { indices, description } = getRegenerationIndices(messageId, e);
                const greedy = e.altKey !== true;
                let toastMessage = '';
                if (indices.length > 1) {
                    toastMessage = `Regenerated ${stat} for all characters in ${indices.length} messages (${description})`;
                } else {
                    toastMessage = `Regenerated ${stat} for all characters in ${description}`;
                }
                console.log(`StatSuite: Regenerating ${stat} for all characters in ${description}`);
                await regenerateStatsBatch(indices, { stat, greedy, toastMessage });
            });
        const statLabelTd = $('<td></td>').addClass('stat-label');
        statLabelTd.append(rowRegenBtn, $('<span></span>').text(stat.toLowerCase()));
        row.append(statLabelTd);
        characters.forEach(char => {
            const statValue = (stats[char] && stats[char][stat] !== undefined) ? stats[char][stat] : (Stats.getStatConfig(stat)?.defaultValue || 'unspecified');
            const cell = $('<td></td>')
                .text(statValue)
                .attr('data-character', char)
                .attr('data-stat', stat);
            row.append(cell);
        });
        table.append(row);
    });
    container.append(table);
    messageDiv.find('.mes_text').first().after(parentDiv);
    exportButton.on('click', function () {
        const messages = getRecentMessages(messageId);
        if (messages) {
            exportSingleMessage(messages);
        } else {
            toastr.error("StatSuite: Could not retrieve message context for export.");
        }
    });
    regenerateButton.on('click', async function (e) {
        const { indices, description } = getRegenerationIndices(messageId, e);
        const greedy = e.altKey !== true;
        let toastMessage = '';
        if (indices.length > 1) {
            toastMessage = `Regenerated all stats in ${indices.length} messages (${description})`;
        } else {
            toastMessage = `Regenerated stats for ${description}`;
        }
        console.log(`StatSuite: Regenerating stats for ${description}`);
        await regenerateStatsBatch(indices, { greedy, toastMessage });
    });
    editButton.on('click', function () {
        const isEditing = container.hasClass('editing');
        if (!isEditing) {
            container.addClass('editing');
            table.find('th').not(':first').each(function () {
                const th = $(this);
                if (th.find('.remove-character-btn').length === 0) {
                    const charName = th.text().replace(/×$/, '').trim();
                    const removeBtn = $('<i class="fas fa-times remove-character-btn" title="Remove character"></i>')
                        .css({ cursor: 'pointer', marginLeft: '5px', opacity: '0.7' })
                        .hover(function() { $(this).css('opacity', '1'); }, function() { $(this).css('opacity', '0.7'); })
                        .on('click', function(e) {
                            e.stopPropagation();
                            var messagesToDelete = [];
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
                                                        .filter(({ msg }) => !msg.is_system)
                                                        .slice(0, 5);
                            } else {
                                messagesToDelete = [{ idx: messageId }];
                            }
                            for (const { idx } of messagesToDelete) {
                                const currentStats = chat[idx].stats;
                                if (currentStats) {
                                    delete currentStats[charName];
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
            table.find('td[data-character]').each(function () {
                const cell = $(this);
                const value = cell.text();
                const inputContainer = $('<div>').addClass('stat-input-container');
                const input = $('<input type="text">').val(value).addClass('stat-input');
                const statRegenerateButton = $('<div class="fa-solid fa-rotate" title="Click: Regenerate this stat\nAlt+Click: More randomness\nShift+Click: Regenerate in all later messages\nCtrl+Click: Regenerate in next 5 messages"></div>').addClass('stats-regenerate-button stat-cell-regenerate');
                statRegenerateButton.on('click', async function (e) {
                    e.stopPropagation();
                    const char = cell.attr('data-character');
                    const stat = cell.attr('data-stat');
                    const { indices, description } = getRegenerationIndices(messageId, e);
                    const greedy = e.altKey !== true;
                    let toastMessage = '';
                    if (indices.length > 1) {
                        toastMessage = `Regenerated ${stat} for ${char} in ${indices.length} messages (${description})`;
                    } else {
                        toastMessage = `Regenerated ${stat} for ${char} in ${description}`;
                    }
                    console.log(`StatSuite: Regenerating ${stat} for ${char} in ${description}`);
                    await regenerateStatsBatch(indices, { char, stat, greedy, toastMessage });
                });
                inputContainer.append(statRegenerateButton, input);
                cell.empty().append(inputContainer);
            });
            table.find('.stats-col-regenerate, .stats-row-regenerate').css('display', 'inline-block');
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
            table.find('.stats-col-regenerate, .stats-row-regenerate').css('display', 'none');
        }
    });
}
