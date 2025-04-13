// index.js - Main script for the StatSuite extension
// ====================================================

//#region Global Imports
import { extension_settings, getContext, loadExtensionSettings } from "../../../extensions.js";
import { saveSettingsDebounced, saveChatConditional } from "../../../../../../script.js";
import {
    substituteParams,
    eventSource,
    event_types,
    generateQuietPrompt,
    generateRaw,
    animation_duration,
    chat
} from '../../../../script.js';
import { dragElement } from '../../../../scripts/RossAscends-mods.js';
import { loadMovingUIState } from '../../../../scripts/power-user.js';
//#endregion

//#region Local Imports
import { Stats, generateStatPrompt, generateExportPrompt } from './prompts.js';
import { exportChat, exportSingleMessage, statsToStringFull } from './export.js';
//#endregion

const extensionName = "StatSuite";
const extensionFolderPath = `scripts/extensions/third-party/${extensionName}`;
const extensionSettings = extension_settings[extensionName] || {};
const defaultSettings = {};
const API_URL = "{0}/api/v1/generate";
const supportedStats = [Stats.POSE, Stats.LOCATION, Stats.OUTFIT, Stats.EXPOSURE, Stats.ACCESSORIES];

const StatConfig = {
    [Stats.POSE]: {
        dependencies: [],
        order: 0,
        defaultValue: "unspecified"
    },
    [Stats.LOCATION]: {
        dependencies: [Stats.POSE],
        order: 1,
        defaultValue: "unspecified"
    },
    [Stats.OUTFIT]: {
        dependencies: [],
        order: 2,
        defaultValue: "unspecified"
    },
    [Stats.EXPOSURE]: {
        dependencies: [Stats.OUTFIT],
        order: 4,
        defaultValue: "none"
    },
    [Stats.ACCESSORIES]: {
        dependencies: [Stats.OUTFIT],
        order: 3,
        defaultValue: "unspecified"
    }
};
//#endregion

//#region Settings Management
async function loadSettings() {
    if (Object.keys(extensionSettings).length === 0) {
        Object.assign(extensionSettings, defaultSettings);
    }

    $("#modelUrl").prop("value", extensionSettings.modelUrl).trigger("input");
    $("#modelUrl").on("input", function () {
        extensionSettings.modelUrl = $(this).prop("value");
        saveSettingsDebounced();
    });
}
//#endregion

//#region Utility Functions
function calcStats(statsObject) {
    // Placeholder for actual stat averaging logic.
    const averaged = {};
    for (const stat in statsObject) {
        const sum = statsObject[stat].reduce((acc, val) => acc + parseFloat(val || 0), 0);
        averaged[stat] = (sum / statsObject[stat].length).toFixed(2);
    }
    return averaged;
}

function parseStatsString(statsString) {
    const result = {};
    const charMatch = statsString.match(/character="([^"]+)"/);
    if (!charMatch) return null;
    const charName = charMatch[1];
    result[charName] = {};
    const matches = statsString.matchAll(/(\w+)="([^"]+)"/g);
    for (const match of matches) {
        const [_, key, value] = match;
        if (key !== 'character') {
            result[charName][key.toLowerCase()] = value;
        }
    }
    return result;
}

