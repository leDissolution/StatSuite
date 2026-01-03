import { setMessageStats, getRecentMessages, makeStats } from '../stats/stats-logic.js';
import { exportSingleMessage } from '../export.js';
import { chat, saveChatConditional } from '../../../../../../script.js';
import { ExtensionSettings, getActiveScopes } from '../settings.js';
import { Stats } from '../stats/stats-registry.js';
import { Chat, IndexedChatMessage } from '../chat/chat-manager.js';
import { ChatStatEntry } from '../chat/chat-stat-entry.js';
import { StatScope } from '../stats/stat-entry.js';
import { getScopeAdapter } from './scope-adapters.js';
import type { ScopeAdapter } from './scope-adapters.js';

function sanitizeStatInput(value: string): string {
    if (typeof value !== 'string') return value;

    let sanitized = value.replace(/\t/g, '');
    sanitized = sanitized.replace(/\s(a|an|the)\s+/i, ' ');
    sanitized = sanitized.replace(/ {2,}/g, ' ');
    sanitized = sanitized.replace(/ +,/g, ',');
    sanitized = sanitized.trim();
    sanitized = sanitized.replace(/^,|,$/g, '');

    return sanitized;
}

async function regenerateStatsBatch(messageIndices: Array<number>, subject: string | null = null, stat: string | null = null, greedy: boolean = true, toastMessage: string = '', copyOver: boolean = false, scope: StatScope | null = null) {
    try {
        for (const idx of messageIndices) {
            await makeStats(idx, subject, stat, greedy, copyOver, scope);
        }
        if (messageIndices.length > 1 && toastMessage) {
            toastr.success(toastMessage);
        }
    } catch (error) {
        console.error('StatSuite: Error during regeneration:', error);
        toastr.error('StatSuite: An error occurred during regeneration.');
    }
}

function getRegenerationIndices(startIndex: number, e: JQuery.MouseDownEvent): { indices: number[]; description: string; } {
    let count = 1;
    let description = '';
    if (e.shiftKey) {
        count = 9999;
        description = `all messages from ${startIndex}`;
    } else if (e.ctrlKey) {
        count = 5;
        description = `next 5 messages from ${startIndex}`;
    } else {
        count = 1;
        description = `message ${startIndex}`;
    }

    const indices = Chat.getMessagesFrom(startIndex, count);
    return { indices, description };
}

