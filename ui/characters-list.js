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
    registryInstance.listTrackedCharacters().sort((a, b) => a.name.localeCompare(b.name)).forEach(char => {
        const charElement = $(`
            <div class="tracked-character">
                <span>${char.name}</span>
                <input type="checkbox" class="player-checkbox" data-character="${char.name}" ${char.isPlayer ? 'checked' : ''} title="Is Player?" />
                <div class="character-actions">
                    <i class="fas fa-times remove-character" data-character="${char.name}" title="Remove ${char.name}"></i>
                </div>
            </div>
        `);
        container.append(charElement);
    });
    container.off('click.statSuite', '.remove-character').on('click.statSuite', '.remove-character', function() {
        const char = $(this).data('character');
        if (registryInstance) {
            registryInstance.removeCharacter(char);
            renderCharactersList(registryInstance);
        }
    });
    // Handle checkbox change
    container.off('change.statSuite', '.player-checkbox').on('change.statSuite', '.player-checkbox', function() {
        const charName = $(this).data('character');
        const isPlayer = $(this).is(':checked');
        if (registryInstance && typeof registryInstance.setPlayerStatus === 'function') {
            registryInstance.setPlayerStatus(charName, isPlayer);
        } else {
            // fallback: set property directly if possible
            const charObj = registryInstance.characters && Array.from(registryInstance.characters).find(c => c.name === charName);
            if (charObj) {
                charObj.isPlayer = isPlayer;
                if (typeof registryInstance.saveToMetadata === 'function') {
                    registryInstance.saveToMetadata();
                }
            }
        }
    });
}
