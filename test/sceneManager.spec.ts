import { describe, it } from 'vitest';
import { SceneManager } from '../scenes/scene-manager.js';
import { assertGraphMatches, expectActiveToMatch, expectMobility, expectOwnership, expectNoCycles, type MessageDef } from './dsl.js';

function runCase(messages: MessageDef[]) {
    // normalize messages into getMessageStats
    const normalized = messages.map((m): { character: string; location: string } =>
        Array.isArray(m) ? { character: m[0], location: m[1] } : m
    );

    const getMessageStats = (id: number) => {
        const msg = normalized[id];
        if (!msg) return { Characters: {}, Scenes: {} } as any;
        return { Characters: { [msg.character]: { location: msg.location } }, Scenes: {} } as any;
    };

    const sm = new SceneManager(getMessageStats, {
        isPotentiallyMobile: (base) => base === 'car'
    });
    const last = normalized.length - 1;
    const graph = sm.getSceneGraphForMessage(last);
    const active = sm.getActiveScenes(last);
    return { graph, active };
}

describe('SceneManager DSL cases', () => {
    it('[0] reverse passage enrichment', () => {
        const store: any = {
            Characters: {},
            Scenes: {
                'house, hallway': { passages: 'door (wooden) to living room; door (metal) to basement [locked]' },
                'house, living room': { passages: 'unspecified' },
            }
        };

        const getMessageStats = (id: number) => (id === 0) ? store : ({ Characters: {}, Scenes: {} } as any);

        const sm = new SceneManager(getMessageStats);
        const graph = sm.getSceneGraphForMessage(0);

        assertGraphMatches({ house: { hallway: {}, 'living room': {}, basement: {} } }, graph.scenes, null);

        const scenesStats = store.Scenes as Record<string, any>;
        if (!('house, living room' in scenesStats)) throw new Error('Expected reverse scene for living room');
        if (typeof scenesStats['house, living room']?.passages !== 'string') throw new Error('Expected passages string on house, living room');
        if (!scenesStats['house, living room'].passages.includes('door (wooden) to hallway')) throw new Error('Expected reverse door (wooden) to hallway');
        if (!('house, basement' in scenesStats)) throw new Error('Expected reverse scene for basement');
        if (!scenesStats['house, basement'].passages.includes('door (metal) to hallway [locked]')) throw new Error('Expected reverse door (metal) to hallway [locked]');
    });
    it('[1] apartment, bedroom nesting; active bedroom', () => {
        const messages: MessageDef[] = [
            ['Alex', 'bedroom'],
            ['Alex', "apartment, bedroom"],
        ];

        const { graph, active } = runCase(messages);

        assertGraphMatches({ apartment: { bedroom: {} } }, graph.scenes, null);
        expectActiveToMatch(active, ['bedroom'], graph.scenes);
    });

    it("[2] Alex's apartment, unowned bedroom -> unowned bedroom", () => {
        const messages: MessageDef[] = [
            ['Alex', "Alex's apartment"],
            ['Alex', "Alex's apartment, bedroom"],
        ];

        const { graph, active } = runCase(messages);

        assertGraphMatches({ "Alex's apartment": { "bedroom": {} } }, graph.scenes, null);
        expectActiveToMatch(active, ['Alex\'s apartment, bedroom'], graph.scenes);
        expectOwnership(["Alex's apartment", 'bedroom'], graph.scenes, { explicitOwner: null, effectiveOwner: 'Alex' });
    });

    it("[3] car -> Alex's car -> parking nesting; mobile with override", () => {
        const messages: Array<[string, string]> = [
            ['Alex', 'car'],
            ['Alex', "Alex's car"],
            ['Alex', "school, parking, Alex's car"],
        ];

        const { graph, active } = runCase(messages);

        assertGraphMatches({ school: { parking: { "Alex's car": {} } } }, graph.scenes, null);
        expectActiveToMatch(active, ["school, parking, Alex's car"], graph.scenes);
        expectMobility(["Alex's car"], graph.scenes, { isMobile: true });
    });

    it("[3.5] car -> city, Alex's car -> parking nesting; mobile", () => {
        const messages: Array<[string, string]> = [
            ['Alex', 'car'],
            ['Alex', "city, Alex's car"],
            ['Alex', "parking, Alex's car"],
        ];

        const { graph, active } = runCase(messages);

        assertGraphMatches({ parking: { "Alex's car": {} }, city: {} }, graph.scenes, null);
        expectActiveToMatch(active, ["parking", "Alex's car"], graph.scenes);
        expectMobility(["Alex's car"], graph.scenes, { isMobile: true });
    });

    it("[4] Car moving between locations", () => {
        const messages: Array<[string, string]> = [
            ['Alex', "Alex's house, car"],
            ['Alex', "school, parking, car"],
        ];

        const { graph, active } = runCase(messages);

        assertGraphMatches({ "Alex's house": {}, "school": { "parking": { "car": {} } } }, graph.scenes, null);
        expectActiveToMatch(active, ["school, parking", "car"], graph.scenes);
        expectMobility(["school", "parking", "car"], graph.scenes, { isMobile: true });
    });

    it("[4.1] Car moving between locations", () => {
        const messages: Array<[string, string]> = [
            ['Alex', "restaurant, parking, car"],
            ['Alex', "city, car"],
        ];

        const { graph, active } = runCase(messages);

        assertGraphMatches({ "restaurant": { "parking": {} }, "city": { "car": {} } }, graph.scenes, null);
        expectActiveToMatch(active, ["city", "car"], graph.scenes);
        expectMobility(["city", "car"], graph.scenes, { isMobile: true });
    });

    it("[4.2] Car moving between locations", () => {
        const messages: Array<[string, string]> = [
            ['Alex', "alley, car"],
            ['Alex', "city, car"],
        ];

        const { graph, active } = runCase(messages);

        assertGraphMatches({ "alley": {}, "city": { "car": {} } }, graph.scenes, null);
        expectActiveToMatch(active, ["city", "car"], graph.scenes);
        expectMobility(["city", "car"], graph.scenes, { isMobile: true });
    });


    it("[5] Two different bedrooms in different hierarchies", () => {
        const messages: Array<[string, string]> = [
            ['Alex', "Alex's apartment, bedroom"],
            ['Jordan', "Jordan's apartment, bedroom"],
        ];

        const { graph, active } = runCase(messages);

        assertGraphMatches({ "Alex's apartment": { "bedroom": {} }, "Jordan's apartment": { "bedroom": {} } }, graph.scenes, null);
        expectActiveToMatch(active, [["Alex's apartment", "bedroom"], ["Jordan's apartment", "bedroom"]], graph.scenes);
        expectMobility(["Alex's apartment", "bedroom"], graph.scenes, { isMobile: false });
        expectMobility(["Jordan's apartment", "bedroom"], graph.scenes, { isMobile: false });
    });

    it("[6] Spaceship moving between stations", () => {
        const messages: Array<[string, string]> = [
            ['Alex', "spaceship, engine bay"],
            ['Alex', "ISS, spaceship, bridge"],
            ['Alex', '"Tipiti" station, hangar, spaceship, bridge'],
        ];

        const { graph, active } = runCase(messages);

        assertGraphMatches({ "ISS": {}, '"Tipiti" station': { "hangar": { "spaceship": { "bridge": {}, "engine bay": {} } } } }, graph.scenes, null);
        expectActiveToMatch(active, ['"Tipiti" station, hangar', '"Tipiti" station, hangar, spaceship, bridge'], graph.scenes);
        expectMobility(['"Tipiti" station', "hangar"], graph.scenes, { isMobile: false });
        expectMobility(['"Tipiti" station', "hangar", "spaceship"], graph.scenes, { isMobile: true });
        expectMobility(['"Tipiti" station', "hangar", "spaceship", "bridge"], graph.scenes, { isMobile: false });
    });

    it("[6.1] Spaceship moving between stations, hangar stays in place", () => {
        const messages: Array<[string, string]> = [
            ['Alex', "ISS, hangar, spaceship, bridge"],
            ['Alex', '"Tipiti" station, hangar, spaceship, bridge'],
        ];

        const { graph, active } = runCase(messages);

        assertGraphMatches({ "ISS": { "hangar": {} }, '"Tipiti" station': { "hangar": { "spaceship": { "bridge": {} } } } }, graph.scenes, null);
        expectActiveToMatch(active, ['"Tipiti" station, hangar', '"Tipiti" station, hangar, spaceship, bridge'], graph.scenes);
        expectMobility(['"Tipiti" station', "hangar"], graph.scenes, { isMobile: false });
        expectMobility(['ISS', "hangar"], graph.scenes, { isMobile: false });
        expectMobility(['"Tipiti" station', "hangar", "spaceship"], graph.scenes, { isMobile: true });
        expectMobility(['"Tipiti" station', "hangar", "spaceship", "bridge"], graph.scenes, { isMobile: false });
    });

    it("[6.2] Shuttle inside spaceship moving between hangars", () => {
        const messages: Array<[string, string]> = [
            ['Alex', "space near Earth, shuttle"],
            ['Alex', "ISS, hangar, spaceship, hangar, shuttle"],
            ['Alex', '"Tipiti" station, hangar, spaceship, hangar, shuttle'],
        ];

        const { graph, active } = runCase(messages);

        assertGraphMatches({ "ISS": { "hangar": {} }, '"Tipiti" station': { "hangar": { "spaceship": { "hangar": { "shuttle": {} } } } } }, graph.scenes, null);
        expectActiveToMatch(active, ['"Tipiti" station, hangar', '"Tipiti" station, hangar, spaceship, hangar', 'shuttle'], graph.scenes);
        expectMobility(['"Tipiti" station', "hangar"], graph.scenes, { isMobile: false });
        expectMobility(['"Tipiti" station', "hangar", "spaceship"], graph.scenes, { isMobile: true });
        expectMobility(['"Tipiti" station', "hangar", "spaceship", "hangar"], graph.scenes, { isMobile: false });
        expectMobility(['"Tipiti" station', "hangar", "spaceship", "hangar", "shuttle"], graph.scenes, { isMobile: true });
    });

    it("[6.3] Shuttle inside spaceship moving between hangars, named", () => {
        const messages: Array<[string, string]> = [
            ['Alex', "space near Earth, shuttle"],
            ['Alex', "ISS, hangar, spaceship, hangar, Alex's shuttle"],
            ['Alex', '"Tipiti" station, hangar, spaceship, hangar, Alex\'s shuttle'],
        ];

        const { graph, active } = runCase(messages);

        assertGraphMatches({ "ISS": { "hangar": {} }, '"Tipiti" station': { "hangar": { "spaceship": { "hangar": { "Alex's shuttle": {} } } } } }, graph.scenes, null);
        expectActiveToMatch(active, ['"Tipiti" station, hangar', '"Tipiti" station, hangar, spaceship, hangar', "Alex's shuttle"], graph.scenes);
        expectMobility(['"Tipiti" station', "hangar"], graph.scenes, { isMobile: false });
        expectMobility(['"Tipiti" station', "hangar", "spaceship"], graph.scenes, { isMobile: true });
        expectMobility(['"Tipiti" station', "hangar", "spaceship", "hangar"], graph.scenes, { isMobile: false });
        expectMobility(['"Tipiti" station', "hangar", "spaceship", "hangar", "Alex's shuttle"], graph.scenes, { isMobile: true });
    });

    it("[6.4] Cubicle inside spaceship", () => {
        const messages: Array<[string, string]> = [
            ['Alex', "ISS, hangar, spaceship, cubicle"],
            ['Alex', '"Tipiti" station, hangar, spaceship, cubicle'],
        ];

        const { graph, active } = runCase(messages);

        assertGraphMatches({ "ISS": { "hangar": {} }, '"Tipiti" station': { "hangar": { "spaceship": { "cubicle": {} } } } }, graph.scenes, null);
        expectActiveToMatch(active, ['"Tipiti" station, hangar', '"Tipiti" station, hangar, spaceship, cubicle'], graph.scenes);
        expectMobility(['"Tipiti" station', "hangar"], graph.scenes, { isMobile: false });
        expectMobility(['"Tipiti" station', "hangar", "spaceship"], graph.scenes, { isMobile: true });
        expectMobility(['"Tipiti" station', "hangar", "spaceship", "cubicle"], graph.scenes, { isMobile: false });
    });

    it("[6.5] Cubicle inside spaceship moving between hangars, named", () => {
        const messages: Array<[string, string]> = [
            ['Alex', "ISS, hangar, spaceship, Alex's cubicle"],
            ['Alex', '"Tipiti" station, hangar, spaceship, Alex\'s cubicle'],
        ];

        const { graph, active } = runCase(messages);

        assertGraphMatches({ "ISS": { "hangar": {} }, '"Tipiti" station': { "hangar": { "spaceship": { "Alex's cubicle": {} } } } }, graph.scenes, null);
        expectActiveToMatch(active, [['"Tipiti" station', 'hangar'], ['"Tipiti" station', 'hangar', 'spaceship', "Alex's cubicle"]], graph.scenes);
        expectMobility(['"Tipiti" station', "hangar"], graph.scenes, { isMobile: false });
        expectMobility(['"Tipiti" station', "hangar", "spaceship"], graph.scenes, { isMobile: true });
        expectMobility(['"Tipiti" station', "hangar", "spaceship", "Alex's cubicle"], graph.scenes, { isMobile: false });
    });

    it("[7] Discovering middle hierarchy", () => {
        const messages: Array<[string, string]> = [
            ['Alex', "school, math class"],
            ['Alex', 'school, second floor, math class'],
        ];

        const { graph, active } = runCase(messages);

        assertGraphMatches({ "school": { "second floor": { "math class": {} } } }, graph.scenes, null);
        expectActiveToMatch(active, [['school', "second floor", "math class"]], graph.scenes);
        expectMobility(['school', "second floor", "math class"], graph.scenes, { isMobile: false });
    });

    it('[8] Adoption: unowned room later becomes owned without duplication', () => {
        const messages: Array<[string, string]> = [
            ['Alex', 'apartment, bedroom'],
            ['Alex', "Alex's apartment, bedroom"],
        ];

        const { graph, active } = runCase(messages);

        // Graph should have a single apartment with bedroom, with Alex as effective owner
        assertGraphMatches({ "Alex's apartment": { 'bedroom': {} } }, graph.scenes, null);
        expectActiveToMatch(active, ["Alex's apartment, bedroom"], graph.scenes);
        expectOwnership(['Alex\'s apartment', 'bedroom'], graph.scenes, { effectiveOwner: 'Alex' });
        expectNoCycles(graph.scenes);
    });

    it('[9] Unowned relocation: same base under different parents creates separate non-mobile nodes', () => {
        const messages: Array<[string, string]> = [
            ['Alex', 'house, garage'],
            ['Alex', 'school, garage'],
            ['Alex', 'mall, garage'],
        ];

        const { graph, active } = runCase(messages);

        assertGraphMatches({ 'house': { 'garage': {} }, 'school': { 'garage': {} }, 'mall': { 'garage': {} } }, graph.scenes, null);
        expectActiveToMatch(active, ['mall, garage'], graph.scenes);
        expectMobility(['house', 'garage'], graph.scenes, { isMobile: false });
        expectMobility(['school', 'garage'], graph.scenes, { isMobile: false });
        expectMobility(['mall', 'garage'], graph.scenes, { isMobile: false });
        expectNoCycles(graph.scenes);
    });

    it("[10] Owned-first then unowned path reuses the owned node and sets mobile", () => {
        const messages: Array<[string, string]> = [
            ['Alex', "Alex's car"],
            ['Alex', 'parking, car'],
        ];

        const { graph, active } = runCase(messages);

        assertGraphMatches({ 'parking': { "Alex's car": {} } }, graph.scenes, null);
        expectActiveToMatch(active, ["parking", "Alex's car"], graph.scenes);
        expectMobility(['parking', "Alex's car"], graph.scenes, { isMobile: true });
        expectNoCycles(graph.scenes);
    });

    it("[11] Basic character movement", () => {
        const messages: Array<[string, string]> = [
            ['Alex', "apartment, Alex's bedroom"],
            ['Alex', "apartment, living room"],
        ];

        const { graph, active } = runCase(messages);

        assertGraphMatches({ "apartment": { "Alex's bedroom": {}, "living room": {} } }, graph.scenes, null);
        expectActiveToMatch(active, ["apartment, living room"], graph.scenes);
        expectMobility(["apartment", "Alex's bedroom"], graph.scenes, { isMobile: false });
        expectMobility(["apartment", "living room"], graph.scenes, { isMobile: false });
    });

    it("[11.5] Basic character movement", () => {
        const messages: Array<[string, string]> = [
            ['Alex', "apartment, living room"],
            ['Alex', "apartment, Alex's bedroom"],
        ];

        const { graph, active } = runCase(messages);

        assertGraphMatches({ "apartment": { "Alex's bedroom": {}, "living room": {} } }, graph.scenes, null);
        expectActiveToMatch(active, ["apartment, Alex's bedroom"], graph.scenes);
        expectMobility(["apartment", "Alex's bedroom"], graph.scenes, { isMobile: false });
        expectMobility(["apartment", "living room"], graph.scenes, { isMobile: false });
    });

    it("[12] Multi-part inference", () => {
        const messages: Array<[string, string]> = [
            ['Alex', "bedroom"],
            ['Alex', "city, Alex's apartment, living room"],
            ['Alex', "city, Alex's apartment, Alex's bedroom"],
        ];

        const { graph, active } = runCase(messages);

        assertGraphMatches({ "city": { "Alex's apartment": { "living room": {}, "Alex's bedroom": {} } } }, graph.scenes, null);
        expectActiveToMatch(active, ["city, Alex's apartment, Alex's bedroom"], graph.scenes);
        expectMobility(["city", "Alex's apartment"], graph.scenes, { isMobile: false });
        expectMobility(["city", "Alex's apartment", "living room"], graph.scenes, { isMobile: false });
        expectMobility(["city", "Alex's apartment", "Alex's bedroom"], graph.scenes, { isMobile: false });
    });
});