function renderStatsTableHeader(subjects: string[], messageId: number, adapter: ScopeAdapter): JQuery<HTMLElement> {
    const headerRow = $('<tr></tr>');
    const firstTh = $('<th></th>');
    const scopeRegenBtn = $(`<div class="fa-solid fa-rotate stats-scope-regenerate" title="Regenerate all stats for all ${adapter.pluralLabel.toLowerCase()} in this scope\nAlt+Click: More randomness\nShift+Click: Regenerate all later messages\nCtrl+Click: Next 5 messages\nRight Click: Copy from previous message(s)"></div>`)
        .css({ cursor: 'pointer', marginRight: '5px', opacity: '0.3', display: 'none', verticalAlign: 'middle' })
        .hover(function() { $(this).css('opacity', '1'); }, function() { $(this).css('opacity', '0.3'); })
        .on('mousedown', async function(e) {
            e.stopPropagation();
            const copyOver = e.button === 2;
            if (copyOver) e.preventDefault();
            const { indices, description } = getRegenerationIndices(messageId, e);
            const greedy = e.altKey !== true;
            let toastMessage = '';
            if (indices.length > 1) {
                toastMessage = `Regenerated all stats for all ${adapter.pluralLabel.toLowerCase()} in ${indices.length} messages (${description})`;
            } else {
                toastMessage = `Regenerated all stats for all ${adapter.pluralLabel.toLowerCase()} in ${description}`;
            }
            console.log(`StatSuite: Regenerating entire ${adapter.pluralLabel} scope in ${description}${copyOver ? ' (copyOver)' : ''}`);
            await regenerateStatsBatch(indices, null, null, greedy, toastMessage, copyOver, adapter.scope);
        })
        .on('contextmenu', function(e) { e.preventDefault(); e.stopPropagation(); return false; });
    firstTh.append(scopeRegenBtn);
    headerRow.append(firstTh);
    subjects.forEach(char => {
        const th = $('<th></th>');
        const colRegenBtn = $(`<div class="fa-solid fa-rotate stats-col-regenerate" title="Regenerate all stats for this ${adapter.label}\nAlt+Click: Regenerate with more randomness\nShift+Click: Regenerate all later messages\nCtrl+Click: Regenerate next 5 messages\nRight Click: Copy stats from previous message(s)"></div>`)
            .css({ cursor: 'pointer', marginRight: '5px', opacity: '0.3', display: 'none', verticalAlign: 'middle' })
            .hover(function() { $(this).css('opacity', '1'); }, function() { $(this).css('opacity', '0.3'); })
            .on('mousedown', async function(e) {
                e.stopPropagation();
                const copyOver = e.button === 2;
                if (copyOver) e.preventDefault();
                const { indices, description } = getRegenerationIndices(messageId, e);
                const greedy = e.altKey !== true;
                let toastMessage = '';
                if (indices.length > 1) {
                    toastMessage = `Regenerated all stats for ${char} in ${indices.length} messages (${description})`;
                } else {
                    toastMessage = `Regenerated all stats for ${char} in ${description}`;
                }
                console.log(`StatSuite: Regenerating all stats for ${char} in ${description}${copyOver ? ' (copyOver)' : ''}`);
                await regenerateStatsBatch(indices, char, null, greedy, toastMessage, copyOver, adapter.scope);
            })
            .on('contextmenu', function(e) { e.preventDefault(); e.stopPropagation(); return false; });
        th.append(colRegenBtn, $('<span></span>').text(char));
        
        headerRow.append(th);
    });
    return headerRow;
}

function renderStatsTableBody(presentStats: string[], subjects: string[], bucket: Record<string, any>, messageId: number, adapter: ScopeAdapter): JQuery<HTMLElement>[] {
    return presentStats.map(stat => {
        const row = $('<tr></tr>');
        // Row regen button (hidden by default, shown in edit mode)
        const statLabelTd = $('<td></td>').addClass('stat-label').attr('data-stat-key', stat);
        const rowRegenBtn = $(`<div class="fa-solid fa-rotate stats-row-regenerate" title="Regenerate this stat for all ${adapter.pluralLabel}\nAlt+Click: More randomness\nShift+Click: Regenerate in all later messages\nCtrl+Click: Next 5 messages\nRight Click: Copy from previous message(s)"></div>`)
            .css({ cursor: 'pointer', marginRight: '5px', opacity: '0.3', display: 'none', verticalAlign: 'middle' })
            .hover(function() { $(this).css('opacity', '1'); }, function() { $(this).css('opacity', '0.3'); })
            .on('mousedown', async function(e) {
                e.stopPropagation();
                const copyOver = e.button === 2;
                if (copyOver) e.preventDefault();
                const { indices, description } = getRegenerationIndices(messageId, e);
                const greedy = e.altKey !== true;
                let toastMessage = '';
                if (indices.length > 1) {
                    toastMessage = `Regenerated ${stat} for all ${adapter.pluralLabel.toLowerCase()} in ${indices.length} messages (${description})`;
                } else {
                    toastMessage = `Regenerated ${stat} for all ${adapter.pluralLabel.toLowerCase()} in ${description}`;
                }
                console.log(`StatSuite: Regenerating ${stat} for all ${adapter.pluralLabel.toLowerCase()} in ${description}${copyOver ? ' (copyOver)' : ''}`);
                await regenerateStatsBatch(indices, null, stat, greedy, toastMessage, copyOver, adapter.scope);
            })
            .on('contextmenu', function(e) { e.preventDefault(); e.stopPropagation(); return false; });
        statLabelTd.append(rowRegenBtn);
        statLabelTd.append($('<span></span>').text(Stats.getStatEntry(stat)?.displayName || stat));
        row.append(statLabelTd);
        subjects.forEach(char => {
            const charBlock = bucket[char];
            const statValue = (charBlock && charBlock[stat] !== undefined) ? charBlock[stat] : (Stats.getStatEntry(stat)?.defaultValue || 'unspecified');
            const cell = $('<td></td>')
                .text(statValue!)
                .attr('data-character', char)
                .attr('data-stat', stat);
            row.append(cell);
        });
        return row;
    });
}

