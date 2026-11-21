export type StanceSquareId = 'center_exposed' | 'west_cover' | 'east_ridge';

export type TacticalAction = 'strike' | 'guard';

export type EncounterOutcome = 'IN_PROGRESS' | 'VICTORY' | 'DEFEAT';

export interface SquareSpec {
  readonly id: StanceSquareId;
  readonly label: string;
  readonly x: number;
  readonly z: number;
  readonly coverAC: number;
  readonly attackBonus: number;
  readonly sightlineBlocked: boolean;
}

export interface TacticalState {
  readonly turn: 0 | 1 | 2 | 3;
  readonly square: StanceSquareId;
  readonly action: TacticalAction;
  readonly playerHp: number;
  readonly enemyHp: number;
  readonly outcome: EncounterOutcome;
  readonly lastLog: string;
}

export const TACTICAL_SQUARES: readonly SquareSpec[] = [
  {
    id: 'center_exposed',
    label: 'Center Open (Exposed)',
    x: 0.0,
    z: -4.45,
    coverAC: 0,
    attackBonus: 0,
    sightlineBlocked: false,
  },
  {
    id: 'west_cover',
    label: 'West Cover Pillar (-1 Sq)',
    x: -0.9,
    z: -4.45,
    coverAC: 5,
    attackBonus: 1,
    sightlineBlocked: true,
  },
  {
    id: 'east_ridge',
    label: 'East High Ridge (+1 Sq)',
    x: 0.9,
    z: -4.95,
    coverAC: 2,
    attackBonus: 3,
    sightlineBlocked: false,
  },
] as const;

export const INITIATIVE_ORDER = 'Vanguard (18) -> Marksman (15) -> Ranger (12) -> Ironclad (9)';

export function squareSpecFor(id: StanceSquareId): SquareSpec {
  return TACTICAL_SQUARES.find((s) => s.id === id) ?? TACTICAL_SQUARES[0];
}

export function createInitialTacticalState(): TacticalState {
  return {
    turn: 0,
    square: 'center_exposed',
    action: 'strike',
    playerHp: 22,
    enemyHp: 22,
    outcome: 'IN_PROGRESS',
    lastLog: `Initiative ready: ${INITIATIVE_ORDER}. Select opening square before Turn 1.`,
  };
}

export function cycleStanceSquare(state: TacticalState): TacticalState {
  const idx = TACTICAL_SQUARES.findIndex((s) => s.id === state.square);
  const next = TACTICAL_SQUARES[(idx + 1) % TACTICAL_SQUARES.length];
  return {
    ...state,
    square: next.id,
    lastLog: next.sightlineBlocked
      ? `Moved 1 square to ${next.label}: Stone Pillar blocks Marksman sightline (+5 Cover AC).`
      : `Moved to ${next.label}: Sightline open (Cover +${next.coverAC} AC, Atk +${next.attackBonus}).`,
  };
}

export function toggleCombatAction(state: TacticalState): TacticalState {
  const next: TacticalAction = state.action === 'strike' ? 'guard' : 'strike';
  return {
    ...state,
    action: next,
    lastLog:
      next === 'guard'
        ? 'Action set to GUARD & BRACE (-4 incoming damage, counter-riposte only).'
        : 'Action set to STRIKE & PRESS (full offensive output).',
  };
}

export function resolveCombatTurn(state: TacticalState): TacticalState {
  if (state.outcome !== 'IN_PROGRESS') return state;

  const spec = squareSpecFor(state.square);
  const nextTurn = (state.turn + 1) as 1 | 2 | 3;

  // Deterministic tactical damage math so 1-square cover cleanly flips Turn 3 result:
  // Center Exposed + Strike -> Player deals 6/turn, Enemy deals 8/turn -> Turn 3: Player 0 HP, Enemy 4 HP (DEFEAT)
  // West Cover (-1 Sq) + Strike -> Player deals 7/turn, Enemy deals 3/turn -> Turn 3: Player 13 HP, Enemy 1/0 HP (VICTORY)
  const playerDmg = (state.action === 'strike' ? 6 : 3) + spec.attackBonus + (nextTurn === 3 && state.square === 'west_cover' ? 2 : 0);
  const rawIncoming = spec.sightlineBlocked ? 3 : 8 - Math.floor(spec.coverAC * 0.5);
  const incoming = Math.max(1, rawIncoming - (state.action === 'guard' ? 4 : 0));

  // Initiative: Vanguard + Ranger act around Marksman
  const enemyHp = Math.max(0, state.enemyHp - playerDmg);
  const playerHp = enemyHp === 0 ? state.playerHp : Math.max(0, state.playerHp - incoming);

  let outcome: EncounterOutcome = 'IN_PROGRESS';
  if (enemyHp === 0) outcome = 'VICTORY';
  else if (playerHp === 0) outcome = 'DEFEAT';
  else if (nextTurn === 3) {
    outcome = playerHp > enemyHp ? 'VICTORY' : 'DEFEAT';
  }

  return {
    ...state,
    turn: nextTurn,
    playerHp,
    enemyHp,
    outcome,
    lastLog:
      outcome === 'VICTORY'
        ? `Turn ${nextTurn}: VICTORY (${spec.label}) — Squad ${playerHp} HP vs Hostiles ${enemyHp} HP.`
        : outcome === 'DEFEAT'
          ? `Turn ${nextTurn}: DEFEAT (${spec.label}) — Exposed sightline felled Vanguard (${playerHp} vs ${enemyHp} HP).`
          : `Turn ${nextTurn}: Dealt ${playerDmg}, took ${incoming} (Cover ${spec.sightlineBlocked ? 'BLOCKED' : 'OPEN'}). HP ${playerHp}/${enemyHp}.`,
  };
}

export function simulateFullEncounter(square: StanceSquareId, action: TacticalAction = 'strike'): TacticalState {
  let s: TacticalState = { ...createInitialTacticalState(), square, action };
  s = resolveCombatTurn(s);
  s = resolveCombatTurn(s);
  s = resolveCombatTurn(s);
  return s;
}
