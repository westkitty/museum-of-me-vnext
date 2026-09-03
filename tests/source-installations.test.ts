import { describe, expect, it } from 'vitest';
import {
  INSTALLATION_IDS, INSTALLATION_THESES, INSTALLATION_CONSTANTS, SPATIAL_CONTRACT,
  SOURCE_POSITIONS, applyInstallationKey, defaultStateFor, describeInstallationState,
  sanitizeInstallationState, tickInstallationState,
} from '../src/content/installationState';
import { INSTALLATION_PLACEMENTS, INSTALLATION_PLACEMENT_BY_ID } from '../src/world/installationPlacement';
import { SOURCE_INSTALLATIONS } from '../src/content/sourceParity';
import { PLACEMENT_BY_EXHIBIT, SANCTUARY_CENTER, SANCTUARY_RADIUS } from '../src/world/layout';
import { InstallationStore } from '../src/state/InstallationStore';

function memoryStorage(): Storage {
  const map = new Map<string, string>();
  return {
    get length() { return map.size; },
    clear: () => map.clear(),
    getItem: (k) => map.get(k) ?? null,
    key: (i) => [...map.keys()][i] ?? null,
    removeItem: (k) => void map.delete(k),
    setItem: (k, v) => void map.set(k, v),
  } as Storage;
}

