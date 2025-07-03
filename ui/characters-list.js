// Handles rendering and management of the tracked character list
import { CharacterRegistry } from '../characters/characters-registry.js';

/**
 * Renders the list of tracked characters in the settings UI.
 * @param {CharacterRegistry} registryInstance
 */
export function renderCharactersList(registryInstance) {
    if (!registryInstance) {
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
    registryInstance.listTrackedCharacters().forEach(char => {
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
    container.off('click.statSuite', '.remove-character').on('click.statSuite', '.remove-character', function() {
        const char = $(this).data('character');
        if (registryInstance) {
            registryInstance.removeCharacter(char);
            renderCharactersList(registryInstance);
        }
    });

    container.off('change.statSuite', '.player-checkbox').on('change.statSuite', '.player-checkbox', function() {
        const charName = $(this).data('character');
        const isPlayer = $(this).is(':checked');
        const charObj = registryInstance.characters && Array.from(registryInstance.characters).find(c => c.name === charName);
        if (charObj) {
            charObj.isPlayer = isPlayer;
            if (typeof registryInstance.saveToMetadata === 'function') {
                registryInstance.saveToMetadata();
            }
        }
    });

    container.off('change.statSuite', '.active-checkbox').on('change.statSuite', '.active-checkbox', function() {
        const charName = $(this).data('character');
        const isActive = $(this).is(':checked');
        const charObj = registryInstance.characters && Array.from(registryInstance.characters).find(c => c.name === charName);
        if (charObj) {
            charObj.isActive = isActive;
            if (typeof registryInstance.saveToMetadata === 'function') {
                registryInstance.saveToMetadata();
            }
        }
    });
}
