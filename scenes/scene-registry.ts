import { Scene } from './scene.js';
import { Chat } from '../chat/chat-manager.js';
import { EVENT_SCENE_ADDED, EVENT_SCENE_REMOVED } from '../events.js';
import { StatsBlock } from '../stats/stat-block.js';

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
                rehydrated.stats = new StatsBlock(scene.stats || {});
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

	listTrackedSceneNames(): string[] {
		return this.listTrackedScenes()
			.map(sc => sc.name)
			.sort();
	}

	listActiveSceneNames(): string[] {
		return this.listTrackedScenes()
			.filter(sc => sc.isActive)
			.map(sc => sc.name)
			.sort();
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