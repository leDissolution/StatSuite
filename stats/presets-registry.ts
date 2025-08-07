import { ExtensionSettings} from '../settings.js';
import { saveSettingsDebounced } from '../../../../../../script.js';
import { StatPreset, StatsPreset } from './preset.js';
import { Chat } from '../chat/chat-manager.js';
import { PresetsSettings } from '../settings-dtos.js';

export class PresetRegistry {
    presets: { [s: string]: StatsPreset; };
    selectedPreset: string;

    constructor() {
        this.presets = {};
        this.selectedPreset = 'default';
    }

    initializeFromMetadata(): void {
        this.presets = {};
        
        const presetsData = ExtensionSettings.stats?.presets;
        if (presetsData && typeof presetsData === 'object') {
            for (const [presetName, presetData] of Object.entries(presetsData)) {
                if (!presetData || typeof presetData !== 'object') continue;
                
                const preset = new StatsPreset(presetName);
                preset.characters = Array.isArray(presetData.characters) ? presetData.characters : [];
                
                const statsData = presetData.stats;
                if (statsData && typeof statsData === 'object') {
                    for (const [statName, statData] of Object.entries(statsData)) {
                        if (!statData || typeof statData !== 'object') continue;
                        
                        preset.set(new StatPreset(
                            statName,
                            (<any>statData).displayName ?? statName,
                            Boolean((<any>statData).active),
                            Boolean((<any>statData).manual),
                            (<any>statData).defaultValue ?? 'unspecified'
                        ));
                    }
                }
                
                this.presets[presetName] = preset;
            }
        }

        this.presets['default'] ??= new StatsPreset('default', {});

        this.selectedPreset = this.determineSelectedPreset();
    }

    private determineSelectedPreset(): string {
        const chatSelectedPreset = Chat.Metadata.selectedPreset;
        if (chatSelectedPreset && this.presets[chatSelectedPreset]) {
            return chatSelectedPreset;
        }
        
        const context = SillyTavern.getContext();
        const currentCharacter = context?.characters?.[context.characterId]?.name;
        if (currentCharacter) {
            const characterPreset = this.getPresetForCharacter(currentCharacter);
            if (characterPreset) {
                return characterPreset.name;
            }
        }
        
        return 'default';
    }

    saveToMetadata() {
        if (!ExtensionSettings.stats) ExtensionSettings.stats = { stats: {}, presets: {} };
        
        const presetsData: PresetsSettings = {};
        Object.entries(this.presets).forEach(([name, preset]) => {
            presetsData[name] = {
                name: preset.name,
                stats: preset.stats,
                characters: preset.characters,
            };
        });
        
        ExtensionSettings.stats.presets = presetsData;
        saveSettingsDebounced();

        Chat.Metadata.selectedPreset = this.selectedPreset;
        Chat.Metadata.save();
    }

    getAllPresets(): Record<string, StatsPreset> {
        return this.presets;
    }

    getPreset(name: string): StatsPreset | null {
        return this.presets[name] ?? null;
    }

    getActivePreset(): StatsPreset {
        return this.getPreset(this.selectedPreset) ?? new StatsPreset(this.selectedPreset, {});
    }

    setActivePreset(name: string) {
        if (this.presets[name]) {
            this.selectedPreset = name;
        }
    }

    addPreset(preset: StatsPreset) {
        this.presets[preset.name] = preset;
        this.saveToMetadata();
    }

    deletePreset(name: string) {
        if (name === 'default') {
            console.warn('Cannot delete default preset');
            return;
        }
        
        if (this.presets[name]) {
            delete this.presets[name];
            this.saveToMetadata();
        }
    }

    getPresetForCharacter(characterName: string): StatsPreset | null {
        if (!characterName) {
            return null;
        }

        for (const preset of Object.values(this.presets)) {
            if (preset.characters.includes(characterName)) {
                return preset;
            }
        }

        return null;
    }

    setPresetForCharacter(characterName: string, presetName: string) {
        if (!this.presets[presetName]) {
            console.warn(`Preset "${presetName}" does not exist.`);
            return;
        }

        const preset = this.getPresetForCharacter(characterName);
        if (preset) {
            preset.characters = preset.characters.filter(name => name !== characterName);
        }

        this.presets[presetName].characters.push(characterName);
        this.saveToMetadata();
    }
}

export const Presets = new PresetRegistry();
