import { expect } from 'vitest';
import type { Scene, ScenesMap } from '../scenes/scene-manager.js';

export type MessageDef = [string, string] | { character: string; location: string };

export interface CaseSpec {
    name?: string;
    messages: MessageDef[];
    at?: number;
    expectedGraph?: TreeSpec;
    expectedActive?: Array<string | string[]>;
    expectedRoots?: string[];
}

export interface TreeSpec {
    [label: string]: TreeSpec;
}

// --- label parsing helpers (mirror SceneManager normalization) ---
export function normalizeName(segment: string): string {
    const s = segment.trim();
    const stripped = (s.length >= 2 && ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'"))))
        ? s.slice(1, -1)
        : s;
    return stripped.trim();
}

export function extractOwner(segment: string): string | null {
    const match = segment.match(/^\s*([^,;]+?)'s\s+/i);
    return match ? match[1]!.trim() : null;
}

export function ownerlessBase(name: string): string {
    const m = name.match(/^\s*([^,;]+?)'s\s+(.+)$/i);
    const base = m ? m[2] : name;
    return normalizeName(base!);
}

export function parseLabel(label: string): { base: string; owner: string | null } {
    const seg = normalizeName(label);
    return { base: ownerlessBase(seg), owner: extractOwner(seg) };
}

export function effectiveOwner(id: string, scenes: ScenesMap): string | null {
    let cur: string | null = id;
    while (cur) {
        const sc: Scene | undefined = scenes[cur];
        if (!sc) break;
        if (sc.explicitOwner) return sc.explicitOwner;
        cur = sc.parentId;
    }
    return null;
}

export function labelOf(id: string, scenes: ScenesMap): string {
    const s = scenes[id]!;
    const eff = effectiveOwner(id, scenes);
    return eff ? `${eff}'s ${s.baseName}` : s.baseName;
}

export function getRoots(scenes: ScenesMap): string[] {
    return Object.keys(scenes).filter((id) => scenes[id]!.parentId === null);
}

export function childrenOf(parentId: string | null, scenes: ScenesMap): string[] {
    return Object.keys(scenes).filter((id) => scenes[id]!.parentId === parentId);
}

export function findChildrenByLabel(parentId: string | null, label: string, scenes: ScenesMap): string[] {
    const { base, owner } = parseLabel(label);
    const candidates = childrenOf(parentId, scenes).filter((id) => ownerlessBase(scenes[id]!.baseName) === base);
    if (owner == null) return candidates; // wildcard: don't constrain by owner
    return candidates.filter((id) => effectiveOwner(id, scenes) === owner);
}

// Recursively assert graph structure according to TreeSpec
export function assertGraphMatches(spec: TreeSpec, scenes: ScenesMap, parentId: string | null = null): void {
    const graphDump = formatGraph(scenes);
    for (const [label, childSpec] of Object.entries(spec)) {
        const matches = findChildrenByLabel(parentId, label, scenes);
        expect(matches.length, `Expected to find child '${label}' under ${parentId ?? 'ROOT'}\n\nActual Graph:\n${graphDump}`).toBeGreaterThan(0);
        // Recurse into each matched child; if ambiguous, any child satisfying subtree is acceptable
        for (const id of matches) {
            assertGraphMatches(childSpec, scenes, id);
        }
    }
}

export function expectActiveToMatch(activeIds: string[], expected: Array<string | string[]>, scenes: ScenesMap) {
    const graphDump = formatGraph(scenes);
    for (const exp of expected) {
        if (Array.isArray(exp)) {
            // Resolve by path array
            let parent: string | null = null;
            for (const step of exp) {
                const matches = findChildrenByLabel(parent, step, scenes);
                expect(matches.length, `Path step '${step}' should resolve uniquely\n\nActual Graph:\n${graphDump}`).toBe(1);
                parent = matches[0]!;
            }
            expect(activeIds, `Expected active to include path '${exp.join(' > ')}'\n\nActive: ${formatActive(activeIds, scenes)}\n\nActual Graph:\n${graphDump}`).toContain(parent as string);
        } else {
            const str = exp.trim();
            // If the string looks like a path (contains ',' or '>'), treat it as path steps
            if (str.includes(',') || str.includes('>')) {
                const steps = str.split(/[,>]/).map((s) => s.trim()).filter(Boolean);
                let parent: string | null = null;
                for (const step of steps) {
                    const matches = findChildrenByLabel(parent, step, scenes);
                    expect(matches.length, `Path step '${step}' should resolve uniquely\n\nActual Graph:\n${graphDump}`).toBe(1);
                    parent = matches[0]!;
                }
                expect(activeIds, `Expected active to include path '${steps.join(' > ')}'\n\nActive: ${formatActive(activeIds, scenes)}\n\nActual Graph:\n${graphDump}`).toContain(parent as string);
            } else {
                // Single label; no owner => wildcard
                const { base, owner } = parseLabel(str);
                const found = activeIds.some((id) => ownerlessBase(scenes[id]!.baseName) === base && (owner == null || effectiveOwner(id, scenes) === owner));
                expect(found, `Expected active to include '${str}'\n\nActive: ${formatActive(activeIds, scenes)}\n\nActual Graph:\n${graphDump}`).toBe(true);
            }
        }
    }
}

// ----- Pretty printers for diagnostics -----
export function formatGraph(scenes: ScenesMap): string {
    const roots = getRoots(scenes);
    const visited = new Set<string>();
    const lines: string[] = [];
    const byLabel = (a: string, b: string) => labelOf(a, scenes).localeCompare(labelOf(b, scenes));

    function walk(id: string, indent: string) {
        if (visited.has(id)) return; // avoid cycles
        visited.add(id);
        const eff = effectiveOwner(id, scenes);
        const expl = scenes[id]!.explicitOwner ?? null;
        const base = scenes[id]!.baseName;
        const owned = eff ? `${eff}'s ${base}` : base;
        const explNote = expl ? ` (explicit: ${expl})` : '';
        const mobileNote = scenes[id]!.isMobile ? ` (mobile)` : '';
        lines.push(`${indent}- ${owned}${explNote}${mobileNote}`);
        const kids = childrenOf(id, scenes).sort(byLabel);
        for (const child of kids) {
            walk(child, indent + '  ');
        }
    }

    for (const r of roots.sort(byLabel)) {
        walk(r, '');
    }

    // Include orphans (if any) for completeness
    for (const id of Object.keys(scenes)) {
        if (!visited.has(id)) {
            walk(id, '');
        }
    }

    return lines.join('\n');
}

export function formatActive(activeIds: string[], scenes: ScenesMap): string {
    return '[' + activeIds.map((id) => {
        const eff = effectiveOwner(id, scenes);
        const expl = scenes[id]!.explicitOwner ?? null;
        const base = scenes[id]!.baseName;
        const owned = eff ? `${eff}'s ${base}` : base;
        const explNote = expl ? ` (explicit: ${expl})` : '';
        return `'${owned}${explNote}'`;
    }).join(', ') + ']';
}

// Ensure the graph has no cycles using DFS on parent->children edges
export function expectNoCycles(scenes: ScenesMap) {
    const roots = getRoots(scenes);
    const visited = new Set<string>();
    const inStack = new Set<string>();

    const byLabel = (a: string, b: string) => labelOf(a, scenes).localeCompare(labelOf(b, scenes));

    function dfs(id: string): boolean {
        if (inStack.has(id)) return true; // cycle
        if (visited.has(id)) return false;
        visited.add(id);
        inStack.add(id);
        for (const child of childrenOf(id, scenes).sort(byLabel)) {
            if (dfs(child)) return true;
        }
        inStack.delete(id);
        return false;
    }

    // Walk from roots
    for (const r of roots.sort(byLabel)) {
        const cyc = dfs(r);
        expect(cyc, 'Graph contains a cycle').toBe(false);
    }

    // Also check any orphans
    for (const id of Object.keys(scenes)) {
        if (!visited.has(id)) {
            const cyc = dfs(id);
            expect(cyc, 'Graph contains a cycle (in orphan component)').toBe(false);
        }
    }
}

// Resolve a unique node id by a label path (e.g., ["Alex's apartment", "Alex's bedroom"]).
export function resolvePath(path: string[], scenes: ScenesMap): string | null {
    let parent: string | null = null;
    for (let i = 0; i < path.length; i++) {
        const step = path[i]!;
        const matches = findChildrenByLabel(parent, step, scenes);
        if (matches.length !== 1) {
            // Fallback: if this is a single-step path and nothing at ROOT, try a global unique match by label
            if (parent === null && path.length === 1) {
                const { base, owner } = parseLabel(step);
                const anywhere = Object.keys(scenes).filter((id) => ownerlessBase(scenes[id]!.baseName) === base && (owner == null || effectiveOwner(id, scenes) === owner));
                if (anywhere.length === 1) return anywhere[0]!;
            }
            return null;
        }
        parent = matches[0]!;
    }
    return parent;
}

function toPathArray(pathOrLabel: string | string[]): string[] {
    if (Array.isArray(pathOrLabel)) return pathOrLabel;
    const str = pathOrLabel.trim();
    if (str.includes(',') || str.includes('>')) {
        return str.split(/[,>]/).map((s) => s.trim()).filter(Boolean);
    }
    return [str];
}

export function expectOwnership(
    pathOrLabel: string | string[],
    scenes: ScenesMap,
    opts: { explicitOwner?: string | null; effectiveOwner?: string | null }
) {
    const steps = toPathArray(pathOrLabel);
    const id = resolvePath(steps, scenes);
    const graphDump = formatGraph(scenes);
    expect(id, `Path '${steps.join(' > ')}' did not resolve uniquely\n\nActual Graph:\n${graphDump}`).toBeTruthy();
    if (!id) return;

    if (Object.prototype.hasOwnProperty.call(opts, 'explicitOwner')) {
        const exp = (opts.explicitOwner ?? null) ?? null;
        const actual = (scenes[id]!.explicitOwner ?? null);
        expect(actual, `Explicit owner mismatch for '${steps.join(' > ')}'\n\nActual Graph:\n${graphDump}`).toBe(exp);
    }
    if (Object.prototype.hasOwnProperty.call(opts, 'effectiveOwner')) {
        const eff = effectiveOwner(id, scenes);
        const exp = (opts.effectiveOwner ?? null) ?? null;
        expect(eff, `Effective owner mismatch for '${steps.join(' > ')}'\n\nActual Graph:\n${graphDump}`).toBe(exp);
    }
}

export function expectMobility(
    pathOrLabel: string | string[],
    scenes: ScenesMap,
    opts: { isMobile?: boolean }
) {
    const steps = toPathArray(pathOrLabel);
    const id = resolvePath(steps, scenes);
    const graphDump = formatGraph(scenes);

    expect(id, `Path '${steps.join(' > ')}' did not resolve uniquely\n\nActual Graph:\n${graphDump}`).toBeTruthy();
    if (!id) return;

    const actual = scenes[id]!.isMobile ?? false;
    const exp = opts.isMobile ?? false;
    expect(actual, `Mobility mismatch for '${steps.join(' > ')}'\n\nActual Graph:\n${graphDump}`).toBe(exp);
}
