// The main script for the extension
// The following are examples of some basic extension functionality

//You'll likely need to import extension_settings, getContext, and loadExtensionSettings from extensions.js
import { extension_settings, getContext, loadExtensionSettings } from "../../../extensions.js";
import { saveSettingsDebounced, saveChatConditional } from "../../../../../../script.js";

import { Stats, generateStatPrompt, generateExportPrompt } from './prompts.js';

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

// Keep track of where your extension is located, name should match repo name
const extensionName = "StatSuite";
const extensionFolderPath = `scripts/extensions/third-party/${extensionName}`;
const extensionSettings = extension_settings[extensionName] || {};
const defaultSettings = {};


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

async function doStats(times)
{
	const statsObject = Object.fromEntries(stats.map(stat => [stat, []]));

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

	stats.forEach(stat => {
        const shortName = stat.slice(0, 3);
        var headerCell = $("<th>").text(shortName);
        headerRow.append(headerCell);
    });

	var row = $("<tr>");

	stats.forEach(stat => {
		row.append(`<td>${averagedStats[stat]}</td>`);
	});

	table.append(row);
}

const API_URL = "{0}/api/v1/generate"
const supportedStats = [Stats.POSE, Stats.LOCATION];

function getRecentMessages(specificMessageIndex = null) {
    let messages = [];

    if (specificMessageIndex !== null) {
        if (specificMessageIndex < 0 || specificMessageIndex >= chat.length) return null;

        // Special case for first message
        if (specificMessageIndex === 0) {
            const firstMessage = chat[0];
            if (firstMessage.is_system) return null;

            // Create empty previous stats
            const emptyStats = {};
            emptyStats[firstMessage.name] = {};
            for (const stat of supportedStats) {
                emptyStats[firstMessage.name][stat] = "unspecified";
            }

            return {
                previousName: firstMessage.name,
                previousMessage: "",  // Empty previous message
                previousStats: emptyStats,
                previousIndex: -1,    // Invalid index to indicate first message

                newName: firstMessage.name,
                newMessage: firstMessage.mes,
                newStats: firstMessage.stats,
                newIndex: 0
            }
        }

        messages = [
            chat[specificMessageIndex - 1],
            chat[specificMessageIndex]
        ];

        if (messages.some(m => m.is_system)) return null;
    } else { // last two messages
        messages = chat.filter(c => !c.is_system).slice(-2);
        if (messages.length !== 2) return null;
    }

    var previousStats = messages[0].stats;

    if (!previousStats) {
        previousStats = {};
    }

    for (const char of [messages[0].name, messages[1].name]) {
        if (!previousStats[char]) {
            previousStats[char] = {};
        }

        for (const stat of supportedStats) {
            if (!previousStats[char][stat]) {
                previousStats[char][stat] = "unspecified";
            }
        }
    }

    // Find message indices in the original chat array
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

function displayStats(messageId, stats) {
    const messageDiv = $(`[mesid="${messageId}"]`);
    if (!messageDiv.length) return;

    // Remove existing stats table if any
    messageDiv.find('.stats-table-container').remove();

    // Get all unique characters
    const characters = Object.keys(stats);
    if (characters.length === 0) return;

    // Create table container
    const container = $('<div class="stats-table-container"></div>')
        .css({
            'padding': '5px',
            'font-size': '0.9em'
        });

    // Create button container for edit and regenerate
    const buttonContainer = $('<div class="stats-button-container"></div>')
        .css({
            'float': 'right',
            'display': 'flex',
            'gap': '5px'
        });

    // Add CSS class for hover behavior
    const buttonStyle = {
        'cursor': 'pointer',
        'padding': '1px 3px',
        'opacity': '0.3',
        'transition': 'opacity 0.2s' // Optional: makes opacity change smooth
    };

    // Add edit button
    const editButton = $('<div class="stats-edit-button fa-solid fa-pencil"></div>')
        .css(buttonStyle);
    const regenerateButton = $('<div class="stats-regenerate-button fa-solid fa-rotate"></div>')
        .css(buttonStyle);
    const exportButton = $('<div class="stats-export-button fa-solid fa-copy"></div>')
        .css(buttonStyle);

    buttonContainer.append(regenerateButton, editButton, exportButton);

    // Apply hover behavior once to container
    buttonContainer.on('mouseenter', '.fa-solid', function () {
        $(this).css('opacity', '1');
    }).on('mouseleave', '.fa-solid', function () {
        $(this).css('opacity', '0.3');
    });

    buttonContainer.append(regenerateButton, editButton);
    container.append(buttonContainer);

    // Create table
    const table = $('<table></table>')
        .css({
            'width': '100%',
            'border-collapse': 'collapse'
        });

    // Create header row with character names
    const headerRow = $('<tr></tr>');
    headerRow.append($('<th></th>').css('padding', '2px 5px')); // Empty corner cell
    characters.forEach(char => {
        headerRow.append(
            $('<th></th>')
                .text(char)
                .css('padding', '2px 5px')
        );
    });
    table.append(headerRow);

    // Create rows for each stat type
    supportedStats.forEach(stat => {
        const row = $('<tr></tr>');

        // Stat name cell
        row.append(
            $('<td></td>')
                .text(stat.toLowerCase())
                .css({
                    'padding': '2px 5px',
                    'font-weight': 'bold'
                })
        );

        // Stat values for each character
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
        exportSingleMessage(messageId);
    });

    regenerateButton.on('click', function () {
        makeStats(messageId);
    });

    editButton.on('click', function () {
        const isEditing = container.hasClass('editing');

        if (!isEditing) {
            // Switch to edit mode
            container.addClass('editing');
            table.find('td[data-character]').each(function () {
                const cell = $(this);
                const value = cell.text();

                // Create input container div
                const inputContainer = $('<div>')
                    .css({
                        'display': 'flex',
                        'gap': '5px',
                        'align-items': 'center'
                    });

                // Create input
                const input = $('<input type="text">')
                    .val(value)
                    .css({
                        'flex': '1',
                        'box-sizing': 'border-box',
                        'padding': '2px',
                        'border': 'inherit',
                        'background-color': 'inherit',
                        'color': 'inherit'
                    });

                const statRegenerateButton = $('<div class="fa-solid fa-rotate"></div>')
                    .css({
                        ...buttonStyle,
                        'font-size': '0.8em'
                    });

                statRegenerateButton.hover(
                    function () { $(this).css('opacity', '0.3'); }
                );

                statRegenerateButton.on('click', async function (e) {
                    e.stopPropagation();
                    const char = cell.attr('data-character');
                    const stat = cell.attr('data-stat');
                    await makeStats(messageId, char, stat);
                });

                inputContainer.append(statRegenerateButton, input);
                cell.empty().append(inputContainer);
            });
            editButton.removeClass('fa-pencil').addClass('fa-check');
        } else {
            // Save changes
            const newStats = { ...stats };
            table.find('td[data-character]').each(function () {
                const cell = $(this);
                const char = cell.attr('data-character');
                const stat = cell.attr('data-stat');
                const value = cell.find('input').val();
                newStats[char][stat] = value;
            });

            // Update message stats
            chat[messageId].stats = newStats;
            saveChatConditional();

            // Redisplay stats
            displayStats(messageId, newStats);
        }
    });
}

function setMessageStats(stats, messageIndex) {
    const message = chat[messageIndex];
    message.stats = stats;
    displayStats(messageIndex, stats);
    saveChatConditional();
}

function statsToString(charName, stats) {
    const attributes = Object.entries(stats)
        .map(([key, value]) => `${key.toLowerCase()}="${value}"`)
        .join(' ');
    return `<stats character="${charName}" ${attributes} />`;
}

function statsToStringForStat(stats, statType) {
    return Object.entries(stats)
        .map(([charName, charStats]) => {
            const statValue = charStats[statType];
            return `<stats character="${charName}" ${statType.toLowerCase()}="${statValue}" />`;
        })
        .join('\n');
}

function statsToStringFull(stats) {
    return Object.entries(stats)
        .map(([charName, charStats]) => {
            const attributes = Object.entries(charStats)
                .map(([key, value]) => `${key.toLowerCase()}="${value}"`)
                .join(' ');
            return `<stats character="${charName}" ${attributes} />`;
        })
        .join('\n');
}

function parseStatsString(statsString) {
    const result = {};

    // Extract character name
    const charMatch = statsString.match(/character="([^"]+)"/);
    if (!charMatch) return null;

    const charName = charMatch[1];
    result[charName] = {};

    // Extract other attributes
    const matches = statsString.matchAll(/(\w+)="([^"]+)"/g);
    for (const match of matches) {
        const [_, key, value] = match;
        if (key !== 'character') {
            result[charName][key.toLowerCase()] = value;
        }
    }

    return result;
}

