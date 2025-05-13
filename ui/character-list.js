// Handles rendering and management of the tracked character list

/**
 * Renders the list of tracked characters in the settings UI.
 * @param {CharacterRegistry} registryInstance
 */
export function renderCharacterList(registryInstance) {
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
    registryInstance.getTrackedCharacters().forEach(char => {
        const charElement = $(`
            <div class="tracked-character">
                <span>${char}</span>
                <div class="character-actions">
                    <i class="fas fa-times remove-character" data-character="${char}" title="Remove ${char}"></i>
                </div>
            </div>
        `);
        container.append(charElement);
    });
    container.off('click.statSuite', '.remove-character').on('click.statSuite', '.remove-character', function() {
        const char = $(this).data('character');
        if (registryInstance) {
            registryInstance.removeCharacter(char);
            renderCharacterList(registryInstance);
        }
    });
}