function getPresentStats(subjects: string[], bucket: Record<string, any>): string[] {
    const presentStats = subjects.reduce<string[]>((acc, char) => {
        const charStats = bucket[char];
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
        const aOrder = aConfig?.order || 0;
        const bOrder = bConfig?.order || 0;
        return aOrder - bOrder;
    });
    return presentStats;
}

function renderStatsTableControls(messageId: number, container: JQuery<HTMLElement>, stats: ChatStatEntry): JQuery<HTMLElement> {
    const buttonContainer = $('<div class="stats-button-container"></div>');
    const regenerateButton = $('<div class="stats-regenerate-button fa-solid fa-rotate" title="Click: Regenerate all stats\nAlt+Click: Regenerate with more randomness\nShift+Click: Regenerate all later messages\nCtrl+Click: Regenerate next 5 messages\nRight Click: Copy stats from previous message(s)"></div>');
    const editButton = $('<div class="stats-edit-button fa-solid fa-pencil" title="Edit stats"></div>');
    const addSceneButton = $('<div class="stats-add-scene-button fa-solid fa-plus" title="Add scene to this message" style="display:none;"></div>');
    const exportToggleButton = $('<div class="stats-export-toggle-button fa-regular"></div>');
    const exportButton = $('<div class="stats-export-button fa-solid fa-copy" title="Copy message export format"></div>');
    const deleteButton = $('<div class="stats-delete-button fa-solid fa-trash" title="Delete stats from message(s)"></div>');
    const discardButton = $('<div class="stats-discard-button fa-solid fa-xmark" title="Discard changes" style="display:none;"></div>');
    buttonContainer.append(regenerateButton, editButton, discardButton, addSceneButton, exportToggleButton, exportButton, deleteButton);
    buttonContainer.on('mouseenter', '.fa-solid, .fa-regular', function () { $(this).css('opacity', '1'); })
                   .on('mouseleave', '.fa-solid, .fa-regular', function () { $(this).css('opacity', '0.3'); });
    const updateExportToggleButton = () => {
        const message = Chat.getMessage(messageId);
        const exportStats = message?.exportStats !== false;
        exportToggleButton
            .toggleClass('fa-eye', exportStats)
            .toggleClass('fa-eye-slash', !exportStats)
            .attr('title', exportStats ? 'Exclude stats from export' : 'Include stats in export');
    };
    updateExportToggleButton();
    exportToggleButton.on('click', function (e) {
        e.stopPropagation();
        const message = Chat.getMessage(messageId);
        if (!message) return;
        const exportStats = message.exportStats !== false;
        if (exportStats) {
            message.exportStats = false;
        } else {
            delete message.exportStats;
        }
        saveChatConditional();
        updateExportToggleButton();
    });
    // Export
    exportButton.on('click', function () {
        const messages = getRecentMessages(messageId);
        if (messages) {
            exportSingleMessage(messages);
        } else {
            toastr.error("StatSuite: Could not retrieve message context for export.");
        }
    });
    // Regenerate
    regenerateButton.on('mousedown', async function (e) {
        e.stopPropagation();
        const copyOver = e.button === 2;
        if (copyOver) e.preventDefault();
        const { indices, description } = getRegenerationIndices(messageId, e);
        const greedy = e.altKey !== true;
        let toastMessage = '';
        if (indices.length > 1) {
            toastMessage = `Regenerated all stats in ${indices.length} messages (${description})`;
        } else {
            toastMessage = `Regenerated stats for ${description}`;
        }
    console.log(`StatSuite: Regenerating stats for ${description}${copyOver ? ' (copyOver)' : ''}`);
    // Apply to all active scopes by passing null
    await regenerateStatsBatch(indices, null, null, greedy, toastMessage, copyOver, null);
    }).on('contextmenu', function(e) { e.preventDefault(); e.stopPropagation(); return false; });
    // Delete
    deleteButton.on('mousedown', function(e) {
        e.stopPropagation();
        const { indices, description } = getRegenerationIndices(messageId, e);
        let confirmMsg = '';
        if (indices.length > 1) {
            confirmMsg = `Are you sure you want to delete stats from ${indices.length} messages (${description})?`;
        } else {
            confirmMsg = `Are you sure you want to delete stats from message ${messageId}?`;
        }
        if (!confirm(confirmMsg)) return;
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
        bindStatsTableEditMode(container, stats, messageId, editButton, discardButton);
    });
    // Add Scene (only when editing; toggled in bindStatsTableEditMode)
    addSceneButton.on('click', function() {
        if (!(ExtensionSettings && ExtensionSettings.enableScenes)) {
            toastr.warning('Enable scenes in StatSuite settings to use this.');
            return;
        }
        const name = prompt('Enter scene name to add to this message:')?.trim();
        if (!name) return;
        const currentStats = Chat.getMessageStats(messageId) || stats;
        const b = getScopeAdapter(StatScope.Scene).getBucket(currentStats) as Record<string, any>;
        if (b[name] !== undefined) {
            toastr.info(`Scene '${name}' already exists in this message.`);
            return;
        }
        b[name] = {};
        setMessageStats(currentStats, messageId);
        saveChatConditional();
        // Re-render to reflect the new scene column
        displayStats(messageId, currentStats, getActiveScopes());
    });
    discardButton.on('click', function () {
        container.removeClass('editing');
        editButton.removeClass('fa-check').addClass('fa-pencil').attr('title', 'Edit stats');
        discardButton.hide();
    addSceneButton.hide();
        // Re-render the stats table to restore original values
    displayStats(messageId, stats, getActiveScopes());
    });
    return buttonContainer;
}

