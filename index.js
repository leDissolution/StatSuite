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

function getRecentMessages() {
    const messages = chat.filter(c => !c.is_system).slice(-2);

    if (messages.length !== 2) return null;

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
            /*'margin-top': '10px',*/
            'padding': '5px',
            'font-size': '0.9em'
        });

    // Add edit button
    const editButton = $('<div class="stats-edit-button fa-solid fa-pencil"></div>')
        .css({
            'cursor': 'pointer',
            'float': 'right',
            'padding': '2px 5px',
            'opacity': '0.7'
        })
        .hover(
            function () { $(this).css('opacity', '1'); },
            function () { $(this).css('opacity', '0.7'); }
        );

    container.append(editButton);

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

    // Add click handler for edit button
    editButton.on('click', function () {
        const isEditing = container.hasClass('editing');

        if (!isEditing) {
            // Switch to edit mode
            container.addClass('editing');
            table.find('td[data-character]').each(function () {
                const cell = $(this);
                const value = cell.text();
                const input = $('<input type="text">')
                    .val(value)
                    .css({
                        'width': '100%',
                        'box-sizing': 'border-box',
                        'padding': '2px',
                        'border': '1px solid var(--accent-color)',
                        'background-color': 'var(--background-color)',
                        'color': 'var(--text-color)'
                    });
                cell.empty().append(input);
            });
            editButton.removeClass('fa-pen').addClass('fa-check');
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
            result[charName][key.toUpperCase()] = value;
        }
    }

    return result;
}

async function makeStats() {
    const messages = getRecentMessages();
    const chars = [messages.previousName, messages.newName];
    chars.sort();

    const resultingStats = {};
    chars.forEach(char => resultingStats[char] = {});

    const previousStatsString = statsToStringFull(messages.previousStats);

    var top_k = 1;
    var temperature = 0.5;

    if (messages.newStats) {
        top_k = 3;
        temperature = 1;
    }

    for (const char of chars) {
        for (const stat of supportedStats) {
            const statPrompt = generateStatPrompt(stat, char, messages.previousName, messages.previousMessage, messages.newName, messages.newMessage, previousStatsString, resultingStats[char]);
            console.log(statPrompt);

            try {
                const response = await $.post(API_URL.replace("{0}", extensionSettings.modelUrl),
                    JSON.stringify({
                        prompt: statPrompt,
                        top_k: top_k,
                        temperature: temperature,
                        stop_sequence: ['"']
                    }));
                resultingStats[char][stat] = response.results[0].text.split('"')[0];
            } catch (error) {
                console.error(`Error fetching stat ${stat} for ${char}:`, error);
            }
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


async function onButtonClick() {
    makeStats();
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
        if (message.stats && !message.is_system) {
            displayStats(index, message.stats);
        }
    });
}

function onMessageRendered() {
    makeStats();
}

jQuery(async () => {
	const settingsHtml = await $.get(`${extensionFolderPath}/settings.html`);

	$("#extensions_settings").append(settingsHtml);

    $(document).on('click', '#requestStats', onButtonClick);
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
