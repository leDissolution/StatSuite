import { Scene } from './scene.js';
import { Chat } from '../chat/chat-manager.js';
import { EVENT_SCENE_ADDED, EVENT_SCENE_REMOVED } from '../events.js';
import { StatsBlock } from '../stats/stat-block.js';
import { SceneManager } from './scene-manager.js';

export class SceneRegistry {
	private _scenes: Set<Scene>;
	private _eventTarget: EventTarget;

	constructor() {
		this._scenes = new Set();
		this._eventTarget = new EventTarget();
	}

	initializeFromMetadata() {
		const trackedScenes = Chat.Metadata.trackedScenes;
		this._scenes.clear();

		trackedScenes.forEach((scene: any) => {
			if (scene instanceof Scene) {
				this.attachScene(scene);
			} else if (typeof scene === 'object' && scene !== null && 'name' in scene) {
				const rehydrated = new Scene(scene.name, scene.isActive);
				this.attachScene(rehydrated);
			} else if (typeof scene === 'string') {
				this.addScene(scene);
			}
		});
	}

	addScene(name: string) {
		const scene = new Scene(name);
		this.attachScene(scene);
	}

	attachScene(scene: Scene): boolean {
		if (!this.hasScene(scene.name)) {
			this._scenes.add(scene);
			this.saveToMetadata();
			this._eventTarget.dispatchEvent(new CustomEvent(EVENT_SCENE_ADDED, { detail: scene.name }));
			return true;
		}
		return false;
	}

	removeScene(name: string): boolean {
		let removed = false;
		for (const sc of this._scenes) {
			if (sc.name === name) {
				this._scenes.delete(sc);
				removed = true;
				break;
			}
		}
		if (removed) {
			this.saveToMetadata();
			this._eventTarget.dispatchEvent(new CustomEvent(EVENT_SCENE_REMOVED, { detail: name }));
		}
		return removed;
	}

	hasScene(name: string): boolean {
		for (const sc of this._scenes) {
			if (sc.name === name) return true;
		}
		return false;
	}

	getScene(name: string | null): Scene | null {
		for (const sc of this._scenes) {
			if (sc.name === name) return sc;
		}
		return null;
	}

	getSceneIx(name: string): number {
		return this.listTrackedScenes().findIndex(sc => sc.name === name);
	}

	getLatestSceneStats(name: string, messageId: number): StatsBlock | null {
		for (let ix = messageId; ix >= 0; ix--) {
			const stats = Chat.getMessageStats(ix);
			if (!stats) continue;

			if (!stats.Scenes) {
				return null;
			}

			if (stats.Scenes[name]) {
				return stats.Scenes[name];
			}

			for (const sc in stats.Scenes) {
				if (name.endsWith(sc)) {
					return stats.Scenes[sc] || null;
				}
			}
		}

		return null;
	}

	listTrackedSceneNames(): string[] {
		return this.listTrackedScenes()
			.map(sc => sc.name)
			.sort();
	}

	private static overrideMobileBase(base: string): boolean | null {
		const mobileBases = ['elevator'];
		
		return mobileBases.includes(base) ? true : null;
	}

	private static potentiallyMobileBaseHeuristic(base: string): boolean {
		const keywords = ['car', 'bus', 'train', 'ship', 'spaceship', 'van', 'elevator'];
		return keywords.some(keyword => base == keyword);
	}

	private static containsWholeWord(hay: string, needle: string): boolean {
		hay = hay.toLowerCase();
		needle = needle.toLowerCase();

		let idx = hay.indexOf(needle);
		while (idx !== -1) {
			const before = idx === 0 ? '' : hay[idx - 1]!;
			const after = idx + needle.length >= hay.length ? '' : hay[idx + needle.length]!;
			const isBoundary = (c: string) => !/[a-z0-9"']/i.test(c);
			if ((before === '' || isBoundary(before)) && (after === '' || isBoundary(after))) return true;
			idx = hay.indexOf(needle, idx + needle.length);
		}
		return false;
	}

	prefetchSceneNames(messageId: number): string[] {
		const stats = Chat.getMessageStats(messageId);
		if (!stats) return [];

		const sceneManager = new SceneManager(Chat.getMessageStats.bind(Chat), {
			isPotentiallyMobile: SceneRegistry.potentiallyMobileBaseHeuristic,
			mobileOverride: SceneRegistry.overrideMobileBase
		});
		const { scenes } = sceneManager.getSceneGraphForMessage(messageId);
		const allScenes = new Set<string>();
		for (const s of Object.values(scenes)) allScenes.add(s.baseName);
		if (allScenes.size === 0) return [];

		const sceneCandidates = new Set<string>();
		const tryMatch = (text?: string) => {
			if (!text) return;
			const t = text;
			for (const name of allScenes) {
				if (SceneRegistry.containsWholeWord(t, name)) sceneCandidates.add(name);
			}
		};

		const sceneStats = stats.Scenes ?? {};
		for (const sName in sceneStats) {
			const block = sceneStats[sName] ?? {};
			for (const statKey in block) tryMatch(statKey);
		}

		const chars = stats.Characters ?? {};
		for (const cName in chars) {
			const location = chars[cName]?.['location'];
			if (typeof location !== 'string') continue;
			const parts = location.split(';');
			const headingTo = parts.length > 1 && parts[1] ? parts[1].trim() : '';
			tryMatch(headingTo);
		}

		return Array.from(sceneCandidates);
	}

	listActiveSceneNames(messageId: number, previousMessageId: number | null): string[] {
		const locations = new Set<string>();

		const sceneManager = new SceneManager(Chat.getMessageStats.bind(Chat), {
			isPotentiallyMobile: SceneRegistry.potentiallyMobileBaseHeuristic,
			mobileOverride: SceneRegistry.overrideMobileBase
		});
		const { scenes } = sceneManager.getSceneGraphForMessage(messageId);
		const activeSceneIds = sceneManager.getActiveScenes(messageId, scenes);

		if (previousMessageId !== null) {
			activeSceneIds.push(...sceneManager.getActiveScenes(previousMessageId, scenes));
		}

		activeSceneIds.forEach(sceneId => {
			const name = sceneManager.buildDisplayName(scenes, sceneId);
			if (name) locations.add(name);
		});

		return Array.from(locations);
	}

	listTrackedScenes(): Scene[] {
		return Array.from(this._scenes);
	}

	addEventListener(type: string, callback: (event: Event) => void) {
		this._eventTarget.addEventListener(type, callback);
	}

	removeEventListener(type: string, callback: (event: Event) => void) {
		this._eventTarget.removeEventListener(type, callback);
	}

	saveToMetadata() {
		Chat.Metadata.trackedScenes = this.listTrackedScenes();
		Chat.Metadata.save();
	}

	clear() {
		this._scenes.clear();
		this.saveToMetadata();
	}
}

export const Scenes = new SceneRegistry();