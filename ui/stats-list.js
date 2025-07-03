import { onChatChanged } from '../events.js';

/**
 * Renders the list of stats in the UI, including toggles for isActive and isManual.
 * @param {import('../stats/stats-registry.js').StatRegistry} registryInstance - The StatRegistry instance to render.
 * @returns {void}
 */
export function renderStatsList(registryInstance) {
    if (!registryInstance) {
        console.error("StatSuite UI Error: StatsRegistry instance not available for renderStatsList.");
        return;
    }

    const $list = $('#custom-stats-list');
    $list.empty();
    const allStats = registryInstance.getAllStats();
    
    if (!allStats || allStats.length === 0) {
        $list.append('<div class="empty">No stats defined.</div>');
        return;
    }

    const $table = $('<table style="width:100%; border-collapse:collapse; background:none;"></table>');
    const $thead = $(`
        <thead>
            <tr style="border:none; background:none;">
                <th style="padding: 6px 0; border:none; background:none; width:1%; text-align:left;">Enable</th>
                <th style="padding: 6px 0; border:none; background:none; text-align:left;">Stat</th>
                <th style="padding: 6px 0; border:none; background:none; text-align:left;">
                    Display Name
                    <i class="fa-solid fa-pencil edit-all-display-names" title="Edit all display names" style="margin-left: 8px; cursor: pointer; opacity: 0.6; font-size: 0.9em;"></i>
                    <i class="fa-solid fa-times discard-display-name-changes" title="Discard changes" style="margin-left: 5px; cursor: pointer; opacity: 0.6; font-size: 0.9em; display: none;"></i>
                </th>
                <th style="padding: 6px 0; border:none; background:none; text-align:left;">Default</th>
                <th style="padding: 6px 0; border:none; background:none; width:1%; text-align:left;">Manual</th>
                <th style="padding: 6px 0; border:none; background:none; width:1%; text-align:right;"></th>
            </tr>
        </thead>
    `);
    $table.append($thead);
    const $tbody = $('<tbody></tbody>');
    allStats.forEach(stat => {
        const isCustom = !!stat.isCustom;
        const checked = stat.isActive ? 'checked' : '';
        const manualChecked = stat.isManual ? 'checked' : '';
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
                    <i>${stat.defaultValue}</i>
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
    $table.append($tbody);
    $list.append($table);

    $('.toggle-stat-active').off('change.statSuite').on('change.statSuite', function() {
        const key = $(this).data('key');
        const stat = registryInstance.getStatEntry(key);
        if (stat) {
            stat.isActive = $(this).prop('checked');
            registryInstance.saveToMetadata();
        }
    });
    $('.toggle-stat-manual').off('change.statSuite').on('change.statSuite', function() {
        const key = $(this).data('key');
        const stat = registryInstance.getStatEntry(key);
        if (stat) {
            stat.isManual = $(this).prop('checked');
            registryInstance.saveToMetadata();
        }
    });

    $('.edit-all-display-names').off('click.statSuite').on('click.statSuite', function() {
        const isEditMode = $(this).hasClass('fa-check');
        
        if (isEditMode) {
            $('.display-name-input').each(function() {
                const container = $(this).closest('.display-name-container');
                const key = container.data('key');
                const newVal = $(this).val();
                const stat = registryInstance.getStatEntry(key);
                
                if (stat) {
                    stat.displayName = (newVal == null || newVal.trim() === '') ? stat.name : newVal;
                }
                
                const newSpan = $('<span class="display-name-text"></span>').text(stat.displayName || stat.name);
                $(this).replaceWith(newSpan);
            });
            
            registryInstance.saveToMetadata();
            onChatChanged();
            $(this).removeClass('fa-check').addClass('fa-pencil').attr('title', 'Edit all display names');
            $('.discard-display-name-changes').hide();
        } else {
            $('.display-name-text').each(function() {
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

    $('.discard-display-name-changes').off('click.statSuite').on('click.statSuite', function() {
        $('.display-name-input').each(function() {
            const container = $(this).closest('.display-name-container');
            const key = container.data('key');
            const stat = registryInstance.getStatEntry(key);
            
            const newSpan = $('<span class="display-name-text"></span>').text(stat.displayName || stat.name);
            $(this).replaceWith(newSpan);
        });
        
        $('.edit-all-display-names').removeClass('fa-check').addClass('fa-pencil').attr('title', 'Edit all display names');
        $(this).hide();
    });

    $('.edit-all-display-names, .discard-display-name-changes').hover(
        function() { $(this).css('opacity', '1'); },
        function() { $(this).css('opacity', '0.6'); }
    );
    $('.remove-custom-stat').off('click.statSuite').on('click.statSuite', function() {
        const key = $(this).data('key');
        if (confirm(`Remove custom stat "${key}"? This cannot be undone.`)) {
            registryInstance.removeStat(key);
        }
    });
}