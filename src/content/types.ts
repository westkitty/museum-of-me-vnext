/** Wing identifiers. The six themed wings of the museum. */
export type WingId = 'north' | 'south' | 'east' | 'west' | 'media' | 'infra';

/** Production tier. Drives budgets, not quality floor. */
export type Tier = 'A' | 'B' | 'C';

/**
 * A project identity in the current collection.
 * All copy is project-first: it describes the work, never praises its author.
 */
export interface ProjectRecord {
  readonly id: string;
  readonly name: string;
  readonly family: string;
  readonly kind: string;
  readonly status: string;
  readonly period: string;
  /** Layer 1 — ten-second understanding. One sentence. */
  readonly summary: string;
  /** Layer 2 — one-minute understanding. One paragraph. */
  readonly brief: string;
  /** Layer 3 — deep dive. Several paragraphs. */
  readonly deep: readonly string[];
  readonly capabilities: readonly string[];
  /** The most interesting development lesson this project produced. */
  readonly lesson: string;
  /** Public repository references, if any. Never a private path. */
  readonly repos: readonly string[];
}

/** Interpretive copy attached to an exhibit rather than to a single project. */
export interface ExhibitCopy {
  readonly subtitle: string;
  /** Physical plaque line — ten-second understanding. */
  readonly plaque: string;
  /** Lectern: the original problem. */
  readonly problem: string;
  /** Lectern: what was made in response. */
  readonly made: string;
  /** What the visitor can do here. */
  readonly interaction: string;
  /** What the visitor can explore spatially. */
  readonly explore: string;
}

/** An entry in the stable 35-slot building, joined with current collection copy and projects. */
export interface ExhibitRecord {
  readonly id: string;
  readonly slug: string;
  readonly title: string;
  readonly wing: WingId;
  readonly tier: Tier;
  readonly projectIds: readonly string[];
  readonly copy: ExhibitCopy;
}

export interface WingRecord {
  readonly id: WingId;
  readonly name: string;
  readonly subtitle: string;
  readonly level: 0 | 1;
  /** One-sentence orientation shown on wing signage and in the map. */
  readonly blurb: string;
}

export interface Collection {
  readonly projects: readonly ProjectRecord[];
  readonly exhibits: readonly ExhibitRecord[];
  readonly wings: readonly WingRecord[];
}
