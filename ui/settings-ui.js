// Handles settings UI binding and popout for StatSuite

import { ExtensionSettings, updateSetting, tryGetModels, getCustomStatsForChat, addCustomStatToChat, removeCustomStatFromChat } from '../settings.js';
import { EVENT_CHARACTER_ADDED, EVENT_CHARACTER_REMOVED } from '../events.js';
import { renderCharacterList } from './character-list.js';
import { loadMovingUIState } from '../../../../../scripts/power-user.js';
import { dragElement } from '../../../../../scripts/RossAscends-mods.js';
import { addCustomStat } from '../stats_logic.js';

let _characterRegistryInstance = null;

/**
 * Binds settings UI elements and character management UI.
 * @param {CharacterRegistry} registryInstance
 */
export function bindSettingsUI(registryInstance) {
    _characterRegistryInstance = registryInstance;
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
                        const selectedModel = $(this).val();
                        updateSetting('modelName', selectedModel);
                        $(".online_status_text_stat_suite").text(`${selectedModel}`);
                    });
                }
                $(".online_status_indicator_stat_suite").addClass("online");
            }
        } catch (error) {
            console.error("StatSuite UI Error: Failed to fetch models.", error);
        }
    }).trigger("click.statSuite");
    // Bind Character Management UI
    $('#add-character-btn').off('click.statSuite').on('click.statSuite', function() {
        const charName = $('#new-character-input').val().trim();
        if (charName && _characterRegistryInstance) {
            _characterRegistryInstance.addCharacter(charName);
            $('#new-character-input').val('');
            renderCharacterList(_characterRegistryInstance);
        }
    });
    // Bind Anonymize Clipboard Export checkbox
    $('#anonymizeClipboardExport').prop("checked", ExtensionSettings.anonymizeClipboardExport);
    $('#anonymizeClipboardExport').off("input.statSuite").on("input.statSuite", function () {
        updateSetting('anonymizeClipboardExport', $(this).prop("checked"));
    });

    // Custom stats UI
    $('#add-custom-stat-btn').off('click.statSuite').on('click.statSuite', function() {
        const name = $('#customStatName').val().trim().toLowerCase();
        const defaultValue = $('#customStatValue').val().trim();
        if (!name) return;
        const config = { dependencies: [], order: getCustomStatsForChat().length + 10, defaultValue };
        if (addCustomStatToChat(name, config)) {
            addCustomStat(name, config);
            $('#customStatName').val('');
            $('#customStatValue').val('');
            renderCustomStatsList();
        }
    });
    renderCustomStatsList();

    _characterRegistryInstance.addEventListener(EVENT_CHARACTER_ADDED, () => renderCharacterList(_characterRegistryInstance));
    _characterRegistryInstance.addEventListener(EVENT_CHARACTER_REMOVED, () => renderCharacterList(_characterRegistryInstance));

    renderCharacterList(_characterRegistryInstance);
}

function renderCustomStatsList() {
    const $list = $('#custom-stats-list');
    $list.empty();
    const arr = getCustomStatsForChat();
    if (!arr || arr.length === 0) {
        $list.append('<div class="empty">No custom stats defined.</div>');
        return;
    }
    arr.forEach(({ key, config }) => {
        const $row = $(`<div class="tracked-character"><span><b>${key}</b> (default: <i>${config.defaultValue}</i>)</span><span class="character-actions"><i class="fa-solid fa-trash remove-custom-stat" title="Remove" data-key="${key}"></i></span></div>`);
        $list.append($row);
    });
    // Remove handler
    $('.remove-custom-stat').off('click.statSuite').on('click.statSuite', function() {
        const key = $(this).data('key');
        removeCustomStatFromChat(key);
        renderCustomStatsList();
    });
}

/**
 * Handles the popout of the settings drawer into a floating panel.
 * @param {Event} e
 */
export function doPopout(e) {
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
        bindSettingsUI(_characterRegistryInstance);
        loadMovingUIState();
        $(statBarPopoutIdJ).css('display', 'flex').fadeIn(window.animation_duration || 200);
        dragElement(newElement);
        $('#statBarPopoutClose').off('click').on('click', function () {
            $('#statsDrawerContent').removeClass('scrollY');
            const objectivePopoutHTML = $('#statsDrawerContent');
            $(statBarPopoutIdJ).fadeOut(window.animation_duration || 200, () => {
                originalElement.empty();
                originalElement.html(objectivePopoutHTML);
                $(statBarPopoutIdJ).remove();
                bindSettingsUI(_characterRegistryInstance);
            });
        });
    } else {
        // --- Close Popout ---
        $('#statBarPopoutClose').trigger('click');
    }
}