function bindStatsTableEditMode(container: JQuery<HTMLElement>, stats: ChatStatEntry, messageId: number, editButton: JQuery<HTMLElement>, discardButton: JQuery<HTMLElement>) {
    const isEditing = container.hasClass('editing');
    if (!isEditing) {
        container.addClass('editing');
        if (discardButton) discardButton.show();
    container.find('.stats-add-scene-button').show();
        // For each scope table, add remove buttons and inputs
        container.find('table.stats-table').each(function () {
            const scopeStr = $(this).attr('data-scope');
            const scopeVal = scopeStr ? (scopeStr as StatScope) : StatScope.Character;
            const adapter = getScopeAdapter(scopeVal);
            const table = $(this);
            // If this is the Scene scope, add an "Add Scene" button in the header (edit mode only)
            if (adapter.scope === StatScope.Scene) {
                const firstTh = table.find('thead th').length ? table.find('thead th').first() : table.find('tr').first().find('th').first();
                if (firstTh.length && firstTh.find('.add-scene-btn').length === 0) {
                    const addSceneBtn = $('<i class="fa-solid fa-plus add-scene-btn" title="Add scene to this message"></i>')
                        .css({ cursor: 'pointer', marginLeft: '6px', opacity: '0.7' })
                        .hover(function() { $(this).css('opacity', '1'); }, function() { $(this).css('opacity', '0.7'); })
                        .on('click', function(e) {
                            e.stopPropagation();
                            const name = prompt('Enter scene name to add to this message:')?.trim();
                            if (!name) return;
                            const currentStats = Chat.getMessageStats(messageId);
                            if (!currentStats) return;
                            const b = adapter.getBucket(currentStats) as Record<string, any>;
                            if (b[name] !== undefined) {
                                toastr.info(`Scene '${name}' already exists in this message.`);
                                return;
                            }
                            b[name] = {};
                            setMessageStats(currentStats, messageId);
                            saveChatConditional();
                            // Re-render to show the new column; exit edit mode like other destructive ops
                            container.removeClass('editing');
                            if (discardButton) discardButton.hide();
                            editButton.removeClass('fa-check').addClass('fa-pencil').attr('title', 'Edit stats');
                            displayStats(messageId, currentStats, getActiveScopes());
                        });
                    firstTh.append(addSceneBtn);
                }
            }
            table.find('th').not(':first').each(function () {
            const th = $(this);
            if (th.find('.remove-character-btn').length === 0) {
                const charName = th.text().replace(/×$/, '').trim();
                const removeBtn = $(`<i class="fas fa-times remove-character-btn" title="Remove ${adapter.label}"></i>`)
                    .css({ cursor: 'pointer', marginLeft: '5px', opacity: '0.7' })
                    .hover(function() { $(this).css('opacity', '1'); }, function() { $(this).css('opacity', '0.7'); })
                    .on('click', function(e) {
                        e.stopPropagation();
                        let messagesToDelete: Array<IndexedChatMessage> = [];
                        if (e.shiftKey) {
                            const confirmDelete = confirm(`Are you sure you want to remove ${charName} from ALL messages?`);
                            if (!confirmDelete) return;
                            messagesToDelete = Chat.getStatEligibleMessages().slice(messageId)
                                .filter(({ message }) => !message.is_system);
                        } else if (e.ctrlKey) {
                            const confirmDelete = confirm(`Remove ${charName} from next 5 messages?`);
                            if (!confirmDelete) return;
                            messagesToDelete = Chat.getStatEligibleMessages().slice(messageId)
                                .filter(({ message }) => !message.is_system)
                                .slice(0, 5);
                        } else {
                            messagesToDelete = [{ message: Chat.getMessage(messageId)!, index: messageId }];
                        }
                        for (const { index } of messagesToDelete) {
                            const currentStats = Chat.getMessageStats(index);
                            if (currentStats) {
                                adapter.removeSubject(currentStats, charName);
                                setMessageStats(currentStats, index);
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
                if (!statKey) return;

                const statName = td.find('span').text().trim();
                const removeStatBtn = $('<i class="fas fa-times remove-stat-btn" title="Remove stat"></i>')
                    .css({ cursor: 'pointer', marginLeft: '5px', opacity: '0.7' })
                    .hover(function() { $(this).css('opacity', '1'); }, function() { $(this).css('opacity', '0.7'); })
                    .on('click', function(e) {
                        e.stopPropagation();
                        var messagesToDelete: Array<IndexedChatMessage> = [];
                        if (e.shiftKey) {
                            const confirmDelete = confirm(`Are you sure you want to remove stat '${statName}' from ALL messages?`);
                            if (!confirmDelete) return;
                            messagesToDelete = Chat.getStatEligibleMessages().slice(messageId)
                                .filter(({ message }) => !message.is_system);
                        } else if (e.ctrlKey) {
                            const confirmDelete = confirm(`Remove stat '${statName}' from next 5 messages?`);
                            if (!confirmDelete) return;
                            messagesToDelete = Chat.getStatEligibleMessages().slice(messageId)
                                .map(({ message }, idx) => ({ message, index: messageId + idx }))
                                .filter(({ message }) => !message.is_system)
                                .slice(0, 5);
                        } else {
                            messagesToDelete = [{ message: Chat.getMessage(messageId)!, index: messageId }];
                        }
                        for (const { index } of messagesToDelete) {
                            const currentStats = Chat.getMessageStats(index);
                            if (currentStats) {
                                const b = adapter.getBucket(currentStats) as Record<string, any>;
                                for (const char in b) {
                                    if (b[char] && b[char][statKey] !== undefined) {
                                        delete b[char][statKey];
                                    }
                                }
                                setMessageStats(currentStats, index);
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
                    if (copyOver) e.preventDefault();
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
                    console.log(`StatSuite: Regenerating ${stat} for ${char} in ${description}${copyOver ? ' (copyOver)' : ''}`);
                    await regenerateStatsBatch(indices, char, stat, greedy, toastMessage, copyOver, adapter.scope);
                }).on('contextmenu', function(e) { e.preventDefault(); e.stopPropagation(); return false; });
                inputContainer.append(statRegenerateButton, input);
            cell.empty().append(inputContainer);
            });
            table.find('.stats-col-regenerate, .stats-row-regenerate, .stats-scope-regenerate').css('display', 'inline-block');
        });
        editButton.removeClass('fa-pencil').addClass('fa-check').attr('title', 'Save changes');
    } else {
        const newStats = stats.clone();
        let changed = false;
        container.find('table.stats-table').each(function () {
            const scopeStr = $(this).attr('data-scope');
            const scopeVal = scopeStr ? (scopeStr as StatScope) : StatScope.Character;
            const adapter = getScopeAdapter(scopeVal);
            const table = $(this);
            table.find('td[data-character]').each(function () {
                const cell = $(this);
                const char = cell.attr('data-character');
                if (!char) return;

                const stat = cell.attr('data-stat');
                if (!stat) return;

                const newValue = sanitizeStatInput(String(cell.find('input').val()));
                const b = adapter.getBucket(newStats) as Record<string, any>;
                if (!b[char]) {
                    b[char] = {};
                }
                if (b[char][stat] !== newValue) {
                    b[char][stat] = newValue;
                    changed = true;
                }
            });
            table.find('.stats-col-regenerate, .stats-row-regenerate, .stats-scope-regenerate').css('display', 'none');
        });
        if (changed) {
            setMessageStats(newStats, messageId);
        } else {
            container.removeClass('editing');
            editButton.removeClass('fa-check').addClass('fa-pencil').attr('title', 'Edit stats');
            container.find('.stats-add-scene-button').hide();
            displayStats(messageId, stats, getActiveScopes());
        }
    }
}

export function displayStats(messageId: number, stats: ChatStatEntry, scopes: StatScope[]) {
    const messageDiv = $(`[mesid="${messageId}"]`);
    if (!messageDiv.length) return;
    messageDiv.find('.stats-table-container').remove();
    const sections = scopes.map(scope => {
        const adapter = getScopeAdapter(scope);
        const bucket = adapter.getBucket(stats);
        const subjects = Object.keys(bucket);
        if (subjects.length === 0) return null;

        const known = subjects.filter(name => adapter.getIndex(name) !== -1);
        const unknown = subjects.filter(name => adapter.getIndex(name) === -1);
        known.sort((a, b) => adapter.getIndex(a) - adapter.getIndex(b));
        unknown.sort((a, b) => a.localeCompare(b));
        const sortedSubjects = [...known, ...unknown];

        if (sortedSubjects.length === 0) return null;

        return { adapter, bucket, subjects: sortedSubjects } as const;
    }).filter((s): s is { adapter: ScopeAdapter; bucket: Record<string, any>; subjects: string[] } => !!s);

    if (sections.length === 0) return;

    const parentDiv = $('<div class="stats-table-container"></div>');
    if (ExtensionSettings && ExtensionSettings.collapseOldStats) {
        $("details.stats-details").removeAttr('open');
    }
    const container = $('<details class="stats-details"></details>');
    if (messageId === chat.length - 1) {
        container.on('toggle', function () {
            if ((this as HTMLDetailsElement).open) {
                setTimeout(() => {
                    const chatDiv = $("#chat");
                    chatDiv.scrollTop(chatDiv[0]?.scrollHeight || 0);
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
    let controlsAdded = false;
    for (const section of sections) {
        const table = $('<table class="stats-table"></table>');
        table.attr('data-scope', String(section.adapter.scope));
        const thead = $('<thead></thead>');
        thead.append(renderStatsTableHeader(section.subjects, messageId, section.adapter));
        table.append(thead);
        const presentStats = getPresentStats(section.subjects, section.bucket as any);
        renderStatsTableBody(presentStats, section.subjects, section.bucket as any, messageId, section.adapter).forEach(row => table.append(row));
        if (!controlsAdded) {
            container.append(renderStatsTableControls(messageId, container, stats));
            controlsAdded = true;
        }
        container.append(table);
    }
    messageDiv.find('.mes_text').first().after(parentDiv);
}
