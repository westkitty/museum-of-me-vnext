import type { Vec3, ZoneId } from '../world/layout';

/**
 * Hidden things to find. These reward wandering; nothing else in the museum
 * depends on them, and no exhibit is scored.
 *
 * Three kinds of trigger:
 * - `zone`: reaching a part of the building (interior only).
 * - `area`: standing somewhere particular outside.
 * - `object`: noticing a small object and interacting with it.
 *
 * `quiet` secrets are noted without a chime, for places that should stay calm.
 * Edit titles and lines freely; ids are what the visitor's saved finds refer
 * to, so keep an id once it has shipped.
 */
export type SecretTrigger =
  | { readonly kind: 'zone'; readonly zone: ZoneId }
  | { readonly kind: 'area'; readonly center: Vec3; readonly radius: number }
  | {
      readonly kind: 'object';
      readonly position: Vec3;
      readonly model: SecretModel;
      /** Shown in the interaction cue, e.g. "Look closer". */
      readonly prompt: string;
    };

export type SecretModel = 'carved-stone' | 'small-lantern' | 'folded-star';

export interface SecretDefinition {
  readonly id: string;
  readonly world: 'exterior' | 'interior';
  readonly title: string;
  /** One short line shown when it is found. */
  readonly line: string;
  readonly trigger: SecretTrigger;
  readonly quiet?: boolean;
}

export const SECRETS: readonly SecretDefinition[] = [
  {
    id: 'dexter-sanctuary',
    world: 'interior',
    title: "Dexter's Sanctuary",
    line: 'A quiet room below the Rotunda. Stay as long as you like.',
    trigger: { kind: 'zone', zone: 'sanctuary' },
    quiet: true,
  },
  {
    id: 'rotunda-balcony',
    world: 'interior',
    title: 'Above the Rotunda',
    line: 'The whole collection, seen from up here.',
    trigger: { kind: 'zone', zone: 'balcony' },
  },
  {
    id: 'end-of-the-pier',
    world: 'exterior',
    title: 'The end of the pier',
    line: 'Turn around. That is the whole museum.',
    trigger: { kind: 'area', center: [0, -0.5, 215], radius: 4 },
  },
  {
    id: 'stone-circle',
    world: 'exterior',
    title: 'Inside the stone circle',
    line: 'Older than everything else on the island. Probably.',
    trigger: { kind: 'area', center: [-72, -0.5, -118], radius: 5 },
  },
  {
    id: 'wildlife-hide',
    world: 'exterior',
    title: 'The wildlife hide',
    line: 'Sit still long enough and something always moves.',
    trigger: { kind: 'area', center: [55, -0.5, -14], radius: 2.6 },
  },
  {
    id: 'fern-ravine',
    world: 'exterior',
    title: 'The fern ravine',
    line: 'Cool, green, and a little out of the way.',
    trigger: { kind: 'area', center: [-126, -0.5, -2], radius: 6 },
  },
  {
    id: 'spire-garden',
    world: 'exterior',
    title: 'The spire garden',
    line: 'As far from the front door as the island goes.',
    trigger: { kind: 'area', center: [-104, -0.5, -82], radius: 8 },
  },
  {
    id: 'tree-roots',
    world: 'exterior',
    title: 'Something in the roots',
    line: 'A carved stone, tucked where only a wanderer would look.',
    trigger: { kind: 'object', position: [41.2, -0.48, -85.6], model: 'carved-stone', prompt: 'Look closer' },
  },
  {
    id: 'garden-wall-lantern',
    world: 'exterior',
    title: 'A lantern on the back wall',
    line: 'Behind the museum, someone left a light on.',
    trigger: { kind: 'object', position: [6.5, 0.48, -120], model: 'small-lantern', prompt: 'Look closer' },
  },
  {
    id: 'sundial-star',
    world: 'exterior',
    title: 'A folded star',
    line: 'Silver thread, folded into a star and left by the sundial.',
    trigger: { kind: 'object', position: [-31.6, -0.39, 135.6], model: 'folded-star', prompt: 'Pick it up' },
  },
];

export const SECRETS_BY_ID: ReadonlyMap<string, SecretDefinition> = new Map(SECRETS.map((secret) => [secret.id, secret]));