describe('source installation contract', () => {
  it('carries all fourteen source identities with their source control tables', () => {
    expect(INSTALLATION_IDS).toHaveLength(14);
    expect(INSTALLATION_IDS).toEqual(SOURCE_INSTALLATIONS.map((i) => i.id));
    for (const spec of SOURCE_INSTALLATIONS) {
      const controls = spec.controls ?? [];
      expect(controls.length, spec.id).toBeGreaterThan(0);
      // CURATED QA rule `control-density`: the two-column control grid holds 8.
      expect(controls.length, spec.id).toBeLessThanOrEqual(SPATIAL_CONTRACT.maxControlsPerInstallation);
      for (const [label, code] of controls) {
        expect(String(label).length, spec.id).toBeGreaterThan(0);
        expect(String(code), spec.id).toMatch(/^(Key[A-Z]|Digit[1-9]|Arrow(Left|Right|Up|Down)|Space)$/);
      }
    }
  });

  it('gives every installation a thesis with a silhouette and five required parts', () => {
    for (const id of INSTALLATION_IDS) {
      const thesis = INSTALLATION_THESES[id];
      expect(thesis, id).toBeTruthy();
      expect(thesis.silhouette, id).toBeTruthy();
      expect(thesis.required.length, id).toBeGreaterThan(0);
    }
  });

  it('drives every source control code to an observable state change', () => {
    // Two source installations gate controls behind a precondition, and that
    // gating is itself the contract: `parable` must be re-armed between
    // miracles, and `heliocide` will not hold or authorise before the command
    // sequence has reached phase 3. Each control is therefore exercised from a
    // state where the source says it is legal.
    const PRELUDE: Record<string, Record<string, string[]>> = {
      parable: { KeyF: ['KeyC'], KeyN: ['KeyC'] },
      heliocide: {
        Space: ['KeyB'],
        KeyH: ['KeyB', 'Space', 'Space'],
        KeyA: ['KeyB', 'Space', 'Space'],
      },
    };
    for (const spec of SOURCE_INSTALLATIONS) {
      const codes = (spec.controls ?? []).map((c) => String(c[1]));
      for (const [label, code] of spec.controls ?? []) {
        let state = defaultStateFor(spec.id);
        // Selector controls (mode/overlay/strain/seed/query pickers) are
        // idempotent by design: choosing what is already chosen moves nothing.
        // Approach each one from a sibling selection so the test proves the
        // control actually selects rather than merely reporting a change.
        const sibling = /^Digit[1-9]$/.test(String(code))
          ? codes.find((c) => /^Digit[1-9]$/.test(c) && c !== String(code))
          : String(code) === 'KeyH' && spec.id === 'dexdictate' ? 'KeyT'
          : String(code) === 'KeyT' && spec.id === 'dexdictate' ? 'KeyH'
          // A decrement at the bottom of its clamp cannot move. Step up first,
          // so "earlier" is proved to actually step back.
          : String(code) === 'ArrowLeft' && codes.includes('ArrowRight') ? 'ArrowRight'
          : undefined;
        if (sibling) state = applyInstallationKey(spec.id, state, sibling).state;
        // A reset control can only be shown to work from a state that has
        // something to undo, so drive the installation first.
        const resetCode = spec.id === 'parable' ? 'KeyX' : 'KeyR';
        if (String(code) === resetCode) {
          const pristine = JSON.stringify(defaultStateFor(spec.id));
          for (const other of codes) {
            if (other === resetCode) continue;
            // The katamari's WASD controls are velocity impulses that cancel
            // one another, so stop as soon as the installation has genuinely
            // moved rather than driving every control blindly.
            if (JSON.stringify(state) !== pristine) break;
            for (const step of PRELUDE[spec.id]?.[other] ?? []) {
              state = applyInstallationKey(spec.id, state, step).state;
            }
            state = applyInstallationKey(spec.id, state, other).state;
          }
          expect(JSON.stringify(state), `${spec.id} could not be moved off its default`)
            .not.toBe(JSON.stringify(defaultStateFor(spec.id)));
        }
        for (const step of PRELUDE[spec.id]?.[String(code)] ?? []) {
          state = applyInstallationKey(spec.id, state, step).state;
        }
        const before = JSON.stringify(state);
        const beforeLine = describeInstallationState(spec.id, state);
        const result = applyInstallationKey(spec.id, state, String(code));
        expect(result.changed, `${spec.id} / ${String(label)} (${String(code)})`).toBe(true);
        // A control that reports "changed" while changing neither the state nor
        // the interpretive line is exactly the silent failure the source QA
        // forbade.
        const after = JSON.stringify(result.state);
        const afterLine = describeInstallationState(spec.id, result.state);
        expect(
          after !== before || afterLine !== beforeLine,
          `${spec.id} / ${String(label)} reported a change but nothing moved`,
        ).toBe(true);
      }
    }
  });

  it('refuses gated controls until the source precondition is met', () => {
    // The gates themselves must fail closed, not merely exist.
    expect(applyInstallationKey('parable', defaultStateFor('parable'), 'KeyN').changed).toBe(false);
    expect(applyInstallationKey('heliocide', defaultStateFor('heliocide'), 'KeyH').changed).toBe(false);
    expect(applyInstallationKey('heliocide', defaultStateFor('heliocide'), 'KeyA').changed).toBe(false);
    // ...and a second KeyB does nothing once the sequence has begun.
    const begun = applyInstallationKey('heliocide', defaultStateFor('heliocide'), 'KeyB').state;
    expect(applyInstallationKey('heliocide', begun, 'KeyB').changed).toBe(false);
  });

  it('reproduces the source state machines exactly', () => {
    // starsilk-atlas: era clamps 0..4 from a default of 2; overlays are 0..3.
    let atlas = defaultStateFor('starsilk-atlas');
    expect(atlas.era).toBe(2);
    for (let i = 0; i < 9; i++) atlas = applyInstallationKey('starsilk-atlas', atlas, 'ArrowRight').state;
    expect(atlas.era).toBe(4);
    for (let i = 0; i < 9; i++) atlas = applyInstallationKey('starsilk-atlas', atlas, 'ArrowLeft').state;
    expect(atlas.era).toBe(0);
    expect(applyInstallationKey('starsilk-atlas', atlas, 'Digit4').state.overlay).toBe(3);

    // heliocide: the command sequence is ordered and its log is append-only.
    let h = defaultStateFor('heliocide');
    expect(applyInstallationKey('heliocide', h, 'Space').changed).toBe(false);
    h = applyInstallationKey('heliocide', h, 'KeyB').state;
    h = applyInstallationKey('heliocide', h, 'Space').state;
    h = applyInstallationKey('heliocide', h, 'Space').state;
    expect(h.phase).toBe(3);
    const held = applyInstallationKey('heliocide', h, 'KeyH').state;
    expect(held.holding).toBe(true);
    expect(held.authorized).toBe(false);
    const authorized = applyInstallationKey('heliocide', held, 'KeyA').state;
    expect(authorized.authorized).toBe(true);
    expect(authorized.holding).toBe(false);
    expect(authorized.log).toEqual(['BEGIN', 'STATUS', 'MODEL', 'HOLD', 'AUTHORIZE']);

    // parable: KeyR is NOT the reset here; the ritual must be armed to cast.
    let p = defaultStateFor('parable');
    expect(applyInstallationKey('parable', p, 'KeyF').changed).toBe(false);
    p = applyInstallationKey('parable', p, 'KeyC').state;
    p = applyInstallationKey('parable', p, 'KeyF').state;
    expect(p.miracle).toBe('Fireball');
    expect(p.casts).toBe(1);
    expect(p.armed).toBe(false);
    expect(applyInstallationKey('parable', p, 'KeyX').state.casts).toBe(0);

    // tablet-link wraps through five phases including broken/recovery.
    let l = defaultStateFor('tablet-link');
    const phases: number[] = [];
    for (let i = 0; i < 6; i++) { l = applyInstallationKey('tablet-link', l, 'Space').state; phases.push(Number(l.phase)); }
    expect(phases).toEqual([1, 2, 3, 4, 0, 1]);

    // osint-box step is bounded by the chosen seed's actual route length.
    let o = applyInstallationKey('osint-box', defaultStateFor('osint-box'), 'Digit1').state;
    for (let i = 0; i < 8; i++) o = applyInstallationKey('osint-box', o, 'Space').state;
    expect(o.step).toBe(INSTALLATION_CONSTANTS.osintRoutes[0].length);
  });

  it('advances the two time-driven installations without input', () => {
    // dexdictate runs capture -> local inference -> inserted -> idle.
    let d = applyInstallationKey('dexdictate', defaultStateFor('dexdictate'), 'Space').state;
    expect(d.phase).toBe(1);
    const seen = new Set<number>([1]);
    for (let i = 0; i < 200; i++) {
      d = tickInstallationState('dexdictate', d, 0.05, new Set()).state;
      seen.add(Number(d.phase));
    }
    expect([...seen].sort()).toEqual([0, 1, 2, 3]);
    expect(Number(d.history)).toBeGreaterThan(0);

    // smores-katamari rolls under held keys and collects on contact.
    let k = defaultStateFor('smores-katamari');
    const held = new Set(['KeyW']);
    for (let i = 0; i < 400; i++) k = tickInstallationState('smores-katamari', k, 1 / 60, held).state;
    expect(Math.abs(Number(k.z))).toBeGreaterThan(0.2);
    expect((k.collected as number[]).length).toBeGreaterThan(0);
    expect(Number(k.size)).toBeGreaterThan(0.34);
  });

  it('resets every installation to its source default', () => {
    for (const id of INSTALLATION_IDS) {
      let state = defaultStateFor(id);
      for (const [, code] of SOURCE_INSTALLATIONS.find((i) => i.id === id)?.controls ?? []) {
        state = applyInstallationKey(id, state, String(code)).state;
      }
      const resetCode = id === 'parable' ? 'KeyX' : 'KeyR';
      const after = applyInstallationKey(id, state, resetCode).state;
      expect(JSON.stringify(after), id).toBe(JSON.stringify(defaultStateFor(id)));
    }
  });

  it('clamps hostile persisted state back into the source range', () => {
    const wild = sanitizeInstallationState('starsilk-atlas', { era: 900, overlay: -12 });
    expect(wild.era).toBe(4);
    expect(wild.overlay).toBe(0);
    const katamari = sanitizeInstallationState('smores-katamari', {
      x: 99, z: -99, size: 40, collected: [1, 1, 2, 999, 'x'],
    });
    expect(katamari.x).toBe(1.85);
    expect(katamari.z).toBe(-1.65);
    expect(katamari.size).toBe(0.78);
    expect(katamari.collected).toEqual([1, 2]);
    const heliocide = sanitizeInstallationState('heliocide', { log: ['NONSENSE', 'BEGIN'], phase: 77 });
    expect(heliocide.log).toEqual(['BEGIN']);
    expect(heliocide.phase).toBe(5);
  });
});

