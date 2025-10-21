import { Scene } from './scene.js';
import { Chat } from '../chat/chat-manager.js';
import { EVENT_SCENE_ADDED, EVENT_SCENE_REMOVED } from '../events.js';
import { StatsBlock } from '../stats/stat-block.js';
import { SceneManager } from './scene-manager.js';

type SceneGraphEntry = {
	baseName: string;
	parentId: string | null;
};
type SceneGraphMap = Record<string, SceneGraphEntry>;

const PREFETCH_PASSAGE_SCAN_DEPTH = 3;

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

	private static normalizeSceneName(name: string): string {
		return name
			.split(',')
			.map(part => part.trim())
			.filter(Boolean)
			.join(', ')
			.toLowerCase();
	}

	private static normalizeBaseName(name: string): string {
		return name.trim().toLowerCase();
	}

	private static extractPassageTargets(passageText: string): string[] {
		if (typeof passageText !== 'string') return [];
		const targets = new Set<string>();
		const segments = passageText.split(';');
		for (const segment of segments) {
			const trimmed = segment.trim();
			if (!trimmed) continue;
			const regex = /\bto\b\s*([^;\[\]]+)/gi;
			let match: RegExpExecArray | null;
			while ((match = regex.exec(trimmed)) !== null) {
				const raw = match[1]?.trim() ?? '';
				if (!raw) continue;
				const cleaned = raw
					.replace(/\s*\[.*$/, '')
					.replace(/[.,;:]+$/, '')
					.trim();
				if (cleaned) targets.add(cleaned);
			}
		}
		return Array.from(targets);
	}

	private static parsePassageEntries(passageText: string): Array<{ kind: string; target: string; state: string | null }> {
		if (typeof passageText !== 'string') return [];
		const entries: Array<{ kind: string; target: string; state: string | null }> = [];
		for (const segment of passageText.split(';')) {
			const trimmed = segment.trim();
			if (!trimmed) continue;
			// capture: left side (kind), target, optional [state]
			const m = trimmed.match(/^(.*?)\bto\b\s*([^\[\]]+?)(?:\s*(\[[^\]]+\]))?\s*$/i);
			if (!m) continue;
			const kind = (m[1] || '').trim();
			let target = (m[2] || '').trim().replace(/[.,;:]+$/, '');
			const state = (m[3] || '').trim() || null;
			if (!target || target.toLowerCase() === 'unspecified') continue;
			entries.push({ kind, target, state });
		}
		return entries;
	}

	prefetchSceneNames(messageId: number): string[] {
		const stats = Chat.getMessageStats(messageId);
		if (!stats) return [];

		const sceneManager = new SceneManager(Chat.getMessageStats.bind(Chat), {
			isPotentiallyMobile: SceneRegistry.potentiallyMobileBaseHeuristic,
			mobileOverride: SceneRegistry.overrideMobileBase
		});
		const sceneGraph = sceneManager.getSceneGraphForMessage(messageId);
		const scenes: SceneGraphMap = sceneGraph.scenes as SceneGraphMap;
		const hierarchy = sceneGraph.hierarchy as Record<string, string[]>;
		const sceneEntries = Object.entries(scenes) as Array<[string, SceneGraphEntry]>;
		const allScenes = new Set<string>();
		for (const [, scene] of sceneEntries) allScenes.add(scene.baseName);
		if (allScenes.size === 0) return [];

		const chainCache = new Map<string, string[]>();
		const fullNameToIds = new Map<string, string[]>();
		const baseNameToIds = new Map<string, string[]>();
		const neighbors = new Map<string, string[]>();
		const idToFullName = new Map<string, string>();

		const pushToMap = (map: Map<string, string[]>, key: string, value: string) => {
			if (!map.has(key)) map.set(key, []);
			map.get(key)!.push(value);
		};

		const buildChain = (id: string): string[] => {
			if (chainCache.has(id)) return chainCache.get(id)!;
			const chain: string[] = [];
			const guard = new Set<string>();
			let current: string | null = id;
			while (current && !guard.has(current)) {
				guard.add(current);
				const scene: SceneGraphEntry | undefined = scenes[current as keyof SceneGraphMap];
				if (!scene) break;
				chain.push(scene.baseName);
				current = scene.parentId ?? null;
			}
			chain.reverse();
			chainCache.set(id, chain);
			return chain;
		};

		const getFullName = (id: string): string | null => {
			const cached = idToFullName.get(id);
			if (cached && cached.trim() !== '') return cached;
			const chain = buildChain(id);
			if (chain.length === 0) return null;
			const full = chain.join(', ');
			idToFullName.set(id, full);
			return full;
		};

		for (const [id, scene] of sceneEntries) {
			const chain = buildChain(id);
			idToFullName.set(id, chain.join(', '));
			if (chain.length > 0) {
				const normalizedFullName = SceneRegistry.normalizeSceneName(chain.join(', '));
				if (normalizedFullName) pushToMap(fullNameToIds, normalizedFullName, id);
			}

			const baseKey = SceneRegistry.normalizeBaseName(scene.baseName);
			if (baseKey) pushToMap(baseNameToIds, baseKey, id);

			const adjacency = new Set<string>();
			if (scene.parentId) adjacency.add(scene.parentId);
			const children = hierarchy[id] ?? [];
			for (const childId of children) adjacency.add(childId);
			neighbors.set(id, Array.from(adjacency));
		}

		const chainEntries = Array.from(chainCache.entries());

		const findSceneIdsForName = (name: string): string[] => {
			const normalizedName = SceneRegistry.normalizeSceneName(name);
			let ids = fullNameToIds.get(normalizedName) ?? [];
			if (ids.length > 0) return ids;

			const segments = name
				.split(',')
				.map(part => part.trim())
				.filter(Boolean);
			if (segments.length === 0) return [];

			const segLower = segments.map(seg => seg.toLowerCase());
			const suffixMatches: string[] = [];
			for (const [id, chain] of chainEntries) {
				if (chain.length < segments.length) continue;
				let idx = chain.length - segments.length;
				let matches = true;
				for (let i = 0; i < segLower.length; i++) {
					if (chain[idx + i]!.toLowerCase() !== segLower[i]!) {
						matches = false;
						break;
					}
				}
				if (matches) suffixMatches.push(id);
			}
			if (suffixMatches.length > 0) return suffixMatches;

			const lastSegment = segLower[segLower.length - 1]!;
			return baseNameToIds.get(lastSegment) ?? [];
		};

		const findNearbyScenes = (startId: string, targetName: string): string[] => {
			const targetKey = SceneRegistry.normalizeBaseName(targetName);
			if (!targetKey) return [];
			const matches = new Set<string>();
			const queue: Array<{ id: string; depth: number }> = [{ id: startId, depth: 0 }];
			const visited = new Set<string>([startId]);
			while (queue.length > 0) {
				const { id, depth } = queue.shift()!;
				const node: SceneGraphEntry | undefined = scenes[id as keyof SceneGraphMap];
				if (!node) continue;
				if (depth > 0) {
					if (SceneRegistry.normalizeBaseName(node.baseName) === targetKey) {
						const fullName = getFullName(id) ?? node.baseName;
						matches.add(fullName);
					}
				}
				if (depth >= PREFETCH_PASSAGE_SCAN_DEPTH) continue;
				const next = neighbors.get(id) ?? [];
				for (const nextId of next) {
					if (!visited.has(nextId)) {
						visited.add(nextId);
						queue.push({ id: nextId, depth: depth + 1 });
					}
				}
			}
			return Array.from(matches);
		};

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

			const passagesRaw = block['passages'];

			// Prefetch nearby based on passages
			if (typeof passagesRaw === 'string' && passagesRaw.trim()) {
				const startIds = findSceneIdsForName(sName);
				if (startIds.length > 0) {
					const targets = SceneRegistry.extractPassageTargets(passagesRaw);
					for (const target of targets) {
						for (const startId of startIds) {
							const nearby = findNearbyScenes(startId, target);
							for (const match of nearby) sceneCandidates.add(match);
						}
					}
				}
			}
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