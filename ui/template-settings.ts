import { Templates } from "../templates/templates-registry.js";
import { Characters } from "../characters/characters-registry.js";
import { Template, TemplateData } from "../templates/template.js";
import { Stats } from "../stats/stats-registry.js";
import { StatsBlock } from "../stats/stat-block.js";

export function renderTemplateSettings(preserveDrawerStates: boolean = false) {
    const $container = $('#template-container');
    
    // Store drawer states and scroll position BEFORE any DOM manipulation
    const drawerStates: Record<string, boolean> = {};
    let scrollPosition = 0;
    if (preserveDrawerStates) {
        // Capture drawer states before container is emptied
        $('#templates-list .template-entry').each(function() {
            const templateName = $(this).attr('data-template-name');
            const isOpen = $(this).find('.inline-drawer-content').is(':visible');
            if (templateName) {
                drawerStates[templateName] = isOpen;
            }
        });
        
        const scrollContainer = $('#rm_extensions_block')[0] || document.documentElement;
        scrollPosition = scrollContainer.scrollTop;
    }
    
    $container.empty();

    // Header controls similar to worldbook
    const $headerControls = $('<div class="flex-container alignitemscenter"></div>');
    
    const $newTemplateBtn = $('<div id="new-template-btn" class="menu_button menu_button_icon interactable" tabindex="0"></div>')
        .append('<i class="fa-solid fa-plus"></i>')
        .append('<span>New Template</span>');
    
    const $refreshBtn = $('<div id="refresh-templates-btn" class="menu_button fa-solid fa-arrows-rotate interactable" title="Refresh" tabindex="0"></div>');
    
    $headerControls.append($newTemplateBtn, $refreshBtn);
    
    // Template list container
    const $templatesList = $('<div id="templates-list" class="templates-list"></div>');
    
    $container.append($headerControls, $templatesList);
    
    renderTemplatesList(drawerStates);
    attachTemplateHandlers();
    
    // Restore scroll position if preserving states
    if (preserveDrawerStates) {
        const scrollContainer = $('#rm_extensions_block')[0] || document.documentElement;
        scrollContainer.scrollTop = scrollPosition;
    }
}