describe('installation persistence', () => {
  it('round-trips state and examined marks through storage', () => {
    const storage = memoryStorage();
    const a = new InstallationStore(storage);
    a.set('starsilk-atlas', applyInstallationKey('starsilk-atlas', a.get('starsilk-atlas'), 'ArrowRight').state);
    a.markExamined('starsilk-atlas');
    const b = new InstallationStore(storage);
    expect(b.get('starsilk-atlas').era).toBe(3);
    expect(b.hasExamined('starsilk-atlas')).toBe(true);
    expect(b.recoveryNotice).toBeNull();
  });

  it('quarantines corrupt installation JSON instead of discarding it', () => {
    const storage = memoryStorage();
    storage.setItem('museum-of-me:installations', '{not json');
    const store = new InstallationStore(storage);
    expect(store.recoveryNotice).toMatch(/quarantine/i);
    expect(storage.getItem('museum-of-me:installations:quarantine')).toBeTruthy();
    expect(store.get('starsilk-atlas').era).toBe(2);
  });

  it('rejects and quarantines a future format', () => {
    const storage = memoryStorage();
    storage.setItem('museum-of-me:installations', JSON.stringify({ version: 99, states: {}, examined: [] }));
    const store = new InstallationStore(storage);
    expect(store.recoveryNotice).toMatch(/newer/i);
    expect(storage.getItem('museum-of-me:installations:quarantine')).toBeTruthy();
  });

  it('sanitizes a tampered persisted payload on load', () => {
    const storage = memoryStorage();
    storage.setItem('museum-of-me:installations', JSON.stringify({
      version: 1, states: { 'orbital-tomb': { month: 5000 } }, examined: ['not-an-installation'],
    }));
    const store = new InstallationStore(storage);
    expect(store.get('orbital-tomb').month).toBe(6);
    expect(store.examinedIds()).toEqual([]);
  });
});

