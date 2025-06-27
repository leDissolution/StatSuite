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
                <td style="padding: 6px 0; border:none; background:none; vertical-align:middle; color:#888; font-size:0.95em;">
                    <i>${stat.defaultValue}</i>
                </td>
                <td style="padding: 6px 0; border:none; background:none; width:1%; text-align:center; vertical-align:middle;">
                    <input type="checkbox" class="toggle-stat-manual" data-key="${stat.name}" ${manualChecked} style="vertical-align: middle; margin: 0; margin-left:auto; margin-right:auto;" />
                </td>
                <td style="padding: 6px 0; border:none; background:none; width:1%; text-align:right; vertical-align:middle;">
                    ${isCustom ? `<i class="fa-solid fa-xmark remove-custom-stat" title="Remove" data-key="${stat.name}"></i>` : ''}
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
    $('.remove-custom-stat').off('click.statSuite').on('click.statSuite', function() {
        const key = $(this).data('key');
        if (confirm(`Remove custom stat "${key}"? This cannot be undone.`)) {
            registryInstance.removeStat(key);
        }
    });
}