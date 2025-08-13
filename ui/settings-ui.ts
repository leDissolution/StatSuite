import { ExtensionSettings, tryGetModels } from '../settings.js';
import { EVENT_CHARACTER_ADDED, EVENT_CHARACTER_REMOVED, EVENT_STAT_ADDED, EVENT_STAT_REMOVED, EVENT_STATS_BATCH_LOADED } from '../events.js';
import { renderCharactersList } from './characters-list.js';
import { renderStatsList } from './stats-list.js';
import { renderTemplateSettings } from './template-settings.js';
import { Templates } from '../templates/templates-registry.js';
import { loadMovingUIState } from '../../../../../../scripts/power-user.js';
import { dragElement } from '../../../../../../scripts/RossAscends-mods.js';
import { chat_metadata } from '../../../../../../script.js';
import { saveMetadataDebounced } from '../../../../../extensions.js';
import { Characters } from '../characters/characters-registry.js';
import { Stats } from '../stats/stats-registry.js';
import { Chat } from '../chat/chat-manager.js';

export function bindSettingsUI() {
    // Bind Model URL input
    $("#modelUrl").prop("value", ExtensionSettings.modelUrl || '');
    $("#modelUrl").off("input.statSuite").on("input.statSuite", function () {
        ExtensionSettings.modelUrl = $(this).prop("value");
    });
    // Bind Auto Track Authors checkbox
    $("#autoTrackAuthors").prop("checked", ExtensionSettings.autoTrackMessageAuthors);
    $("#autoTrackAuthors").off("input.statSuite").on("input.statSuite", function () {
        ExtensionSettings.autoTrackMessageAuthors = $(this).prop("checked");
    });
    // Bind Disable Auto Request Stats checkbox
    $("#enableAutoRequestStats").prop("checked", ExtensionSettings.enableAutoRequestStats);
    $("#enableAutoRequestStats").off("input.statSuite").on("input.statSuite", function () {
        ExtensionSettings.enableAutoRequestStats = $(this).prop("checked");
    });
    $("#alwaysDisableForChar").prop("checked", ExtensionSettings.alwaysDisabledCharacters.includes(Chat.currentCharacter || ''));
    $("#alwaysDisableForChar").off("input.statSuite").on("input.statSuite", function () {
        if ($(this).prop("checked")) {
            ExtensionSettings.alwaysDisabledCharacters.push(Chat.currentCharacter || '');
        } else {
            ExtensionSettings.alwaysDisabledCharacters = ExtensionSettings.alwaysDisabledCharacters.filter(char => char !== (Chat.currentCharacter || ''));
        }
    });
    $("#alwaysDisableForCharTooltip").prop("title", "Following characters will not automatically request stats, regardless the main toggle: " + ExtensionSettings.alwaysDisabledCharacters.join(', '));
    // Bind Show Stats checkbox
    $("#showStats").prop("checked", ExtensionSettings.showStats);
    $("#showStats").off("input.statSuite").on("input.statSuite", function () {
        ExtensionSettings.showStats = $(this).prop("checked");
    });
    // Bind Collapse Old Stats checkbox
    $("#collapseOldStats").prop("checked", ExtensionSettings.collapseOldStats);
    $("#collapseOldStats").off("input.statSuite").on("input.statSuite", function () {
        ExtensionSettings.collapseOldStats = $(this).prop("checked");
    });
    // Bind retry connection button
    $("#retryConnection").off("click.statSuite").on("click.statSuite", async function () {
        const modelStatusDiv = $("#modelStatus");
        $(".online_status_indicator_stat_suite").removeClass("online");
        $(".online_status_text_stat_suite").text("Checking connection...");
        try {
            const models = await tryGetModels();
            if (models.length > 0) {
                if (models.length == 1) {
                    $(".online_status_text_stat_suite").text(`${ExtensionSettings.modelName}`);
                }
                if (models.length > 1) {
                    const modelSelect = $('<select id="modelSelect"></select>');
                    models.forEach(model => {
                        const option = $(`<option value="${model.id}">${model.id}</option>`);
                        if (model.id === ExtensionSettings.modelName) {
                            option.prop('selected', true);
                        }
                        modelSelect.append(option);
                    });
                    $(".online_status_text_stat_suite").text(`${ExtensionSettings.modelName}`);
                    modelStatusDiv.empty().append(modelSelect);
                    modelSelect.off("change.statSuite").on("change.statSuite", function () {
                        const selectedModel = String($(this).val());
                        ExtensionSettings.modelName = selectedModel;
                        $(".online_status_text_stat_suite").text(`${selectedModel}`);
                    });
                }
                $(".online_status_indicator_stat_suite").addClass("online");
            }
        } catch (error) {
            console.error("StatSuite UI Error: Failed to fetch models.", error);
        }
    }).trigger("click.statSuite");

    // Bind Offline Mode checkbox
    $("#offlineMode").prop("checked", ExtensionSettings.offlineMode);
    $("#offlineMode").off("input.statSuite").on("input.statSuite", function ()
    {
        const isOffline = $(this).prop("checked");
        ExtensionSettings.offlineMode = isOffline;
        if (isOffline) {
            $("#modelSettings").hide();
            $("#offlineExplanation").show();
        } else {
            $("#modelSettings").show();
            $("#offlineExplanation").hide();
        }
    });

    // Show or hide offline explanation based on current setting    
    if (ExtensionSettings.offlineMode) {
        $("#modelSettings").hide();
        $("#offlineExplanation").show();
    } else {
        $("#modelSettings").show();
        $("#offlineExplanation").hide();
    }

    // Bind Character Management UI
    $('#add-character-btn').off('click.statSuite').on('click.statSuite', function() {
        const charName = String($('#new-character-input').val()).trim();
        if (charName && Characters) {
            Characters.addCharacter(charName);
            $('#new-character-input').val('');
            renderCharactersList();
        }
    });
    // Bind Anonymize Clipboard Export checkbox
    $('#anonymizeClipboardExport').prop("checked", ExtensionSettings.anonymizeClipboardExport);
    $('#anonymizeClipboardExport').off("input.statSuite").on("input.statSuite", function () {
        ExtensionSettings.anonymizeClipboardExport = $(this).prop("checked");
    });

    $('#enableScenes').prop("checked", ExtensionSettings.enableScenes);
    $('#enableScenes').off("input.statSuite").on("input.statSuite", function () {
        ExtensionSettings.enableScenes = $(this).prop("checked");
    });

    $('#clearMetadata').off("click.statSuite").on("click.statSuite", function () {
        if (confirm("Are you sure you want to clear all metadata? This action cannot be undone.")) {
            chat_metadata['StatSuite'] = {};
            saveMetadataDebounced();
            
            location.reload();
        }
    });

    Characters.addEventListener(EVENT_CHARACTER_ADDED, () => renderCharactersList());
    Characters.addEventListener(EVENT_CHARACTER_REMOVED, () => renderCharactersList());

    Stats.addEventListener(EVENT_STAT_ADDED, () => renderStatsList());
    Stats.addEventListener(EVENT_STAT_REMOVED, () => renderStatsList());
    Stats.addEventListener(EVENT_STATS_BATCH_LOADED, () => renderStatsList());

    Templates.onTemplatesChanged(() => renderTemplateSettings(true));

    renderCharactersList();
    renderStatsList();
    renderTemplateSettings();
}

