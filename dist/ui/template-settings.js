import { Templates } from "../templates/templates-registry.js";
import { Characters } from "../characters/characters-registry.js";
import { Template, TemplateData } from "../templates/template.js";
import { Stats } from "../stats/stats-registry.js";
import { StatsBlock } from "../stats/stat-block.js";
function getScrollContainer() {
    return $('#rm_extensions_block')[0] || document.documentElement;
}
function getTemplateFromElement($element) {
    const templateName = $element.closest('.template-entry').attr('data-template-name');
    if (!templateName)
        return null;
    const template = Templates.getTemplate(templateName);
    if (!template)
        return null;
    return { name: templateName, template };
}
function validateTemplateName(name, excludeName) {
    if (!name.trim())
        return false;
    if (excludeName && name === excludeName)
        return true;
    return !Templates.getTemplate(name);
}
function renderTemplatePreview($previewArea, templateString) {
    if (!templateString.trim()) {
        $previewArea.html('<p class="text-muted">Preview will appear here...</p>');
        return;
    }
    try {
        const previewTemplate = new Template({
            name: 'preview',
            templateString: templateString,
            enabled: true,
            injectAtDepth: true,
            injectAtDepthValue: 1,
            variableName: ''
        });
        const sampleStats = getSampleStatsData();
        const rendered = previewTemplate.render(sampleStats);
        $previewArea.text(rendered);
    }
    catch (error) {
        $previewArea.html(`<div style="color: red;">Error: ${escapeHtml(error.message)}</div>`);
    }
}
export function renderTemplateSettings(preserveDrawerStates = false) {
    const $container = $('#template-container');
    const drawerStates = {};
    let scrollPosition = 0;
    if (preserveDrawerStates) {
        $('#templates-list .template-entry').each(function () {
            const templateName = $(this).attr('data-template-name');
            const isOpen = $(this).find('.inline-drawer-content').is(':visible');
            if (templateName) {
                drawerStates[templateName] = isOpen;
            }
        });
        scrollPosition = getScrollContainer().scrollTop;
    }
    $container.empty();
    const $footerControls = $('<div class="flex-container alignitemscenter"></div>');
    const $newTemplateBtn = $('<div id="new-template-btn" class="menu_button menu_button_icon interactable" tabindex="0"></div>')
        .append('<i class="fa-solid fa-plus"></i>')
        .append('<span>New Template</span>');
    $footerControls.append($newTemplateBtn);
    const $templatesList = $('<div id="templates-list" class="templates-list"></div>');
    const $header = $('<div class="templates-list-header"></div>');
    const $headerRow = $('<div class="template-header-row"></div>');
    const $nameLabel = $('<div class="template-header-label name-label">Name</div>');
    const $injectLabel = $('<div class="template-header-label inject-label">Inject</div>');
    const $variableLabel = $('<div class="template-header-label variable-label">Variable</div>');
    $headerRow.append($nameLabel, $injectLabel, $variableLabel);
    $header.append($headerRow);
    $templatesList.append($header);
    $container.append($templatesList, $footerControls);
    renderTemplatesList(drawerStates);
    attachTemplateHandlers();
    if (preserveDrawerStates) {
        getScrollContainer().scrollTop = scrollPosition;
    }
}
function renderTemplatesList(preservedDrawerStates = {}) {
    const $templatesList = $('#templates-list');
    const allTemplates = Templates.getAll();
    $templatesList.find('.template-entry').remove();
    const $shadowContainer = $('<div style="position: absolute; left: -9999px; top: -9999px;"></div>');
    $('body').append($shadowContainer);
    allTemplates.forEach((template, index) => {
        const $templateEntry = createTemplateEntry(template, index);
        $shadowContainer.append($templateEntry);
    });
    $templatesList.append($shadowContainer.children());
    $shadowContainer.remove();
    Object.entries(preservedDrawerStates).forEach(([templateName, isOpen]) => {
        if (isOpen) {
            const $entry = $(`.template-entry[data-template-name="${templateName}"]`);
            const $content = $entry.find('.inline-drawer-content');
            const $toggle = $entry.find('.inline-drawer-toggle');
            $content.show();
            $toggle.removeClass('fa-circle-chevron-down').addClass('fa-circle-chevron-up');
        }
    });
}
function createTemplateEntry(template, index) {
    const $entry = $('<div class="template-entry"></div>').attr('data-template-name', template.name);
    const $form = $('<form class="template-entry-form"></form>');
    const $drawer = $('<div class="inline-drawer"></div>');
    const $header = $('<div class="inline-drawer-header padding0"></div>');
    const $controls = $('<div class="template-entry-thin-controls"></div>');
    const $toggle = $('<div class="inline-drawer-toggle fa-fw fa-solid fa-circle-chevron-down inline-drawer-icon down interactable" tabindex="0"></div>');
    const $activeToggle = $('<div class="fa-solid killSwitch template-active-toggle interactable" title="Toggle template active state."></div>')
        .addClass(template.enabled ? 'fa-toggle-on' : 'fa-toggle-off')
        .attr('data-template-name', template.name);
    const $mainContent = $('<div class="template-name-section"></div>');
    const $nameInput = $('<input class="text_pole template-name-input" type="text" placeholder="Template Name">')
        .val(template.name)
        .attr('data-original-name', template.name);
    $mainContent.append($nameInput);
    const $headerControls = $('<div class="template-header-controls"></div>');
    const $depthBlock = $('<div class="template-form-control"></div>');
    const $depthLabel = $('<label class="template-header-title-mobile">@D:</label>');
    const $depthCheckbox = $('<input type="checkbox" class="template-depth-enabled">').prop('checked', template.injectAtDepth);
    const $depthValue = $('<input class="template-depth-value" type="number" min="0" max="99">')
        .val(template.injectAtDepthValue)
        .prop('disabled', !template.injectAtDepth);
    const $variableNameInput = $('<input class="text_pole template-variable-name-input" type="text" placeholder="Var Name">')
        .val(template.variableName);
    $depthBlock.append($depthLabel, $depthCheckbox, $depthValue);
    $headerControls.append($depthBlock, $variableNameInput);
    $controls.append($toggle, $activeToggle, $mainContent, $headerControls);
    const $duplicateBtn = $('<i class="menu_button duplicate-template-button fa-solid fa-paste interactable" title="Duplicate template" tabindex="0"></i>')
        .attr('data-template-name', template.name);
    const $deleteBtn = $('<i class="menu_button delete-template-button fa-solid fa-trash-can interactable" title="Delete template" tabindex="0"></i>')
        .attr('data-template-name', template.name);
    $header.append($controls, $duplicateBtn, $deleteBtn);
    const $content = $('<div class="inline-drawer-content inline-drawer-outlet flex-container"></div>').hide();
    const $editorSection = $('<div class="template-editor-section" style="width: 100%; margin-bottom: 15px;"></div>');
    const $editorLabel = $('<label>Template String:</label>');
    const $textarea = $('<textarea class="text_pole template-string-editor" placeholder="Enter Handlebars template..." rows="10" style="width: 100%; box-sizing: border-box;"></textarea>')
        .val(template.templateString);
    $editorSection.append($editorLabel, $textarea);
    const $previewSection = $('<div class="template-preview-section" style="width: 100%; margin-top: 15px;"></div>');
    const $previewLabel = $('<label>Preview:</label>');
    const $previewArea = $('<div class="template-preview" style="width: 100%; box-sizing: border-box; background: var(--SmartThemeBlurTintColor, #f8f9fa); border: 1px solid var(--SmartThemeBorderColor, #ddd); border-radius: 4px; padding: 10px; min-height: 100px; font-family: monospace; white-space: pre-wrap;"></div>')
        .attr('data-template-name', template.name);
    renderTemplatePreview($previewArea, template.templateString);
    $previewSection.append($previewLabel, $previewArea);
    $content.append($editorSection, $previewSection);
    $drawer.append($header, $content);
    $form.append($drawer);
    $entry.append($form);
    return $entry;
}
function attachTemplateHandlers() {
    $('#template-container').off('.templateSettings');
    $('#new-template-btn').off('click.templateSettings').on('click.templateSettings', function () {
        var newTemplateName = 'New Template';
        if (Templates.getTemplate(newTemplateName)) {
            let counter = 1;
            while (Templates.getTemplate(`${newTemplateName} (${counter})`)) {
                counter++;
            }
            newTemplateName = `${newTemplateName} (${counter})`;
        }
        const newTemplate = new Template({
            name: newTemplateName,
            templateString: '',
            enabled: true,
            injectAtDepth: true,
            injectAtDepthValue: 1,
            variableName: ''
        });
        Templates.addTemplate(newTemplate);
    });
    $('#templates-list').on('click.templateSettings', '.template-active-toggle', function () {
        const result = getTemplateFromElement($(this));
        if (!result)
            return;
        result.template.enabled = !result.template.enabled;
        Templates.saveTemplateChanges();
        $(this).toggleClass('fa-toggle-on fa-toggle-off');
    });
    $('#templates-list').on('blur.templateSettings', '.template-name-input', function () {
        const $input = $(this);
        const oldName = $input.attr('data-original-name');
        const newName = $input.val()?.toString().trim();
        if (!oldName || !newName || newName === oldName) {
            $input.val(oldName || '');
            return;
        }
        if (!validateTemplateName(newName, oldName)) {
            alert(`Template "${newName}" already exists.`);
            $input.val(oldName);
            return;
        }
        const template = Templates.getTemplate(oldName);
        if (template) {
            Templates.removeTemplate(oldName);
            template.name = newName;
            Templates.addTemplate(template);
            const $entry = $input.closest('.template-entry');
            $entry.attr('data-template-name', newName);
            $entry.find('[data-template-name]').attr('data-template-name', newName);
            $input.attr('data-original-name', newName);
        }
    });
    $('#templates-list').on('change.templateSettings', '.template-depth-enabled', function () {
        const result = getTemplateFromElement($(this));
        if (!result)
            return;
        const isEnabled = $(this).prop('checked');
        result.template.injectAtDepth = isEnabled;
        Templates.saveTemplateChanges();
        $(this).siblings('.template-depth-value').prop('disabled', !isEnabled);
    });
    $('#templates-list').on('change.templateSettings', '.template-depth-value', function () {
        const result = getTemplateFromElement($(this));
        if (!result)
            return;
        const value = parseInt($(this).val()?.toString() || '0');
        result.template.injectAtDepthValue = Math.max(0, value);
        Templates.saveTemplateChanges();
    });
    $('#templates-list').on('change.templateSettings', '.template-variable-name-input', function () {
        const result = getTemplateFromElement($(this));
        if (!result)
            return;
        const variableName = $(this).val()?.toString().trim() || '';
        result.template.variableName = variableName;
        Templates.saveTemplateChanges();
    });
    let saveTimeout;
    $('#templates-list').on('input.templateSettings', '.template-string-editor', function () {
        const $textarea = $(this);
        const $entry = $textarea.closest('.template-entry');
        const $previewArea = $entry.find('.template-preview');
        const result = getTemplateFromElement($textarea);
        clearTimeout(saveTimeout);
        saveTimeout = setTimeout(() => {
            const templateString = $textarea.val()?.toString().trim() || '';
            if (result) {
                result.template.templateString = templateString;
            }
            renderTemplatePreview($previewArea, templateString);
        }, 500);
    });
    $('#templates-list').on('blur.templateSettings', '.template-string-editor', function () {
        const result = getTemplateFromElement($(this));
        if (!result)
            return;
        const templateString = $(this).val()?.toString().trim() || '';
        result.template.templateString = templateString;
        Templates.saveTemplateChanges();
    });
    $('#templates-list').on('click.templateSettings', '.duplicate-template-button', function () {
        const templateName = $(this).attr('data-template-name');
        if (!templateName)
            return;
        const template = Templates.getTemplate(templateName);
        if (!template)
            return;
        let newName = `${templateName} Copy`;
        if (!validateTemplateName(newName)) {
            let counter = 1;
            while (Templates.getTemplate(`${newName} (${counter})`)) {
                counter++;
            }
            newName = `${newName} (${counter})`;
        }
        const duplicated = new Template({
            name: newName,
            templateString: template.templateString,
            enabled: template.enabled,
            injectAtDepth: template.injectAtDepth,
            injectAtDepthValue: template.injectAtDepthValue,
            variableName: template.variableName
        });
        Templates.addTemplate(duplicated);
    });
    $('#templates-list').on('click.templateSettings', '.delete-template-button', function () {
        const templateName = $(this).attr('data-template-name');
        if (!templateName)
            return;
        if (confirm(`Delete template "${templateName}"? This cannot be undone.`)) {
            Templates.removeTemplate(templateName);
            $(this).closest('.template-entry').remove();
        }
    });
}
function getSampleStatsData() {
    const allStats = Stats.getAllStats();
    const allCharacters = Characters.listActiveCharacterNames();
    const sampleCharacterStats = {};
    if (allCharacters.length === 0) {
        allCharacters.push('Sample Character');
    }
    allCharacters.forEach(character => {
        const statsBlock = new StatsBlock();
        allStats.forEach(stat => {
            statsBlock[stat.name] = stat.defaultValue;
        });
        sampleCharacterStats[character] = statsBlock;
    });
    return new TemplateData(sampleCharacterStats);
}
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}