function getRecentMessages(specificMessageIndex = null) {
    let messages = [];
    if (specificMessageIndex !== null) {
        if (specificMessageIndex < 0 || specificMessageIndex >= chat.length) return null;
        if (specificMessageIndex === 0) {
            const firstMessage = chat[0];
            if (firstMessage.is_system) return null;
            const emptyStats = {};
            emptyStats[firstMessage.name] = {};
            for (const stat of supportedStats) {
                emptyStats[firstMessage.name][stat] = StatConfig[stat].defaultValue;
            }
            return {
                previousName: firstMessage.name,
                previousMessage: "",
                previousStats: emptyStats,
                previousIndex: -1,
                newName: firstMessage.name,
                newMessage: firstMessage.mes,
                newStats: firstMessage.stats,
                newIndex: 0
            }
        }
        messages = [chat[specificMessageIndex - 1], chat[specificMessageIndex]];
        if (messages.some(m => m.is_system)) return null;
    } else {
        messages = chat.filter(c => !c.is_system).slice(-2);
        if (messages.length !== 2) return null;
    }

    var previousStats = messages[0].stats || {};
    for (const char of [messages[0].name, messages[1].name]) {
        if (!previousStats[char]) previousStats[char] = {};
        for (const stat of supportedStats) {
            if (!previousStats[char][stat]) {
                previousStats[char][stat] = StatConfig[stat].defaultValue;
            }
        }
    }
    const prevIndex = chat.indexOf(messages[0]);
    const newIndex = chat.indexOf(messages[1]);

    return {
        previousName: messages[0].name,
        previousMessage: messages[0].mes,
        previousStats: previousStats,
        previousIndex: prevIndex,
        newName: messages[1].name,
        newMessage: messages[1].mes,
        newStats: messages[1].stats,
        newIndex: newIndex
    }
}

function getRequiredStats(targetStat) {
    const required = new Set();
    function addDependencies(stat) {
        StatConfig[stat].dependencies.forEach(dep => {
            addDependencies(dep);
            required.add(dep);
        });
        required.add(stat);
    }
    addDependencies(targetStat);
    return Array.from(required).sort((a, b) => StatConfig[a].order - StatConfig[b].order);
}
//#endregion

//#region Stats Generation & Update
async function generateStat(stat, char, messages, existingStats = {}, greedy = true) {
    const dependencies = {};
    if (StatConfig[stat].dependencies.length > 0) {
        StatConfig[stat].dependencies.forEach(dep => {
            if (existingStats[dep]) {
                dependencies[dep] = existingStats[dep];
            }
        });
    }

    const previousStatsString = statsToStringFull(messages.previousStats);
    const statPrompt = generateStatPrompt(
        stat,
        char,
        messages.previousName,
        messages.previousMessage,
        messages.newName,
        messages.newMessage,
        previousStatsString,
        dependencies
    );
    console.log(`Generating ${stat} for ${char}:`, statPrompt);

    try {
        const response = await $.post(API_URL.replace("{0}", extensionSettings.modelUrl),
            JSON.stringify({
                prompt: statPrompt,
                top_k: greedy ? 1 : 3,
                temperature: greedy ? 0 : 1,
                stop_sequence: ['"']
            }));
        return response.results[0].text.split('"')[0];
    } catch (error) {
        console.error(`Error generating ${stat} for ${char}:`, error);
        return "error";
    }
}

function setMessageStats(stats, messageIndex) {
    const message = chat[messageIndex];
    message.stats = stats;
    displayStats(messageIndex, stats);
    saveChatConditional();
}

async function makeStats(specificMessageIndex = null, specificChar = null, specificStat = null, greedy = true) {
    const messages = getRecentMessages(specificMessageIndex);
    if (!messages) return;

    if (messages.newMessage === "") {
        return;
    }

    const chars = specificChar ? [specificChar] : [messages.previousName, messages.newName].sort();
    const resultingStats = { ...messages.newStats } || {};
    chars.forEach(char => {
        if (!resultingStats[char]) {
            resultingStats[char] = {};
            supportedStats.forEach(stat => {
                resultingStats[char][stat] = StatConfig[stat].defaultValue;
            });
        }
    });

    for (const char of chars) {
        const statsToGenerate = specificStat ? [specificStat] : supportedStats;
        for (const stat of statsToGenerate) {
            resultingStats[char][stat] = await generateStat(
                stat,
                char,
                messages,
                resultingStats[char],
                greedy
            );
        }
    }
    setMessageStats(resultingStats, messages.newIndex);
}

