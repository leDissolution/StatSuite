import { Characters } from '../characters/characters-registry.js';
export function renderCharactersList() {
    if (!Characters) {
        console.error("StatSuite UI Error: CharacterRegistry instance not available for renderCharacterList.");
        return;
    }
    const container = $('#tracked-characters-list');
    if (!container.length) {
        return;
    }
    container.empty();
    console.log("StatSuite UI: Rendering character list.");
    const table = $(`
        <table class="character-table" style="width:100%; table-layout:fixed;">
            <thead>
                <tr>
                    <th style="width:60%; text-align:left;">Name</th>
                    <th style="width:20%; text-align:center;">Player</th>
                    <th style="width:20%; text-align:center;">Active</th>
                    <th style="width:20%; text-align:center;"></th>
                </tr>
            </thead>
            <tbody></tbody>
        </table>
    `);
    const tbody = table.find('tbody');
    Characters.listTrackedCharacters().forEach(char => {
        const row = $(`
            <tr class="tracked-character-row">
                <td>${char.name}</td>
                <td style="text-align:center;">
                    <input type="checkbox" class="player-checkbox" data-character="${char.name}" ${char.isPlayer ? 'checked' : ''} title="Is Player?" style="vertical-align: middle; margin: 0; margin-left:auto; margin-right:auto;" />
                </td>
                <td style="text-align:center;">
                    <input type="checkbox" class="active-checkbox" data-character="${char.name}" ${char.isActive ? 'checked' : ''} title="Is Active?" style="vertical-align: middle; margin: 0; margin-left:auto; margin-right:auto;" />
                </td>
                <td style="text-align:center;">
                    <i class="fas fa-times remove-character" data-character="${char.name}" title="Remove ${char.name}"></i>
                </td>
            </tr>
        `);
        tbody.append(row);
    });
    container.append(table);
    container.off('click.statSuite', '.remove-character').on('click.statSuite', '.remove-character', function () {
        const char = $(this).attr('data-character');
        if (char) {
            Characters.removeCharacter(char);
        }
    });
    container.off('change.statSuite', '.player-checkbox').on('change.statSuite', '.player-checkbox', function () {
        const charName = $(this).attr('data-character') ?? null;
        const isPlayer = $(this).is(':checked');
        const charObj = Characters.getCharacter(charName);
        if (charObj) {
            charObj.isPlayer = isPlayer;
            Characters.saveToMetadata();
        }
    });
    container.off('change.statSuite', '.active-checkbox').on('change.statSuite', '.active-checkbox', function () {
        const charName = $(this).attr('data-character') ?? null;
        const isActive = $(this).is(':checked');
        const charObj = Characters.getCharacter(charName);
        if (charObj) {
            charObj.isActive = isActive;
            Characters.saveToMetadata();
        }
    });
}
