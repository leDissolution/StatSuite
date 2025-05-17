export function renderStatsList(registryInstance) {
    if (!registryInstance) {
        console.error("StatSuite UI Error: StatsRegistry instance not available for renderStatsList.");
        return;
    }

    const $list = $('#custom-stats-list');
    $list.empty();
    const allStats = Object.values(registryInstance._stats)
        .sort((a, b) => (a.order ?? 9999) - (b.order ?? 9999));
    if (!allStats || allStats.length === 0) {
        $list.append('<div class="empty">No stats defined.</div>');
        return;
    }
    allStats.forEach(stat => {
        const isCustom = !!stat.isCustom;
        const checked = stat.isActive ? 'checked' : '';
        const $row = $(`
            <div class="tracked-character" style="display: flex; align-items: center; justify-content: space-between;">
                <span style="display: flex; align-items: center; gap: 8px;">
                    <input type="checkbox" class="toggle-stat-active" data-key="${stat.name}" ${checked} style="vertical-align: middle; margin: 0 6px 0 0;" />
                    <b>${stat.name}</b> (default: <i>${stat.defaultValue}</i>)
                </span>
                <div class="character-actions">
                    ${isCustom ? `<i class="fa-solid fa-xmark remove-custom-stat" title="Remove" data-key="${stat.name}"></i>` : ''}
                </div>
            </div>
        `);
        $list.append($row);
    });
    $('.toggle-stat-active').off('change.statSuite').on('change.statSuite', function() {
        const key = $(this).data('key');
        const stat = registryInstance.getStatConfig(key);
        if (stat) {
            stat.isActive = this.checked;
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