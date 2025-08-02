// Handles settings UI binding and popout for StatSuite
import { ExtensionSettings, updateSetting, tryGetModels } from '../settings.js';
import { EVENT_CHARACTER_ADDED, EVENT_CHARACTER_REMOVED, EVENT_STAT_ADDED, EVENT_STAT_REMOVED, EVENT_STATS_BATCH_LOADED } from '../events.js';
import { renderCharactersList } from './characters-list.js';
import { renderStatsList } from './stats-list.js';
import { renderTemplateSettings } from './template-settings.js';
import { Templates } from '../templates/templates-registry.js';
import { loadMovingUIState } from '../../../../../../scripts/power-user.js';
import { dragElement } from '../../../../../../scripts/RossAscends-mods.js';
import { chat_metadata } from '../../../../../../script.js';
import { saveMetadataDebounced } from '../../../../../extensions.js';
import { CharacterRegistry } from '../characters/characters-registry.js';
import { StatRegistry } from '../stats/stats-registry.js';
let _characterRegistryInstance = null;
let _statsRegistryInstance = null;
/**
 * Binds settings UI elements and character management UI.
 * @param {CharacterRegistry} registryInstance
 * @param {StatRegistry} statsRegistryInstance
 */
export function bindSettingsUI(registryInstance, statsRegistryInstance) {
    _characterRegistryInstance = registryInstance;
    _statsRegistryInstance = statsRegistryInstance;
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
        }
        catch (error) {
            console.error("StatSuite UI Error: Failed to fetch models.", error);
        }
    }).trigger("click.statSuite");
    // Bind Offline Mode checkbox
    $("#offlineMode").prop("checked", ExtensionSettings.offlineMode);
    $("#offlineMode").off("input.statSuite").on("input.statSuite", function () {
        const isOffline = $(this).prop("checked");
        updateSetting('offlineMode', isOffline);
        if (isOffline) {
            $("#modelSettings").hide();
            $("#offlineExplanation").show();
        }
        else {
            $("#modelSettings").show();
            $("#offlineExplanation").hide();
        }
    });
    // Show or hide offline explanation based on current setting    
    if (ExtensionSettings.offlineMode) {
        $("#modelSettings").hide();
        $("#offlineExplanation").show();
    }
    else {
        $("#modelSettings").show();
        $("#offlineExplanation").hide();
    }
    // Bind Character Management UI
    $('#add-character-btn').off('click.statSuite').on('click.statSuite', function () {
        const charName = String($('#new-character-input').val()).trim();
        if (charName && _characterRegistryInstance) {
            _characterRegistryInstance.addCharacter(charName);
            $('#new-character-input').val('');
            renderCharactersList(_characterRegistryInstance);
        }
    });
    // Bind Anonymize Clipboard Export checkbox
    $('#anonymizeClipboardExport').prop("checked", ExtensionSettings.anonymizeClipboardExport);
    $('#anonymizeClipboardExport').off("input.statSuite").on("input.statSuite", function () {
        updateSetting('anonymizeClipboardExport', $(this).prop("checked"));
    });
    $('#clearMetadata').off("click.statSuite").on("click.statSuite", function () {
        if (confirm("Are you sure you want to clear all metadata? This action cannot be undone.")) {
            chat_metadata.StatSuite = {};
            saveMetadataDebounced();
            location.reload();
        }
    });
    // Custom stats UI
    $('#add-custom-stat-btn').off('click.statSuite').on('click.statSuite', function () {
        const name = String($('#customStatName').val()).trim();
        const defaultValue = String($('#customStatValue').val()).trim();
        if (!name)
            return;
        const config = { dependencies: [], order: Object.keys(_statsRegistryInstance._stats).length + 10, defaultValue };
        if (_statsRegistryInstance.addStat(name, config)) {
            $('#customStatName').val('');
            $('#customStatValue').val('');
        }
    });
    _characterRegistryInstance.addEventListener(EVENT_CHARACTER_ADDED, () => renderCharactersList(_characterRegistryInstance));
    _characterRegistryInstance.addEventListener(EVENT_CHARACTER_REMOVED, () => renderCharactersList(_characterRegistryInstance));
    _statsRegistryInstance.addEventListener(EVENT_STAT_ADDED, () => renderStatsList(_statsRegistryInstance));
    _statsRegistryInstance.addEventListener(EVENT_STAT_REMOVED, () => renderStatsList(_statsRegistryInstance));
    _statsRegistryInstance.addEventListener(EVENT_STATS_BATCH_LOADED, () => renderStatsList(_statsRegistryInstance));
    Templates.onTemplatesChanged(() => renderTemplateSettings());
    renderCharactersList(_characterRegistryInstance);
    renderStatsList(_statsRegistryInstance);
    renderTemplateSettings();
}
/**
 * Handles the popout of the settings drawer into a floating panel.
 * @param {JQuery.TriggeredEvent} e
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
        bindSettingsUI(_characterRegistryInstance, _statsRegistryInstance);
        loadMovingUIState();
        $(statBarPopoutIdJ).css('display', 'flex').fadeIn(window['animation_duration'] || 200);
        dragElement(newElement);
        $('#statBarPopoutClose').off('click').on('click', function () {
            $('#statsDrawerContent').removeClass('scrollY');
            const objectivePopoutHTML = $('#statsDrawerContent');
            $(statBarPopoutIdJ).fadeOut(window['animation_duration'] || 200, () => {
                originalElement.empty();
                originalElement.html(objectivePopoutHTML.html());
                $(statBarPopoutIdJ).remove();
                bindSettingsUI(_characterRegistryInstance, _statsRegistryInstance);
            });
        });
    }
    else {
        // --- Close Popout ---
        $('#statBarPopoutClose').trigger('click');
    }
}
