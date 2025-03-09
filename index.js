// The main script for the extension
// The following are examples of some basic extension functionality

//You'll likely need to import extension_settings, getContext, and loadExtensionSettings from extensions.js
import { extension_settings, getContext, loadExtensionSettings } from "../../../extensions.js";

import {
	substituteParams,
	eventSource,
	event_types,
	generateQuietPrompt,
	generateRaw,
	animation_duration
} from '../../../../script.js';

import { dragElement } from '../../../../scripts/RossAscends-mods.js';
import { loadMovingUIState } from '../../../../scripts/power-user.js';

// Keep track of where your extension is located, name should match repo name
const extensionName = "engram";
const extensionFolderPath = `scripts/extensions/third-party/${extensionName}`;
const extensionSettings = extension_settings[extensionName];
const defaultSettings = {};



// Loads the extension settings if they exist, otherwise initializes them to the defaults.
async function loadSettings() {
	//Create the settings if they don't exist
	extension_settings[extensionName] = extension_settings[extensionName] || {};
	if (Object.keys(extension_settings[extensionName]).length === 0) {
		Object.assign(extension_settings[extensionName], defaultSettings);
	}

	// // Updating settings in the UI
	// $("#example_setting").prop("checked", extension_settings[extensionName].example_setting).trigger("input");
}

const defaultPrompt = `Pause the roleplay. You are now a statistician tasked with providing consistent emotional assessments. Assign scores based on a standardized, repeatable method, ensuring minimal variation between evaluations of similar dialogues. Focus on maintaining statistical consistency.

Provide a numerical assessment of Mika's emotions regarding recent events on an exponential scale from negative 10 to positive 10. Consider the definitions and reference values for guidance, but do not limit yourself to specific examples. Assign scores that best fit the situation, using a wide range to reflect different levels of intensity. Avoid clustering around certain typical values unless clearly justified by the situation.

Happiness: Misery (-10) / Joy (+10)
Extreme misery: Overwhelming sadness and despair.
Significant sadness: A deep, noticeable sadness that affects behavior.
Neutral: No significant feeling of happiness or sadness.
Moderate joy: A feeling of contentment and happiness, but not overwhelming.
Extreme joy: Uncontainable happiness and bliss.
(Evaluate: Is the character showing contentment or distress? Does the dialogue suggest profound joy or sadness?)

Security: Fear (-10) / Trust (+10)
Extreme fear: Paralyzing, overwhelming fear of harm or danger.
Anxiety: Unease or apprehension, a sense of looming threat.
Neutral: No significant fear or trust in the situation.
Moderate trust: Comfortable reliance or faith in the situation or others.
Complete trust: Absolute confidence and sense of safety or security.
(Evaluate: Does the character feel safe and secure, or are they anxious and threatened?)

Anger: Frustration (-10) / Resolve (+10)
Extreme frustration: Intense feelings of helplessness or rage due to obstacles, leading to potential outbursts or withdrawal.
Significant irritation: Noticeable annoyance or impatience with a situation, but not overwhelming.
Neutral: No strong feelings of frustration or determination; the character is indifferent.
Rage: An intense emotional response to perceived injustices or provocations, often resulting in aggressive behavior and a desire for retaliation.
Moderate resolve: A clear sense of determination to act or a playful competitiveness.
Strong resolve: Unshakeable determination to achieve a goal or overcome challenges, reflecting a proactive approach.
Cue: Frustration arises when the character feels blocked or unable to influence a situation, leading to negative emotional responses. Rage can stem from feelings of injustice or strong provocation. Resolve signifies determination and proactive efforts to overcome challenges. Assess whether the character feels hindered and powerless, is experiencing intense anger, or is actively striving to achieve a goal when assigning scores.

Desire: Disgust (-10) / Desire (+10)
Extreme disgust: Revulsion or complete rejection of something.
Significant aversion: Strong dislike or unwillingness to engage.
Neutral: No strong feeling of attraction or disgust.
Attraction: A moderate interest or liking.
Strong desire: A powerful urge or longing for something.
(Evaluate: Does the character feel drawn to or repelled by something? How intense is this attraction or disgust?)
Cue: Desire refers to any form of interest, longing, or attraction, and is not limited to sexual or romantic desire. It can apply to ideas, actions, objects, or goals.

Surprise: Shock (-10) / Glee (+10)
Extreme shock – An overwhelming, distressing event that causes fear or strong discomfort.
Negative surprise – An unexpected event that causes unease or mild discomfort. Even if the event is not shocking, discomfort, unease, or uncertainty should result in a negative score.
Neutral – An event was expected
Positive surprise – A surprising event that brings clear joy or satisfaction.
Extreme glee – An unexpectedly delightful event causing intense joy.

Cue: Mild discomfort or unease, even in non-distressing situations, should result in neutral or negative scores. Curiosity or challenges that cause unease should not lead to positive scores unless there's clear happiness or satisfaction.
Cue: While surprise can indicate novelty, it is essential to evaluate the emotional impact of the event. Positive surprise may elicit joy or excitement, while negative surprise should reflect feelings of unease, discomfort, or anxiety. In cases where the character is taken aback but experiences discomfort or concern, the score should reflect a negative valuation.

Conscience: Self-condemnation (-10) / Integrity (+10)
Extreme self-condemnation: Crushing guilt or self-blame.
Significant guilt: Deep remorse or regret for actions taken.
Neutral: No strong feeling of guilt or moral self-assurance.
Moderate integrity: A sense of doing the right thing, feeling morally good.
Strong integrity: Absolute certainty of moral righteousness and correctness.
(Evaluate: Does the character feel morally right or guilty? How strongly do they feel about their actions or choices?)

Esteem: Self-loathing (-10) / Pride (+10)
Extreme self-loathing: Intense hatred or rejection of oneself.
Significant shame: Strong feelings of embarrassment or failure.
Neutral: No significant feelings of pride or shame.
Moderate pride: A healthy recognition of one’s accomplishments or worth.
Strong pride: An overwhelming sense of personal achievement, exceptional self-worth, and confidence.
(Evaluate: How does the character feel about themselves in this moment? Does the situation elevate or diminish their self-worth?)

Belonging: Isolation (-10) / Connection (+10)
Extreme isolation: Profound loneliness and disconnection from others.
Significant loneliness: Noticeable feelings of being alone, with a lack of meaningful connections.
Neutral: No strong feelings of connection or isolation.
Moderate connection: Feeling included and accepted within a group, with some emotional ties to others.
Strong connection: A deep, unwavering sense of belonging and emotional connection with a community or group.
(Evaluate: Does the character feel connected to others or isolated? How strongly do they feel a part of a group or disconnected?)

Avoid any information except the scales, and do not provide detailed analysis or any kind of comment. Preserve the scale names at all cost. Strictly keep to the example format:

[[Happiness: x]] [[Security: x]] [[Anger: x]] [[Desire: x]] [[Surprise: x]] [[Conscience: x]] [[Esteem: x]] [[Belonging: x]]
`;