async function doStats(times) {
    const statsObject = Object.fromEntries(supportedStats.map(stat => [stat, []]));
    for (let i = 0; i < times; i++) {
        var result = parseStats(await generateQuietPrompt(defaultPrompt, false, true));
        for (const key in result) {
            if (statsObject.hasOwnProperty(key)) {
                statsObject[key].push(result[key]);
            }
        }
    }
    var averagedStats = calcStats(statsObject);
    var statContainer = $("#statBarPopout").find(".stat-container").first();
    var table = statContainer.find("table").first();
    var headerRow = table.find("tr").first();
    if (headerRow.length == 0) {
        headerRow = $("<tr>");
        table.append(headerRow);
    }
    headerRow.empty();
    supportedStats.forEach(stat => {
        const shortName = stat.slice(0, 3);
        headerRow.append($("<th>").text(shortName));
    });
    var row = $("<tr>");
    supportedStats.forEach(stat => {
        row.append(`<td>${averagedStats[stat]}</td>`);
    });
    table.append(row);
}
//#endregion

//#region UI Rendering & Interaction
function displayStats(messageId, stats) {
    const messageDiv = $(`[mesid="${messageId}"]`);
    if (!messageDiv.length) return;
    messageDiv.find('.stats-table-container').remove();

    const characters = Object.keys(stats);
    if (characters.length === 0) return;

    const container = $('<div class="stats-table-container"></div>').css({
        'padding': '5px',
        'font-size': '0.9em'
    });

    const buttonContainer = $('<div class="stats-button-container"></div>').css({
        'float': 'right',
        'display': 'flex',
        'gap': '5px'
    });
    const buttonStyle = {
        'cursor': 'pointer',
        'padding': '1px 3px',
        'opacity': '0.3',
        'transition': 'opacity 0.2s'
    };

    const editButton = $('<div class="stats-edit-button fa-solid fa-pencil"></div>').css(buttonStyle);
    const regenerateButton = $('<div class="stats-regenerate-button fa-solid fa-rotate"></div>').css(buttonStyle);
    const exportButton = $('<div class="stats-export-button fa-solid fa-copy"></div>').css(buttonStyle);

    buttonContainer.append(regenerateButton, editButton, exportButton);
    buttonContainer.on('mouseenter', '.fa-solid', function () {
        $(this).css('opacity', '1');
    }).on('mouseleave', '.fa-solid', function () {
        $(this).css('opacity', '0.3');
    });
    container.append(buttonContainer);

    const table = $('<table></table>').css({
        'width': '100%',
        'border-collapse': 'collapse'
    });
    const headerRow = $('<tr></tr>');
    headerRow.append($('<th></th>').css('padding', '2px 5px'));
    characters.forEach(char => {
        headerRow.append($('<th></th>').text(char).css('padding', '2px 5px'));
    });
    table.append(headerRow);

    supportedStats.forEach(stat => {
        const row = $('<tr></tr>');
        row.append($('<td></td>').text(stat.toLowerCase()).css({
            'padding': '2px 5px',
            'font-weight': 'bold'
        }));
        characters.forEach(char => {
            const cell = $('<td></td>')
                .text(stats[char][stat] || 'unspecified')
                .css('padding', '2px 5px')
                .attr('data-character', char)
                .attr('data-stat', stat);
            row.append(cell);
        });
        table.append(row);
    });

    container.append(table);
    messageDiv.find('.mes_text').after(container);

    exportButton.on('click', function () {
        const messages = getRecentMessages(messageId);
        exportSingleMessage(messages);
    });
    regenerateButton.on('click', async function (e) {
        const currentIndex = messageId;
        
        if (e.shiftKey) {
            // Mega-regeneration: regenerate all stats for all characters in all later messages
            const laterMessages = chat
                .slice(currentIndex)  // Get all messages after current
                .map((msg, idx) => ({ msg, idx: currentIndex + idx }))  // Keep track of original indices
                .filter(({ msg }) => !msg.is_system)
                .slice(0, 50);  // Skip system messages

            console.log(`Mega-regenerating all stats for all characters in ${laterMessages.length} messages`);

            for (const { msg, idx } of laterMessages) {
                await makeStats(idx, null, null, e.altKey == true);
            }

            toastr.success(`Regenerated all stats in ${laterMessages.length} messages`);
        }
        else if (e.ctrlKey) {
            // Limited regeneration: up to 5 later messages
            const laterMessages = chat
                .slice(currentIndex)
                .map((msg, idx) => ({ msg, idx: currentIndex + idx }))
                .filter(({ msg }) => !msg.is_system)
                .slice(0, 5);  // Limit to 5 messages

            console.log(`Regenerating all stats in ${laterMessages.length} messages`);

            for (const { msg, idx } of laterMessages) {
                await makeStats(idx, null, null, e.altKey == true);
            }

            toastr.success(`Regenerated stats in ${laterMessages.length} messages`);
        }
        else {
            // Normal single regeneration
            await makeStats(messageId, null, null, e.altKey == true);
        }
    });

    // Add tooltip to show available options
    regenerateButton.attr('title', 
        'Click: Regenerate all stats\n' +
        'Alt+Click: Regenerate with more randomness\n' +
        'Shift+Click: Regenerate all later messages\n' +
        'Ctrl+Click: Regenerate next 5 messages'
    );

    editButton.on('click', function () {
        const isEditing = container.hasClass('editing');
        if (!isEditing) {
            container.addClass('editing');
            table.find('td[data-character]').each(function () {
                const cell = $(this);
                const value = cell.text();
                const inputContainer = $('<div>').css({
                    'display': 'flex',
                    'gap': '5px',
                    'align-items': 'center'
                });
                const input = $('<input type="text">').val(value).css({
                    'flex': '1',
                    'box-sizing': 'border-box',
                    'padding': '2px',
                    'border': 'inherit',
                    'background-color': 'inherit',
                    'color': 'inherit'
                });
                const statRegenerateButton = $('<div class="fa-solid fa-rotate"></div>').css({
                    ...buttonStyle,
                    'font-size': '0.8em'
                });
                statRegenerateButton.hover(function () {
                    $(this).css('opacity', '0.3');
                });
                // In the displayStats function, where we set up the statRegenerateButton click handler:
                statRegenerateButton.on('click', async function (e) {
                    e.stopPropagation();
                    const char = cell.attr('data-character');
                    const stat = cell.attr('data-stat');

                    if (e.shiftKey) {
                        // Mega-regeneration: regenerate this stat for this character in all later messages
                        const currentIndex = messageId;
                        const laterMessages = chat
                            .slice(currentIndex)  // Get all messages after current
                            .map((msg, idx) => ({ msg, idx: currentIndex + idx }))  // Keep track of original indices
                            .filter(({ msg }) => !msg.is_system/* && msg.stats?.[char]?.[stat]*/);  // Only messages with this stat

                        console.log(`Mega-regenerating ${stat} for ${char} in ${laterMessages.length} messages`);

                        for (const { msg, idx } of laterMessages) {
                            await makeStats(idx, char, stat, e.altKey == true);
                        }

                        toastr.success(`Regenerated ${stat} for ${char} in ${laterMessages.length} messages`);
                    }
                    else if (e.ctrlKey) {
                        // Limited regeneration: up to 10 later messages
                        const currentIndex = messageId;
                        const laterMessages = chat
                            .slice(currentIndex)
                            .map((msg, idx) => ({ msg, idx: currentIndex + idx }))
                            .filter(({ msg }) => !msg.is_system && msg.stats?.[char]?.[stat])
                            .slice(0, 5);  // Limit to 10 messages

                        console.log(`Regenerating ${stat} for ${char} in ${laterMessages.length} messages`);

                        for (const { msg, idx } of laterMessages) {
                            await makeStats(idx, char, stat, e.altKey == true);
                        }

                        toastr.success(`Regenerated ${stat} for ${char} in ${laterMessages.length} messages`);
                    }
                    else {
                        // Normal single regeneration
                        await makeStats(messageId, char, stat, e.altKey == true);
                    }
                });

                // Add tooltip to show available options
                statRegenerateButton
                    .attr('title', 'Click: Regenerate this stat\nShift+Click: Regenerate in all later messages\nCtrl+Click: Regenerate in up to 10 later messages');

                inputContainer.append(statRegenerateButton, input);
                cell.empty().append(inputContainer);
            });
            editButton.removeClass('fa-pencil').addClass('fa-check');
        } else {
            const newStats = { ...stats };
            table.find('td[data-character]').each(function () {
                const cell = $(this);
                const char = cell.attr('data-character');
                const stat = cell.attr('data-stat');
                const value = cell.find('input').val();
                newStats[char][stat] = value;
            });
            chat[messageId].stats = newStats;
            saveChatConditional();
            displayStats(messageId, newStats);
        }
    });
}