describe('installation spatial contract', () => {
  it('places all fourteen inside the vNext building without touching a bay hero', () => {
    expect(INSTALLATION_PLACEMENTS).toHaveLength(14);
    for (const p of INSTALLATION_PLACEMENTS) {
      if (p.host === 'sanctuary') {
        const d = Math.hypot(p.position[0] - SANCTUARY_CENTER[0], p.position[2] - SANCTUARY_CENTER[2]);
        expect(d + Math.max(...p.footprint), p.id).toBeLessThan(SANCTUARY_RADIUS - 1);
        // Clear of Dexter, who stands at the sanctuary centre.
        expect(d, p.id).toBeGreaterThan(4);
        continue;
      }
      const bay = PLACEMENT_BY_EXHIBIT.get(p.host);
      expect(bay, `${p.id} -> ${p.host}`).toBeTruthy();
      const heroDistance = Math.hypot(p.position[0] - bay!.anchor[0], p.position[2] - bay!.anchor[2]);
      expect(heroDistance, p.id).toBeGreaterThan(4);
      const marginX = bay!.bounds.h[0] - Math.abs(p.position[0] - bay!.bounds.c[0]) - p.footprint[0];
      const marginZ = bay!.bounds.h[2] - Math.abs(p.position[2] - bay!.bounds.c[2]) - p.footprint[1];
      expect(marginX, `${p.id} X margin`).toBeGreaterThan(0.3);
      expect(marginZ, `${p.id} Z margin`).toBeGreaterThan(0.3);
      // The visitor's standing point must be inside the same bay.
      expect(Math.abs(p.interactionPoint[0] - bay!.bounds.c[0]), p.id).toBeLessThanOrEqual(bay!.bounds.h[0]);
      expect(Math.abs(p.interactionPoint[2] - bay!.bounds.c[2]), p.id).toBeLessThanOrEqual(bay!.bounds.h[2]);
      expect(p.position[1], `${p.id} floor`).toBe(bay!.anchor[1]);
    }
  });

  it('keeps two installations sharing one bay clear of each other', () => {
    for (let i = 0; i < INSTALLATION_PLACEMENTS.length; i++) {
      for (let j = i + 1; j < INSTALLATION_PLACEMENTS.length; j++) {
        const a = INSTALLATION_PLACEMENTS[i];
        const b = INSTALLATION_PLACEMENTS[j];
        if (Math.abs(a.position[1] - b.position[1]) > 3) continue;
        const d = Math.hypot(a.position[0] - b.position[0], a.position[2] - b.position[2]);
        expect(d, `${a.id} vs ${b.id}`).toBeGreaterThan(5.5);
      }
    }
  });

  it('carries the source reading zone, interaction radius and camera safe distance', () => {
    for (const p of INSTALLATION_PLACEMENTS) {
      const expected = p.host === 'sanctuary' ? SPATIAL_CONTRACT.sanctuary : SPATIAL_CONTRACT.standard;
      expect(p.readingZoneRadius, p.id).toBe(expected.readingZoneRadius);
      expect(p.interactionRadius, p.id).toBe(expected.interactionRadius);
      expect(p.cameraSafeDistance, p.id).toBe(expected.cameraSafeDistance);
      // The lectern stands between the visitor's reading point and the object.
      const lecternToObject = Math.hypot(p.position[0] - p.lectern[0], p.position[2] - p.lectern[2]);
      const readToLectern = Math.hypot(p.interactionPoint[0] - p.lectern[0], p.interactionPoint[2] - p.lectern[2]);
      expect(lecternToObject, p.id).toBeGreaterThan(readToLectern);
      // The reading point must be within the museum's interaction reach of it.
      expect(readToLectern, p.id).toBeLessThan(4.2);
    }
  });

  it('preserves the source room grouping wherever the frozen mapping allows', () => {
    // Both source authorities put these rooms' members together, and the frozen
    // 64->35 mapping keeps that true for four of the five rooms.
    const byRoom = new Map<string, string[]>();
    for (const p of INSTALLATION_PLACEMENTS) {
      const list = byRoom.get(p.sourceWing) ?? [];
      const bay = PLACEMENT_BY_EXHIBIT.get(p.host);
      list.push(bay ? bay.wing : 'sanctuary');
      byRoom.set(p.sourceWing, list);
    }
    const grouped = [...byRoom.entries()].filter(([, wings]) => new Set(wings).size === 1);
    expect(grouped.map(([room]) => room).sort()).toEqual([
      'Central Canon Observatory',
      'East Local Systems Lab',
      'Rear Sanctuary',
      'West Gameworks',
    ]);
    // The fifth is split by later human authority, not by accident. Documented
    // in Reliquary_Installation_Spatial_Matrix.md.
    expect(new Set(byRoom.get('West Systems Workshop')).size).toBe(3);
  });

  it('records that the two source authorities disagree on every old coordinate', () => {
    // This is the evidence that exact old-hall coordinates cannot be the
    // governing contract: the sources themselves never shared them.
    let differing = 0;
    for (const id of INSTALLATION_IDS) {
      const a = SOURCE_POSITIONS.curated[id];
      const b = SOURCE_POSITIONS.versionB[id];
      expect(a, id).toBeTruthy();
      expect(b, id).toBeTruthy();
      if (JSON.stringify(a) !== JSON.stringify(b)) differing += 1;
    }
    expect(differing).toBe(14);
  });

  it('keeps the sanctuary installation rearmost, behind the rest of the museum', () => {
    const sanctuary = INSTALLATION_PLACEMENT_BY_ID.get('dexgpt')!;
    expect(sanctuary.host).toBe('sanctuary');
    // Below the museum floor and outside the rotunda: reached, not adjacent.
    expect(sanctuary.position[1]).toBeLessThan(0);
    expect(Math.hypot(sanctuary.position[0], sanctuary.position[2])).toBeGreaterThan(40);
  });
});