const stats = ['Happiness', 'Security', 'Anger', 'Desire', 'Surprise', 'Conscience', 'Esteem', 'Belonging'];

function parseStats(str) {
	const parsed = {};
	const matches = str.match(/\[\[([^\:]+):\s*(-?\d+)\]\]/g);

	if (matches) {
		matches.forEach(item => {
			const [name, value] = item.match(/^\[\[([^\:]+):\s*(-?\d+)\]\]$/).slice(1);
			parsed[name.trim()] = parseInt(value);
		});
	}

	return parsed;
}

function calculateIQR(values) {
    const sortedValues = [...values].sort((a, b) => a - b);
    const q1 = sortedValues[Math.floor((sortedValues.length / 4))];
    const q3 = sortedValues[Math.floor((sortedValues.length * 3) / 4)];
    return { q1, q3, iqr: q3 - q1 };
}

function removeOutliersIQR(values) {
	const threshold = 1.5;

    const { q1, q3, iqr } = calculateIQR(values);
    const lowerBound = q1 - threshold * iqr;
    const upperBound = q3 + threshold * iqr;

    // Filter out outliers
    return values.filter(value => value >= lowerBound && value <= upperBound);
}

function calculateMedian(values) {
    if (values.length === 0) return 0; // Handle empty array

    // Sort the array
    values.sort((a, b) => a - b);
    
    const mid = Math.floor(values.length / 2); // Get the middle index

    // If the length is odd, return the middle element
    if (values.length % 2 !== 0) {
        return values[mid];
    } else {
        // If even, return the average of the two middle elements
        return (values[mid - 1] + values[mid]) / 2;
    }
}

function calcStats(statsValues)
{
	const result = {};

    for (const key in statsValues) {
        const values = statsValues[key];
        
        const filteredValues = removeOutliersIQR(values);

		if (filteredValues.length != values.length)
		{
			console.log(key);
			console.log(values);
			console.log(filteredValues);
		}
        const average = filteredValues.length > 0 ? (filteredValues.reduce((a, b) => a + b, 0) / filteredValues.length) : 0;

		//const average = calculateMedian(filteredValues);

        result[key] = average.toFixed(1);
    }

    return result;
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

// This function is called when the button is clicked
async function onButtonClick() {
	const times = 1;
	const repeats = 1;
	
	for (var i = 0; i < repeats; i++)
	{
		await doStats(times);
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

// This function is called when the extension is loaded
jQuery(async () => {
	// This is an example of loading HTML from a file
	const settingsHtml = await $.get(`${extensionFolderPath}/settings.html`);
	//const displayHtml = await $.get(`${extensionFolderPath}/display.html`);

	// Append settingsHtml to extensions_settings
	// extension_settings and extensions_settings2 are the left and right columns of the settings menu
	// Left should be extensions that deal with system functions and right should be visual/UI related 
	$("#extensions_settings").append(settingsHtml);

	$(document).on('click', '#requestStats', onButtonClick);
	$(document).on('click', '#statBarPopoutButton', function (e) {
		doPopout(e);
		e.stopPropagation();
	});

	// Load settings when starting things up (if you have any)
	loadSettings();
});