function addPasteButton(messageId) {
    const messageDiv = $(`[mesid="${messageId}"]`);
    if (!messageDiv.length) return;
    messageDiv.find('.paste-stats-button').remove();
    const pasteButton = $('<div class="paste-stats-button fa-solid fa-clipboard"></div>').css({
        'cursor': 'pointer',
        'opacity': '0.3',
        'transition': 'opacity 0.2s',
        'padding': '0 5px'
    }).attr('title', 'Paste stats from clipboard');
    pasteButton.hover(
        function () { $(this).css('opacity', '1'); },
        function () { $(this).css('opacity', '0.3'); }
    );
    pasteButton.on('click', function () {
        pasteStats(messageId);
    });
    messageDiv.find('.extraMesButtons').append(pasteButton);

    messageDiv.find('.request-stats-button').remove();
    const requestButton = $('<div class="request-stats-button fa-solid fa-rotate"></div>').css({
        'cursor': 'pointer',
        'opacity': '0.3',
        'transition': 'opacity 0.2s',
        'padding': '0 5px'
    }).attr('title', 'Request stats');

    requestButton.hover(
        function () { $(this).css('opacity', '1'); },
        function () { $(this).css('opacity', '0.3'); }
    );
    requestButton.on('click', function () {
        makeStats(messageId);
    });
    messageDiv.find('.extraMesButtons').append(requestButton);
}