const StatConfig = {
    [Stats.POSE]: {
        dependencies: [],  // Base stat, no dependencies
        order: 0,         // Executed first
    },
    [Stats.LOCATION]: {
        dependencies: [Stats.POSE],  // Depends on pose being set
        order: 1,                    // Executed after pose
    }
};

// Helper to get all required stats in correct order
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

async function generateStat(stat, char, messages, existingStats = {}) {
    // Get only the dependencies we need for this stat
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
        dependencies  // Pass only the required dependencies
    );

    console.log(`Generating ${stat} for ${char}:`, statPrompt);

    try {
        const response = await $.post(API_URL.replace("{0}", extensionSettings.modelUrl),
            JSON.stringify({
                prompt: statPrompt,
                top_k: messages.newStats ? 3 : 1,
                temperature: messages.newStats ? 1 : 0.5,
                stop_sequence: ['"']
            }));
        return response.results[0].text.split('"')[0];
    } catch (error) {
        console.error(`Error generating ${stat} for ${char}:`, error);
        return "error";
    }
}

async function pasteStats(messageId) {
    try {
        // Create modal
        const modal = $('<div>')
            .css({
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

        // Create textarea
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

        // Create buttons
        const buttonContainer = $('<div>')
            .css({
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

        // Handle buttons
        cancelButton.on('click', () => {
            modal.remove();
        });

        applyButton.on('click', () => {
            const clipText = textarea.val();
            if (!clipText) {
                toastr.error('No text provided');
                return;
            }

            // Find the stats section after </message> tag
            const statMatch = clipText.match(/<\/message>\n([\s\S]*?)(?:\n\n|$)/);
            if (!statMatch) {
                toastr.error('No stats found in pasted text');
                return;
            }

            const statsText = statMatch[1];
            const stats = {};

            // Parse each stats line
            const statLines = statsText.split('\n');
            statLines.forEach(line => {
                const parsed = parseStatsString(line);
                if (parsed) {
                    Object.entries(parsed).forEach(([char, charStats]) => {
                        if (!stats[char]) {
                            stats[char] = {};
                        }
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

function addPasteButton(messageId) {
    const messageDiv = $(`[mesid="${messageId}"]`);
    if (!messageDiv.length) return;

    // Remove existing paste button if any
    messageDiv.find('.paste-stats-button').remove();

    // Create paste button
    const pasteButton = $('<div class="paste-stats-button fa-solid fa-clipboard"></div>')
        .css({
            'cursor': 'pointer',
            'opacity': '0.3',
            'transition': 'opacity 0.2s',
            'padding': '0 5px'
        })
        .attr('title', 'Paste stats from clipboard');

    // Add hover effect
    pasteButton.hover(
        function () { $(this).css('opacity', '1'); },
        function () { $(this).css('opacity', '0.3'); }
    );

    // Add click handler
    pasteButton.on('click', function () {
        pasteStats(messageId);
    });

    // Add to extraMesButtons
    messageDiv.find('.extraMesButtons').append(pasteButton);
}

// Modify makeStats to handle cases where no stats exist
async function makeStats(specificMessageIndex = null, specificChar = null, specificStat = null) {
    const messages = getRecentMessages(specificMessageIndex);
    if (!messages) return;

    const chars = specificChar ? [specificChar] : [messages.previousName, messages.newName].sort();
    const resultingStats = { ...messages.newStats } || {};
    chars.forEach(char => {
        if (!resultingStats[char]) resultingStats[char] = {};
    });

    for (const char of chars) {
        const statsToGenerate = specificStat ?
            [specificStat] :
            supportedStats;

        for (const stat of statsToGenerate) {
            resultingStats[char][stat] = await generateStat(
                stat,
                char,
                messages,
                resultingStats[char]
            );
        }
    }

    setMessageStats(resultingStats, messages.newIndex);
}


async function exportChat() {
    const messages = chat.filter(c => !c.is_system);
    const exports = [];

    for (let i = 1; i < messages.length; i++) {
        const previousMessage = messages[i - 1];
        const currentMessage = messages[i];

        if (!previousMessage.stats && !currentMessage.stats) {
            continue;
        }

        const exportPrompt = generateExportPrompt(
            previousMessage.name,
            previousMessage.mes,
            currentMessage.name,
            currentMessage.mes,
            previousMessage.stats ? statsToStringFull(previousMessage.stats) : '',
            currentMessage.stats ? statsToStringFull(currentMessage.stats) : ''
        );

        exports.push(exportPrompt);
    }

    const exportString = exports.join('\n\n');

    // Create a Blob containing the export text
    const blob = new Blob([exportString], { type: 'text/plain' });

    // Create a temporary link element
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'chat_export.txt';

    // Append link to document, click it, and remove it
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    // Clean up the URL object
    URL.revokeObjectURL(link.href);
}

async function exportSingleMessage(messageId) {
    const messages = getRecentMessages(messageId);
    if (!messages) return;

    const exportPrompt = generateExportPrompt(
        messages.previousName,
        messages.previousMessage,
        messages.newName,
        messages.newMessage,
        messages.previousStats ? statsToStringFull(messages.previousStats) : '',
        messages.newStats ? statsToStringFull(messages.newStats) : ''
    );

    try {
        await navigator.clipboard.writeText(exportPrompt);
        toastr.success('Message export copied to clipboard');
    } catch (err) {
        console.error('Failed to copy to clipboard:', err);
        toastr.error('Failed to copy to clipboard');
    }
}


async function onRequestStatsClick() {
    // Find the earliest message without stats that isn't a system message
    const firstMessageWithoutStats = chat.findIndex(message =>
        !message.is_system && !message.stats
    );

    if (firstMessageWithoutStats >= 0) { // Changed from > 0 to >= 0 to include first message
        makeStats(firstMessageWithoutStats);
    } else {
        console.log("No messages without stats found");
    }
}

const statBarPopoutId = "statBarPopout";
const statBarPopoutIdJ = "#" + statBarPopoutId;

function doPopout(e) {
	const target = e.target;

	if ($(statBarPopoutIdJ).length === 0) {
		console.debug('did not see popout yet, creating');
		const originalHTMLClone = $(target).parent().parent().parent().find('.inline-drawer-content').html();
		const originalElement = $(target).parent().parent().parent().find('.inline-drawer-content');
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

		//setup listener for close button to restore extensions menu
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
            if (message.stats) {
                displayStats(index, message.stats);
            }

            addPasteButton(index);
        }
    });
}

function onMessageRendered() {
    makeStats();
}

jQuery(async () => {
	const settingsHtml = await $.get(`${extensionFolderPath}/settings.html`);

	$("#extensions_settings").append(settingsHtml);

    $(document).on('click', '#requestStats', onRequestStatsClick);
    $(document).on('click', '#exportStats', exportChat);
	$(document).on('click', '#statBarPopoutButton', function (e) {
		doPopout(e);
		e.stopPropagation();
	});

    loadSettings();

    eventSource.on(event_types.CHAT_CHANGED, onChatChanged);
    eventSource.on(event_types.CHARACTER_MESSAGE_RENDERED, onMessageRendered);
    eventSource.on(event_types.USER_MESSAGE_RENDERED, onMessageRendered);
});
