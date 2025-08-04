import { onChatChanged } from '../events.js';
import { Presets } from '../stats/presets-registry.js';
import { StatPreset, StatsPreset } from '../stats/preset.js';
import { StatEntry } from '../stats/stat-entry.js';
import { Stats } from '../stats/stats-registry.js';
export function renderStatsList() {
    if (!Stats) {
        console.error("StatSuite UI Error: StatsRegistry instance not available for renderStatsList.");
        return;
    }
    const $list = $('#custom-stats-list');
    $list.empty();
    const allStats = Stats.getAllStats();
    const $presetContainer = $('<div class="preset-container"></div>');
    const $presetLabel = $('<label>Preset:</label>');
    const $presetSelect = $('<select id="preset-selector" class="text_pole"></select>');
    const allPresets = Presets.getAllPresets();
    const activePreset = Presets.getActivePreset();
    Object.values(allPresets).forEach(preset => {
        const $option = $('<option></option>')
            .val(preset.name)
            .text(preset.name);
        if (preset.name === activePreset.name) {
            $option.prop('selected', true);
        }
        $presetSelect.append($option);
    });
    const $presetActions = $('<div class="preset-actions"></div>');
    const $savePresetBtn = $('<button class="menu_button">Save As</button>');
    const $deletePresetBtn = $('<button class="menu_button">Delete</button>');
    const context = SillyTavern.getContext();
    const currentCharacter = context?.characters[context.characterId]?.name;
    const isPresetLockedToCharacter = currentCharacter && activePreset.characters.includes(currentCharacter);
    const lockIcon = isPresetLockedToCharacter ? 'fa-lock' : 'fa-unlock';
    const lockColor = isPresetLockedToCharacter ? 'var(--active)' : '';
    const $lockToCharacterBtn = $(`<button class="menu_button"><i class="icon fa-solid ${lockIcon} fa-fw" style="color: ${lockColor}; padding-right: 4px;" title="Lock preset to current character"></i>Character</button>`);
    $presetActions.append($savePresetBtn, $lockToCharacterBtn);
    if (activePreset.name !== 'default') {
        $presetActions.append($deletePresetBtn);
    }
    $presetContainer.append($presetLabel, $presetSelect, $presetActions);
    $list.append($presetContainer);
    // Always show the table, even if empty, to allow adding custom stats
    const $table = $('<table style="width:100%; border-collapse:collapse; background:none;"></table>');
    const $thead = $(`
        <thead>
            <tr style="border:none; background:none;">
                <th style="padding: 6px 0; border:none; background:none; width:1%; text-align:left;">Enable</th>
                <th style="padding: 6px 0; border:none; background:none; text-align:left;">Stat</th>
                <th style="padding: 6px 0; border:none; background:none; text-align:left;">
                    <i class="fa-solid fa-pencil edit-all-display-names" title="Edit all display names" style="margin-right: 2px; cursor: pointer; opacity: 0.6; font-size: 0.9em;"></i>
                    <i class="fa-solid fa-times discard-display-name-changes" title="Discard changes" style="margin-right: 2px; cursor: pointer; opacity: 0.6; font-size: 0.9em; display: none;"></i>
                    Display
                </th>
                <th style="padding: 6px 0; border:none; background:none; text-align:left;">
                    <i class="fa-solid fa-pencil edit-default-values-btn" title="Edit defaults for custom stats" style="margin-right: 2px; cursor: pointer; opacity: 0.6; font-size: 0.9em;"></i>
                    <i class="fa-solid fa-times discard-default-value-changes-btn" title="Discard changes" style="margin-right: 2px; cursor: pointer; opacity: 0.6; font-size: 0.9em; display: none;"></i>
                    Default
                </th>
                <th style="padding: 6px 0; border:none; background:none; width:1%; text-align:left;">Manual</th>
                <th style="padding: 6px 0; border:none; background:none; width:1%; text-align:right;"></th>
            </tr>
        </thead>
    `);
    $table.append($thead);
    const $tbody = $('<tbody></tbody>');
    if (!allStats || allStats.length === 0) {
        // No stats, just show the add row
    }
    else {
        allStats.forEach(stat => {
            const isCustom = !!stat.isCustom;
            const checked = stat.isActive ? 'checked' : '';
            const manualChecked = stat.isManual ? 'checked' : '';
            let defaultCell;
            if (isCustom && isDefaultEditMode) {
                defaultCell = `<input type="text" class="text_pole default-value-input" data-key="${stat.name}" value="${stat.defaultValue}" style="width:90%;font-size:0.95em;" />`;
            }
            else {
                defaultCell = `<i>${stat.defaultValue}</i>`;
            }
            const $row = $(`
                <tr style="border:none; background:none;">
                    <td style="padding: 6px 0; border:none; background:none; width:1%; text-align:center; vertical-align:middle;">
                        <input type="checkbox" class="toggle-stat-active" data-key="${stat.name}" ${checked} style="vertical-align: middle; margin: 0; margin-left:auto; margin-right:auto;" />
                    </td>
                    <td style="padding: 6px 0; border:none; background:none; vertical-align:middle;">
                        <b>${stat.name}</b>
                    </td>
                    <td style="padding: 6px 0; border:none; background:none; vertical-align:middle;">
                        <div class="display-name-container" data-key="${stat.name}">
                            <span class="display-name-text">${stat.displayName || stat.name}</span>
                        </div>
                    </td>
                    <td style="padding: 6px 0; border:none; background:none; vertical-align:middle; color:#888; font-size:0.95em;">
                        ${defaultCell}
                    </td>
                    <td style="padding: 6px 0; border:none; background:none; width:1%; text-align:center; vertical-align:middle;">
                        <input type="checkbox" class="toggle-stat-manual" data-key="${stat.name}" ${manualChecked} style="vertical-align: middle; margin: 0; margin-left:auto; margin-right:auto;" />
                    </td>
                    <td style="padding: 6px 0; border:none; background:none; width:1%; text-align:right; vertical-align:middle;">
                        ${isCustom ? `<i class=\"fa-solid fa-xmark remove-custom-stat\" title=\"Remove\" data-key=\"${stat.name}\"></i>` : ''}
                    </td>
                </tr>
            `);
            $tbody.append($row);
        });
    }
    // Add custom stat creation row always at the end
    const $addRow = $(`
        <tr style="border:none; background:none;">
            <td style="padding: 6px 0; border:none; background:none; width:1%; text-align:center; vertical-align:middle;">
                <input type="checkbox" checked disabled style="vertical-align: middle; margin: 0; margin-left:auto; margin-right:auto; opacity:0.5;" />
            </td>
            <td style="padding: 6px 0; border:none; background:none; vertical-align:middle;">
                <input id="customStatName" class="text_pole" type="text" placeholder="Stat name" style="width: 100%;" />
            </td>
            <td style="padding: 6px 0; border:none; background:none; vertical-align:middle;">
                <input id="customStatDisplayName" class="text_pole" type="text" placeholder="Display name (optional)" style="width: 100%;" />
            </td>
            <td style="padding: 6px 0; border:none; background:none; vertical-align:middle;">
                <input id="customStatValue" class="text_pole" type="text" placeholder="Default value" style="width: 100%;" />
            </td>
            <td style="padding: 6px 0; border:none; background:none; width:1%; text-align:center; vertical-align:middle;">
                <input id="customStatManual" type="checkbox" style="vertical-align: middle; margin: 0; margin-left:auto; margin-right:auto;" />
            </td>
            <td style="padding: 6px 0; border:none; background:none; width:1%; text-align:right; vertical-align:middle;">
                <i id="add-custom-stat-btn" class="fa-solid fa-plus add-custom-stat" title="Add" style="cursor:pointer; opacity:0.7;"></i>
            </td>
        </tr>
    `);
    $tbody.append($addRow);
    $table.append($tbody);
    $list.append($table);
    // Attach handler for adding custom stat
    attachAddCustomStatHandler();
    $('.toggle-stat-active').off('change.statSuite').on('change.statSuite', function () {
        const key = $(this).data('key');
        const stat = Stats.getStatEntry(key);
        if (stat) {
            stat.isActive = $(this).prop('checked');
            Stats.saveToMetadata();
        }
    });
    $('.toggle-stat-manual').off('change.statSuite').on('change.statSuite', function () {
        const key = $(this).data('key');
        const stat = Stats.getStatEntry(key);
        if (stat) {
            stat.isManual = $(this).prop('checked');
            Stats.saveToMetadata();
        }
    });
    $('.edit-all-display-names').off('click.statSuite').on('click.statSuite', function () {
        const isEditMode = $(this).hasClass('fa-check');
        if (isEditMode) {
            $('.display-name-input').each(function () {
                const container = $(this).closest('.display-name-container');
                const key = container.data('key');
                const newVal = String($(this).val()).trim();
                const stat = Stats.getStatEntry(key);
                if (!stat)
                    return;
                stat.displayName = (newVal == null || newVal === '') ? stat.name : newVal;
                const newSpan = $('<span class="display-name-text"></span>').text(stat.displayName);
                $(this).replaceWith(newSpan);
            });
            Stats.saveToMetadata();
            onChatChanged();
            $(this).removeClass('fa-check').addClass('fa-pencil').attr('title', 'Edit all display names');
            $('.discard-display-name-changes').hide();
        }
        else {
            $('.display-name-text').each(function () {
                const currentText = $(this).text();
                const input = $('<input type="text" class="text_pole display-name-input">')
                    .val(currentText)
                    .css({
                    'width': '90%',
                    'font-size': '1em',
                    'padding': '2px 4px'
                });
                $(this).replaceWith(input);
            });
            $(this).removeClass('fa-pencil').addClass('fa-check').attr('title', 'Save all display names');
            $('.discard-display-name-changes').show();
            $('.display-name-input').first().focus().select();
        }
    });
    $('.discard-display-name-changes').off('click.statSuite').on('click.statSuite', function () {
        $('.display-name-input').each(function () {
            const container = $(this).closest('.display-name-container');
            const key = container.data('key');
            const stat = Stats.getStatEntry(key);
            if (!stat)
                return;
            const newSpan = $('<span class="display-name-text"></span>').text(stat.displayName || stat.name);
            $(this).replaceWith(newSpan);
        });
        $('.edit-all-display-names').removeClass('fa-check').addClass('fa-pencil').attr('title', 'Edit all display names');
        $(this).hide();
    });
    // Edit mode for custom stat default values (in-place, like display names)
    $('.edit-default-values-btn').off('click.statSuite').on('click.statSuite', function () {
        const isEditMode = $(this).hasClass('fa-check');
        if (isEditMode) {
            $('.default-value-input').each(function () {
                const key = $(this).data('key');
                const val = String($(this).val()).trim();
                const stat = Stats.getStatEntry(key);
                if (stat)
                    stat.defaultValue = val;
                const newCell = $('<i></i>').text(val);
                $(this).replaceWith(newCell);
            });
            Stats.saveToMetadata();
            onChatChanged();
            $(this).removeClass('fa-check').addClass('fa-pencil').attr('title', 'Edit defaults for custom stats');
            $('.discard-default-value-changes-btn').hide();
        }
        else {
            $('.display-name-container').each(function () {
                const key = $(this).data('key');
                const stat = Stats.getStatEntry(key);
                if (!stat || !stat.isCustom)
                    return;
                const cell = $(this).closest('tr').find('td').eq(3);
                const val = stat.defaultValue;
                const input = $('<input type="text" class="text_pole default-value-input">')
                    .val(val)
                    .attr('data-key', key)
                    .css({ width: '90%', 'font-size': '0.95em' });
                cell.find('i').replaceWith(input);
            });
            // Cache current values
            defaultEditCache = {};
            allStats.forEach(stat => {
                if (stat.isCustom)
                    defaultEditCache[stat.name] = stat.defaultValue;
            });
            $(this).removeClass('fa-pencil').addClass('fa-check').attr('title', 'Save all default values');
            $('.discard-default-value-changes-btn').show();
        }
    });
    $('.discard-default-value-changes-btn').off('click.statSuite').on('click.statSuite', function () {
        // Restore cached values
        Object.entries(defaultEditCache).forEach(([key, val]) => {
            const stat = Stats.getStatEntry(key);
            if (!stat)
                return;
            stat.defaultValue = val;
            // Replace input with <i>
            const row = $(`.display-name-container[data-key="${key}"]`).closest('tr');
            const cell = row.find('td').eq(3);
            cell.find('input.default-value-input').replaceWith($('<i></i>').text(val));
        });
        isDefaultEditMode = false;
        $('.edit-default-values-btn').removeClass('fa-check').addClass('fa-pencil').attr('title', 'Edit defaults for custom stats');
        $(this).hide();
    });
    $('.edit-default-values-btn, .discard-default-value-changes-btn').hover(function () { $(this).css('opacity', '1'); }, function () { $(this).css('opacity', '0.6'); });
    $('.remove-custom-stat').off('click.statSuite').on('click.statSuite', function () {
        const key = $(this).data('key');
        if (confirm(`Remove custom stat "${key}"? This cannot be undone.`)) {
            Stats.removeStat(key);
        }
    });
    $('#preset-selector').off('change.statSuite').on('change.statSuite', function () {
        const selectedPreset = String($(this).val()).trim();
        if (selectedPreset && selectedPreset !== Presets.getActivePreset().name) {
            Stats.applyPreset(selectedPreset);
            renderStatsList();
        }
    });
    $savePresetBtn.off('click.statSuite').on('click.statSuite', function () {
        const presetName = prompt('Enter a name for the preset:');
        if (presetName && presetName.trim()) {
            const trimmedName = presetName.trim();
            if (Presets.getPreset(trimmedName)) {
                if (!confirm(`Preset "${trimmedName}" already exists. Overwrite?`)) {
                    return;
                }
            }
            const newPreset = new StatsPreset(trimmedName);
            Stats.getAllStats().forEach(stat => {
                newPreset.set(new StatPreset(stat.name, stat.displayName, stat.isActive, stat.isManual, stat.defaultValue));
            });
            Presets.addPreset(newPreset);
            Presets.setActivePreset(trimmedName);
            renderStatsList();
        }
    });
    $deletePresetBtn.off('click.statSuite').on('click.statSuite', function () {
        const currentPreset = String($('#preset-selector').val()).trim();
        if (currentPreset === 'default') {
            alert('Cannot delete the default preset.');
            return;
        }
        if (confirm(`Delete preset "${currentPreset}"? This cannot be undone.`)) {
            Presets.deletePreset(currentPreset);
            Stats.applyPreset('default');
            renderStatsList();
        }
    });
    $lockToCharacterBtn.off('click.statSuite').on('click.statSuite', function () {
        const context = SillyTavern.getContext();
        const currentCharacter = context?.characters[context.characterId]?.name;
        if (!currentCharacter) {
            alert('No character is currently selected.');
            return;
        }
        const activePreset = Presets.getActivePreset();
        const isCurrentlyLocked = activePreset.characters.includes(currentCharacter);
        if (isCurrentlyLocked) {
            activePreset.characters = activePreset.characters.filter(name => name !== currentCharacter);
            Presets.saveToMetadata();
            renderStatsList();
        }
        else {
            Presets.setPresetForCharacter(currentCharacter, activePreset.name);
            renderStatsList();
        }
    });
}
let isDefaultEditMode = false;
let defaultEditCache = {};
function attachAddCustomStatHandler() {
    $('#add-custom-stat-btn').off('click.statSuite').on('click.statSuite', function () {
        const name = String($('#customStatName').val()).trim();
        const displayName = String($('#customStatDisplayName').val()).trim();
        const value = String($('#customStatValue').val()).trim();
        const isManual = $('#customStatManual').prop('checked');
        if (!name) {
            alert('Please enter a stat name.');
            return;
        }
        if (Stats.getStatEntry(name)) {
            alert('A stat with this name already exists.');
            return;
        }
        const newEntry = new StatEntry(name, {
            defaultValue: value || 'unspecified',
            displayName: displayName || name,
            isManual: isManual,
            isActive: true,
            isCustom: true,
            dependencies: [],
            order: Stats.getAllStats().length
        });
        Stats.addStat(newEntry);
        $('#customStatName').val('');
        $('#customStatDisplayName').val('');
        $('#customStatValue').val('');
        $('#customStatManual').prop('checked', false);
    });
    $('#add-custom-stat-btn').hover(function () { $(this).css('opacity', '1'); }, function () { $(this).css('opacity', '0.7'); });
}