export function doPopout(e: JQuery.TriggeredEvent) {
    const target = e.target;
    const statBarPopoutId = "statBarPopout";
    const statBarPopoutIdJ = "#" + statBarPopoutId;
    if ($(statBarPopoutIdJ).length === 0) {
        // --- Create Popout ---
        const drawer = $(target).closest('.inline-drawer');
        const originalElement = drawer.find('.inline-drawer-content').first();
        if (!originalElement.length) {
            console.error("StatSuite UI Error: Could not find '.inline-drawer-content' for popout.");
            return;
        }
        const originalHTMLClone = originalElement.html();
        const template = $('#zoomed_avatar_template').html();
        if (!template) {
            console.error("StatSuite UI Error: Could not find '#zoomed_avatar_template'.");
            return;
        }
        const controlBarHtml = `<div class="panelControlBar flex-container">
            <div id="statBarPopoutheader" class="fa-solid fa-grip drag-grabber hoverglow"></div>
            <div id="statBarPopoutClose" class="fa-solid fa-circle-xmark hoverglow dragClose" title="Close Popout"></div>
        </div>`;
        const newElement = $(template);
        newElement.attr('id', statBarPopoutId)
            .removeClass('zoomed_avatar')
            .addClass('draggable')
            .css({ "right": "0", "top": "auto", "left": "auto", "bottom": "auto", "position": "fixed" })
            .empty();
        newElement.append(controlBarHtml).append(originalHTMLClone);
        originalElement.html('<div class="flex-container alignitemscenter justifyCenter wide100p"><small><i>StatSuite settings popped out</i></small></div>');
        $('#movingDivs').append(newElement);
        newElement.find('#statsDrawerContent').addClass('scrollY');
        bindSettingsUI();
        loadMovingUIState();

        const animationDuration = window.animation_duration || 200;

        $(statBarPopoutIdJ).css('display', 'flex').fadeIn(animationDuration);
        dragElement(newElement);
        $('#statBarPopoutClose').off('click').on('click', function () {
            $('#statsDrawerContent').removeClass('scrollY');
            const objectivePopoutHTML = $('#statsDrawerContent');
            $(statBarPopoutIdJ).fadeOut(animationDuration, () => {
                originalElement.empty();
                originalElement.html(objectivePopoutHTML.html());
                $(statBarPopoutIdJ).remove();
                bindSettingsUI();
            });
        });
    } else {
        // --- Close Popout ---
        $('#statBarPopoutClose').trigger('click');
    }
}