async function pasteStats(messageId) {
    try {
        const modal = $('<div>').css({
            'position': 'fixed',
            'top': '50%',
            'left': '50%',
            'transform': 'translate(-50%, -50%)',
            'background': 'inherit',
            'border': 'inherit',
            'padding': '20px',
            'z-index': '1000',
            'border-radius': '5px',
            'box-shadow': '0 0 10px rgba(0,0,0,0.5)'
        });
        const textarea = $('<textarea>')
            .css({
                'width': '400px',
                'height': '200px',
                'margin': '10px 0',
                'background': 'inherit',
                'color': 'inherit',
                'border': 'inherit',
                'padding': '5px'
            })
            .attr('placeholder', 'Paste stats here...');
        const buttonContainer = $('<div>').css({
            'display': 'flex',
            'gap': '10px',
            'justify-content': 'flex-end'
        });
        const applyButton = $('<button>')
            .text('Apply')
            .css({
                'padding': '5px 15px',
                'border': 'none',
                'border-radius': '3px',
                'cursor': 'pointer'
            });
        const cancelButton = $('<button>')
            .text('Cancel')
            .css({
                'padding': '5px 15px',
                'background': 'inherit',
                'color': 'inherit',
                'border': 'inherit',
                'border-radius': '3px',
                'cursor': 'pointer'
            });
        buttonContainer.append(cancelButton, applyButton);
        modal.append(textarea, buttonContainer);
        $('body').append(modal);

        cancelButton.on('click', () => {
            modal.remove();
        });

        applyButton.on('click', () => {
            const clipText = textarea.val();
            if (!clipText) {
                toastr.error('No text provided');
                return;
            }
            const statMatch = clipText.match(/<\/message>\n([\s\S]*?)(?:\n\n|$)/);
            if (!statMatch) {
                toastr.error('No stats found in pasted text');
                return;
            }
            const statsText = statMatch[1];
            const stats = {};
            const statLines = statsText.split('\n');
            statLines.forEach(line => {
                const parsed = parseStatsString(line);
                if (parsed) {
                    Object.entries(parsed).forEach(([char, charStats]) => {
                        if (!stats[char]) stats[char] = {};
                        Object.assign(stats[char], charStats);
                    });
                }
            });
            if (Object.keys(stats).length === 0) {
                toastr.error('Failed to parse stats from text');
                return;
            }
            setMessageStats(stats, messageId);
            toastr.success('Stats applied successfully');
            modal.remove();
        });
    } catch (err) {
        console.error('Failed to paste stats:', err);
        toastr.error('Failed to apply stats');
    }
}
//#endregion

