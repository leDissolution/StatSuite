import { Templates } from "../templates/templates-registry.js";
import { Characters } from "../characters/characters-registry.js";
import { Template, TemplateData } from "../templates/template.js";
import { Stats } from "../stats/stats-registry.js";
import { StatsBlock } from "../stats/stat-block.js";

/**
 * Renders the templates section in the settings UI.
 */
export function renderTemplateSettings() {
    const $container = $('#template-container');
    $container.empty();

    const $templateControls = $('<div class="template-controls"></div>');
    
    const $selectorContainer = $('<div class="template-selector-container"></div>');
    const $templateLabel = $('<label>Template:</label>');
    const $templateSelect = $('<select id="template-selector" class="text_pole"></select>');
    
    const allTemplates = Templates.getAll();
    allTemplates.forEach(template => {
        const $option = $('<option></option>')
            .val(template.name)
            .text(template.name);

        if (template.name === 'Default') {
            $option.attr('selected', 'selected');
        }
        
        $templateSelect.append($option);
    });
    
    $selectorContainer.append($templateLabel, $templateSelect);
    
    const $templateActions = $('<div class="template-actions"></div>');
    const $newTemplateBtn = $('<button id="new-template-btn" class="menu_button">New</button>');
    const $saveTemplateBtn = $('<button id="save-template-btn" class="menu_button">Save</button>');
    const $deleteTemplateBtn = $('<button id="delete-template-btn" class="menu_button">Delete</button>');
    const $previewBtn = $('<button id="preview-template-btn" class="menu_button">Preview</button>');
    
    $templateActions.append($newTemplateBtn, $saveTemplateBtn, $deleteTemplateBtn, $previewBtn);
    $templateControls.append($selectorContainer, $templateActions);
    
    const $templateEditor = $('<div class="template-editor"></div>');
    const $templateTextLabel = $('<label>Template String:</label>');
    const $templateTextArea = $('<textarea id="template-text" class="text_pole" placeholder="Enter Handlebars template..." rows="10" style="width: 100%; font-family: monospace;"></textarea>');
    $templateEditor.append($templateTextLabel, $templateTextArea);
    
    const $previewContainer = $('<div class="template-preview-container"></div>');
    const $previewLabel = $('<label>Preview:</label>');
    const $previewArea = $('<div id="template-preview" class="template-preview"></div>');
    $previewContainer.append($previewLabel, $previewArea);
    
    $container.append($templateControls, $templateEditor, $previewContainer);
    
    attachTemplateHandlers();
}

/**
 * Attaches event handlers for template settings.
 */
function attachTemplateHandlers() {
    let currentTemplate = null;
    let isNewTemplate = false;
    
    // Template selector change
    $('#template-selector').off('change.templateSettings').on('change.templateSettings', function() {
        const selectedName = String($(this).val());
        if (selectedName) {
            currentTemplate = Templates.getTemplate(selectedName);
            if (currentTemplate) {
                $('#template-text').val(currentTemplate.templateString);
                $('#delete-template-btn').show();
                isNewTemplate = false;
                clearPreview();
            }
        } else {
            currentTemplate = null;
            $('#template-text').val('');
            $('#delete-template-btn').hide();
            isNewTemplate = false;
            clearPreview();
        }
    });
    
    // New template button
    $('#new-template-btn').off('click.templateSettings').on('click.templateSettings', function() {
        currentTemplate = null;
        isNewTemplate = true;
        $('#template-selector').val('');
        $('#template-text').val('');
        $('#delete-template-btn').hide();
        clearPreview();
    });
    
    // Save template button
    $('#save-template-btn').off('click.templateSettings').on('click.templateSettings', function() {
        const templateString = String($('#template-text').val()).trim();
        if (!templateString) {
            alert('Please enter a template string.');
            return;
        }
        
        let templateName;
        if (isNewTemplate) {
            // Use popup to get template name
            templateName = prompt('Enter template name:');
            if (!templateName || !templateName.trim()) {
                return; // User cancelled or entered empty name
            }
            templateName = templateName.trim();
            
            // Check if template already exists
            if (Templates.getTemplate(templateName)) {
                if (!confirm(`Template "${templateName}" already exists. Overwrite?`)) {
                    return;
                }
                Templates.removeTemplate(templateName);
            }
        } else if (currentTemplate) {
            templateName = currentTemplate.name;
        } else {
            alert('No template selected.');
            return;
        }
        
        // Create and add the template
        const template = new Template(templateName, templateString);
        
        // Validate template before saving
        if (!template.isValid()) {
            alert('Template contains syntax errors and cannot be saved.');
            return;
        }
        
        if (isNewTemplate || !currentTemplate) {
            Templates.addTemplate(template);
        } else {
            // Update existing template
            currentTemplate.templateString = templateString;
        }
        
        // Refresh the UI to update the dropdown
        const selectedTemplateName = templateName;
        renderTemplateSettings();
        $('#template-selector').val(selectedTemplateName);
        $('#template-selector').trigger('change');
    });
    
    // Delete template button
    $('#delete-template-btn').off('click.templateSettings').on('click.templateSettings', function() {
        if (!currentTemplate) return;
        
        if (confirm(`Delete template "${currentTemplate.name}"? This cannot be undone.`)) {
            Templates.removeTemplate(currentTemplate.name);
            // Refresh the UI to update the dropdown
            renderTemplateSettings();
        }
    });
    
    // Preview template button
    $('#preview-template-btn').off('click.templateSettings').on('click.templateSettings', function() {
        const templateString = String($('#template-text').val()).trim();
        if (!templateString) {
            alert('Please enter a template string.');
            return;
        }
        
        try {
            // Create a temporary template for preview
            const previewTemplate = new Template('preview', templateString);
            
            // Get sample stats data
            const sampleStats = getSampleStatsData();
            
            // Render the template
            const rendered = previewTemplate.render(sampleStats);
            
            // Display the preview
            $('#template-preview').html(`<pre>${escapeHtml(rendered)}</pre>`);
            
        } catch (error) {
            $('#template-preview').html(`<div class="error">Error: ${escapeHtml(error.message)}</div>`);
        }
    });
    
    // Initially hide delete button
    $('#delete-template-btn').hide();
}

/**
 * Gets sample stats data for template preview.
 * @returns {TemplateData} Sample stats object
 */
function getSampleStatsData() {
    const allStats = Stats.getAllStats();
    const allCharacters = Characters.listActiveCharacterNames();
    /** @type {Record<string, StatsBlock>} */
    const sampleCharacterStats = {};
    
    if (allCharacters.length === 0) {
        allCharacters.push('Sample Character');
    }

    allCharacters.forEach(character => {
        /** @type {StatsBlock} */
        const statsBlock = new StatsBlock();
        allStats.forEach(stat => {
            statsBlock.set(stat.name, stat.defaultValue);
        });
        sampleCharacterStats[character] = statsBlock;
    });

    return new TemplateData(sampleCharacterStats);
}

/**
 * Clears the template preview area.
 */
function clearPreview() {
    $('#template-preview').html('<p class="text-muted">Preview will appear here...</p>');
}

/**
 * Escapes HTML characters for safe display.
 * @param {string} text - Text to escape
 * @returns {string} Escaped text
 */
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