function renderTemplatesList(preservedDrawerStates: Record<string, boolean> = {}) {
    const $templatesList = $('#templates-list');
    const allTemplates = Templates.getAll();
    
    // Create shadow container off-screen to build new content
    const $shadowContainer = $('<div style="position: absolute; left: -9999px; top: -9999px;"></div>');
    $('body').append($shadowContainer);
    
    // Build all template entries in the shadow container
    allTemplates.forEach((template, index) => {
        const $templateEntry = createTemplateEntry(template, index);
        $shadowContainer.append($templateEntry);
    });
    
    // Seamlessly replace content
    $templatesList.empty();
    $templatesList.append($shadowContainer.children());
    
    // Clean up shadow container
    $shadowContainer.remove();
    
    // Restore drawer states from preserved states
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

function createTemplateEntry(template: Template, index: number): JQuery<HTMLElement> {
    const $entry = $('<div class="template-entry"></div>').attr('data-template-name', template.name);
    
    const $form = $('<form class="template-entry-form"></form>');
    const $drawer = $('<div class="inline-drawer"></div>');
    
    // Header with basic controls
    const $header = $('<div class="inline-drawer-header padding0"></div>');
    const $controls = $('<div class="template-entry-thin-controls"></div>');
    
    // Expand/collapse toggle
    const $toggle = $('<div class="inline-drawer-toggle fa-fw fa-solid fa-circle-chevron-down inline-drawer-icon down interactable" tabindex="0"></div>');
    
    // Active toggle
    const $activeToggle = $('<div class="fa-solid killSwitch template-active-toggle interactable" title="Toggle template active state."></div>')
        .addClass(template.enabled ? 'fa-toggle-on' : 'fa-toggle-off')
        .attr('data-template-name', template.name);
    
    // Main content area
    const $mainContent = $('<div class="template-name-section"></div>');
    
    // Template name input
    const $nameInput = $('<input class="text_pole template-name-input" type="text" placeholder="Template Name">')
        .val(template.name)
        .attr('data-original-name', template.name);
    
    $mainContent.append($nameInput);
    
    // Header controls (depth settings, etc.)
    const $headerControls = $('<div class="template-header-controls"></div>');
    
    // Inject at depth controls
    const $depthBlock = $('<div class="template-form-control"></div>');
    const $depthLabel = $('<label class="template-header-title-mobile">Depth:</label>');
    const $depthCheckbox = $('<input type="checkbox" class="template-depth-enabled">').prop('checked', template.injectAtDepth);
    const $depthValue = $('<input class="template-depth-value" type="number" min="1" max="999">')
        .val(template.injectAtDepthValue)
        .prop('disabled', !template.injectAtDepth);
    
    $depthBlock.append($depthLabel, $depthCheckbox, $depthValue);
    $headerControls.append($depthBlock);
    
    $controls.append($toggle, $activeToggle, $mainContent, $headerControls);
    
    // Action buttons
    const $duplicateBtn = $('<i class="menu_button duplicate-template-button fa-solid fa-paste interactable" title="Duplicate template" tabindex="0"></i>')
        .attr('data-template-name', template.name);
    const $deleteBtn = $('<i class="menu_button delete-template-button fa-solid fa-trash-can interactable" title="Delete template" tabindex="0"></i>')
        .attr('data-template-name', template.name);
    
    $header.append($controls, $duplicateBtn, $deleteBtn);
    
    // Expandable content
    const $content = $('<div class="inline-drawer-content inline-drawer-outlet flex-container"></div>').hide();
    
    // Template editor - full width layout
    const $editorSection = $('<div class="template-editor-section" style="width: 100%; margin-bottom: 15px;"></div>');
    const $editorLabel = $('<label>Template String:</label>');
    const $textarea = $('<textarea class="text_pole template-string-editor" placeholder="Enter Handlebars template..." rows="10" style="width: 100%; box-sizing: border-box;"></textarea>')
        .val(template.templateString);
    
    $editorSection.append($editorLabel, $textarea);
    
    // Preview area - full width
    const $previewSection = $('<div class="template-preview-section" style="width: 100%; margin-top: 15px;"></div>');
    const $previewLabel = $('<label>Preview:</label>');
    const $previewArea = $('<div class="template-preview" style="width: 100%; box-sizing: border-box; background: var(--SmartThemeBlurTintColor, #f8f9fa); border: 1px solid var(--SmartThemeBorderColor, #ddd); border-radius: 4px; padding: 10px; min-height: 100px; font-family: monospace; white-space: pre-wrap;"></div>')
        .attr('data-template-name', template.name);
    
    // Auto-populate preview for existing templates
    if (template.templateString && template.templateString.trim()) {
        try {
            const previewTemplate = new Template({
                name: 'preview',
                templateString: template.templateString,
                enabled: true,
                injectAtDepth: true,
                injectAtDepthValue: 1
            });
            
            const sampleStats = getSampleStatsData();
            const rendered = previewTemplate.render(sampleStats);
            $previewArea.text(rendered);
        } catch (error: any) {
            $previewArea.html(`<div style="color: red;">Error: ${escapeHtml(error.message)}</div>`);
        }
    } else {
        $previewArea.html('<p class="text-muted">Preview will appear here...</p>');
    }
    
    $previewSection.append($previewLabel, $previewArea);
    $content.append($editorSection, $previewSection);
    
    $drawer.append($header, $content);
    $form.append($drawer);
    $entry.append($form);
    
    return $entry;
}

function attachTemplateHandlers() {
    // Remove all existing handlers
    $('#template-container').off('.templateSettings');
    
    // New template button
    $('#new-template-btn').off('click.templateSettings').on('click.templateSettings', function() {
        const templateName = prompt('Enter template name:')?.trim();
        if (!templateName) return;
        
        if (Templates.getTemplate(templateName)) {
            alert(`Template "${templateName}" already exists.`);
            return;
        }
        
        const newTemplate = new Template({
            name: templateName,
            templateString: '',
            enabled: true,
            injectAtDepth: true,
            injectAtDepthValue: 1
        });
        
        Templates.addTemplate(newTemplate);
        
        // Add just the new template entry instead of re-rendering everything
        const $templatesList = $('#templates-list');
        const $newEntry = createTemplateEntry(newTemplate, Templates.getAll().length - 1);
        $templatesList.append($newEntry);
    });
    
    // Refresh button
    $('#refresh-templates-btn').off('click.templateSettings').on('click.templateSettings', function() {
        renderTemplatesList();
    });
    
    // Drawer toggle is handled by global site-wide handler, no custom handling needed
    
    // Template active toggle
    $('#templates-list').on('click.templateSettings', '.template-active-toggle', function() {
        const templateName = $(this).attr('data-template-name');
        if (!templateName) return;
        
        const template = Templates.getTemplate(templateName);
        if (!template) return;
        
        template.enabled = !template.enabled;
        Templates.saveTemplateChanges();
        
        $(this).toggleClass('fa-toggle-on fa-toggle-off');
    });
    
    // Template name changes
    $('#templates-list').on('blur.templateSettings', '.template-name-input', function() {
        const $input = $(this);
        const oldName = $input.attr('data-original-name');
        const newName = $input.val()?.toString().trim();
        
        if (!oldName || !newName || newName === oldName) {
            $input.val(oldName || '');
            return;
        }
        
        if (Templates.getTemplate(newName)) {
            alert(`Template "${newName}" already exists.`);
            $input.val(oldName);
            return;
        }
        
        const template = Templates.getTemplate(oldName);
        if (template) {
            Templates.removeTemplate(oldName);
            template.name = newName;
            Templates.addTemplate(template);
            
            // Update all data attributes
            const $entry = $input.closest('.template-entry');
            $entry.attr('data-template-name', newName);
            $entry.find('[data-template-name]').attr('data-template-name', newName);
            $input.attr('data-original-name', newName);
        }
    });
    
    // Depth checkbox changes
    $('#templates-list').on('change.templateSettings', '.template-depth-enabled', function() {
        const templateName = $(this).closest('.template-entry').attr('data-template-name');
        if (!templateName) return;
        
        const template = Templates.getTemplate(templateName);
        if (!template) return;
        
        const isEnabled = $(this).prop('checked');
        template.injectAtDepth = isEnabled;
        Templates.saveTemplateChanges();
        
        $(this).siblings('.template-depth-value').prop('disabled', !isEnabled);
    });
    
    // Depth value changes
    $('#templates-list').on('change.templateSettings', '.template-depth-value', function() {
        const templateName = $(this).closest('.template-entry').attr('data-template-name');
        if (!templateName) return;
        
        const template = Templates.getTemplate(templateName);
        if (!template) return;
        
        const value = parseInt($(this).val()?.toString() || '1');
        template.injectAtDepthValue = Math.max(1, value);
        Templates.saveTemplateChanges();
    });
    
    // Auto-save and auto-refresh preview when textarea changes (with debounce)
    let saveTimeout: NodeJS.Timeout;
    $('#templates-list').on('input.templateSettings', '.template-string-editor', function() {
        const $textarea = $(this);
        const $entry = $textarea.closest('.template-entry');
        const $previewArea = $entry.find('.template-preview');
        const templateName = $entry.attr('data-template-name');
        
        clearTimeout(saveTimeout);
        saveTimeout = setTimeout(() => {
            const templateString = $textarea.val()?.toString().trim() || '';
            
            // Auto-save the template
            if (templateName) {
                const template = Templates.getTemplate(templateName);
                if (template) {
                    template.templateString = templateString;
                    Templates.saveTemplateChanges();
                }
            }
            
            // Auto-refresh preview
            if (!templateString) {
                $previewArea.html('<p class="text-muted">Preview will appear here...</p>');
                return;
            }
            
            try {
                const previewTemplate = new Template({
                    name: 'preview',
                    templateString: templateString,
                    enabled: true,
                    injectAtDepth: true,
                    injectAtDepthValue: 1
                });
                
                const sampleStats = getSampleStatsData();
                const rendered = previewTemplate.render(sampleStats);
                
                $previewArea.text(rendered);
            } catch (error: any) {
                $previewArea.html(`<div style="color: red;">Error: ${escapeHtml(error.message)}</div>`);
            }
        }, 500); // 500ms debounce
    });
    
    // Duplicate template
    $('#templates-list').on('click.templateSettings', '.duplicate-template-button', function() {
        const templateName = $(this).attr('data-template-name');
        if (!templateName) return;
        
        const template = Templates.getTemplate(templateName);
        if (!template) return;
        
        const newName = prompt('Enter name for duplicated template:', `${templateName} Copy`)?.trim();
        if (!newName) return;
        
        if (Templates.getTemplate(newName)) {
            alert(`Template "${newName}" already exists.`);
            return;
        }
        
        const duplicated = new Template({
            name: newName,
            templateString: template.templateString,
            enabled: template.enabled,
            injectAtDepth: template.injectAtDepth,
            injectAtDepthValue: template.injectAtDepthValue
        });
        
        Templates.addTemplate(duplicated);
        
        // Add just the duplicated template entry instead of re-rendering everything
        const $templatesList = $('#templates-list');
        const $newEntry = createTemplateEntry(duplicated, Templates.getAll().length - 1);
        $templatesList.append($newEntry);
    });
    
    // Delete template
    $('#templates-list').on('click.templateSettings', '.delete-template-button', function() {
        const templateName = $(this).attr('data-template-name');
        if (!templateName) return;
        
        if (confirm(`Delete template "${templateName}"? This cannot be undone.`)) {
            Templates.removeTemplate(templateName);
            
            // Remove just the deleted template entry instead of re-rendering everything
            $(this).closest('.template-entry').remove();
        }
    });
}

function getSampleStatsData(): TemplateData {
    const allStats = Stats.getAllStats();
    const allCharacters = Characters.listActiveCharacterNames();
    const sampleCharacterStats: Record<string, StatsBlock> = {};
    
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

function escapeHtml(text: string): string {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}