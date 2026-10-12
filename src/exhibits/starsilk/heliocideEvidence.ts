/**
 * Canon-locked evidence for E08. These are records the visitor can inspect,
 * not invented participant testimony. Historical facts and museum questions
 * are kept separate; no missing dates, voices or causal steps are fabricated.
 */
export interface HeliocideEvidence {
  readonly id: string;
  readonly era: string;
  readonly label: string;
  readonly finding: string;
  readonly question: string;
  /** Reconstruction cue only; never a canonical count of extinguished stars. */
  readonly loss: number;
  readonly shape: 'signal' | 'ring' | 'siege' | 'breach' | 'stars' | 'absence';
}

export const HELIOCIDE_EVIDENCE: readonly HeliocideEvidence[] = [
  {
    id: 'fringe',
    era: 'YEAR 0',
    label: 'First strikes',
    finding: 'Drakken lightning-strike terraformings on fringe colonies trigger Administration counter-Macros.',
    question: 'The first weapon was the ability to decide what a world would become.',
    loss: 0,
    shape: 'signal',
  },
  {
    id: 'rings',
    era: 'YEAR 3',
    label: 'Blood Rings',
    finding: 'The first Blood Rings appear around Fallenstar Prime: red-glass propaganda made visible from a world.',
    question: 'Someone wanted this particular violence to be seen.',
    loss: 0,
    shape: 'ring',
  },
  {
    id: 'pharos',
    era: 'YEAR 121',
    label: 'Ruby Eclipse',
    finding: 'The Administration assaults a Drakken forward node in the Pharos Nebula. The Siege of the Ruby Eclipse follows.',
    question: 'A decisive battle can still fail to end the machinery of a war.',
    loss: 0,
    shape: 'siege',
  },
  {
    id: 'gate',
    era: 'YEAR 170',
    label: 'Aureal Gate',
    finding: 'At the Aureal Gate, the Drakken use Starsilk for the first time. Tiger learns that he can be hurt.',
    question: 'The nature of the threat has changed. The rules of the universe have not.',
    loss: 0,
    shape: 'breach',
  },
  {
    id: 'halven',
    era: 'AFTER THE GATE',
    label: 'Hal\'Ven',
    finding: 'Tiger forces stars in the Hal\'Ven Cluster into sequential collapse. Thousands of stars and trillions of lives are lost.',
    question: 'Containment was purchased with entire suns. The record cannot restore the people beneath them.',
    loss: 0.68,
    shape: 'stars',
  },
  {
    id: 'wall',
    era: 'CONSEQUENCE',
    label: 'Siege Wall',
    finding: 'The Siege Wall contains the Drakken. From an inhabited world it is an absence in the sky, a swath of stars no longer present.',
    question: 'The absence is the evidence. There is nothing there to light, touch or recover.',
    loss: 1,
    shape: 'absence',
  },
];

/** Restrict the reconstruction to supported evidence states and vantages. */
export function clampEvidenceIndex(index: number): number {
  if (!Number.isFinite(index)) return 0;
  return Math.max(0, Math.min(HELIOCIDE_EVIDENCE.length - 1, Math.floor(index)));
}

/**
 * The selected record controls a demonstrative disappearance. Fractions are
 * qualitative aperture reveal, never literal casualty/star-system metrics.
 */
export function evidenceLoss(index: number): number {
  return HELIOCIDE_EVIDENCE[clampEvidenceIndex(index)].loss;
}

export function reconstructedLoss(progress: number): number {
  const t = Math.max(0, Math.min(1, Number.isFinite(progress) ? progress : 0));
  // Facts first; only the final third changes the sky. No premature spectacle.
  if (t < 4 / 6) return 0;
  if (t < 5 / 6) return ((t * 6) - 4) * HELIOCIDE_EVIDENCE[4].loss;
  return HELIOCIDE_EVIDENCE[4].loss
    + ((t * 6) - 5) * (1 - HELIOCIDE_EVIDENCE[4].loss);
}

export function reconstructionRecordIndex(progress: number): number {
  const t = Math.max(0, Math.min(1, Number.isFinite(progress) ? progress : 0));
  return Math.min(HELIOCIDE_EVIDENCE.length - 1, Math.floor(t * HELIOCIDE_EVIDENCE.length));
}