//#region Event Handlers & Popout UI
function onRequestStatsClick() {
    const firstMessageWithoutStats = chat.findIndex(message =>
        !message.is_system && !message.stats
    );
    if (firstMessageWithoutStats >= 0) {
        makeStats(firstMessageWithoutStats);
    } else {
        console.log("No messages without stats found");
    }
}

function doPopout(e) {
    const target = e.target;
    const statBarPopoutId = "statBarPopout";
    const statBarPopoutIdJ = "#" + statBarPopoutId;
    if ($(statBarPopoutIdJ).length === 0) {
        console.debug('did not see popout yet, creating');
        const originalElement = $(target).parent().parent().parent().find('.inline-drawer-content');
        const originalHTMLClone = originalElement.html();
        const template = $('#zoomed_avatar_template').html();
        const controlBarHtml = `<div class="panelControlBar flex-container">
		  <div id="statBarPopoutheader" class="fa-solid fa-grip drag-grabber hoverglow"></div>
		  <div id="statBarPopoutClose" class="fa-solid fa-circle-xmark hoverglow dragClose"></div>
	  </div>`;
        const newElement = $(template);
        newElement.attr('id', statBarPopoutId)
            .removeClass('zoomed_avatar')
            .addClass('draggable')
            .css("right", "0")
            .empty();
        originalElement.html('<div class="flex-container alignitemscenter justifyCenter wide100p"><small>Currently popped out</small></div>');
        newElement.append(controlBarHtml).append(originalHTMLClone);
        $('#movingDivs').append(newElement);
        $('#statsDrawerContent').addClass('scrollY');
        loadSettings();
        loadMovingUIState();
        $(statBarPopoutIdJ).css('display', 'flex').fadeIn(animation_duration);
        dragElement(newElement);
        $('#statBarPopoutClose').off('click').on('click', function () {
            $('#statsDrawerContent').removeClass('scrollY');
            const objectivePopoutHTML = $('#statsDrawerContent');
            $(statBarPopoutIdJ).fadeOut(animation_duration, () => {
                originalElement.empty();
                originalElement.html(objectivePopoutHTML);
                $(statBarPopoutIdJ).remove();
            });
            loadSettings();
        });
    } else {
        console.debug('saw existing popout, removing');
        $(statBarPopoutIdJ).fadeOut(animation_duration, () => { $('#statBarPopoutClose').trigger('click'); });
    }
}

function onChatChanged() {
    chat.forEach((message, index) => {
        if (!message.is_system) {
            if (message.stats) displayStats(index, message.stats);
            addPasteButton(index);
        }
    });
}

function onMessageRendered() {
    makeStats();
}
//#endregion

//#region Initialization
jQuery(async () => {
    const settingsHtml = await $.get(`${extensionFolderPath}/settings.html`);
    $("#extensions_settings").append(settingsHtml);
    $(document).on('click', '#requestStats', onRequestStatsClick);
    $(document).on('click', '#exportStats', exportChat);
    $(document).on('click', '#reload', onChatChanged);
    $(document).on('click', '#statBarPopoutButton', function (e) {
        doPopout(e);
        e.stopPropagation();
    });
    loadSettings();
    eventSource.on(event_types.CHAT_CHANGED, onChatChanged);
    eventSource.on(event_types.CHARACTER_MESSAGE_RENDERED, onMessageRendered);
    eventSource.on(event_types.USER_MESSAGE_RENDERED, onMessageRendered);
});
//#endregion
