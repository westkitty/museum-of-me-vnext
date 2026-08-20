import { registerExhibit, registeredExhibitIds } from './registry';
import { ProvisionalExhibit } from './ProvisionalExhibit';
import { StarsilkUniverse } from './starsilk/StarsilkUniverse';
import { DrakkenCompendium } from './starsilk/DrakkenCompendium';
import { OrbitalTomb } from './starsilk/OrbitalTomb';
import { PossibilityCartographer } from './starsilk/PossibilityCartographer';
import { StarsilkMaker } from './starsilk/StarsilkMaker';
import { FieldAnatomy } from './starsilk/FieldAnatomy';
import { TerraformingLaboratory } from './starsilk/TerraformingLaboratory';
import { HeliocideObservatory } from './starsilk/HeliocideObservatory';
import { WorldsVaultLineage } from './archive/WorldsVaultLineage';
import { DexTilt } from './dex/DexTilt';
import { VoiceLab } from './dex/VoiceLab';
import { CompanionSystems } from './dex/CompanionSystems';
import { UtilityBench } from './dex/UtilityBench';
import { CivicSupport } from './dex/CivicSupport';
import { CreativeTools } from './dex/CreativeTools';
import { SensemakingLab } from './dex/SensemakingLab';
import { DnDexTable } from './games/DnDexTable';
import { InvincibleMagic } from './games/InvincibleMagic';
import { WestCatSystems } from './games/WestCatSystems';
import { FullWeasel } from './games/FullWeasel';
import { AgainstTheVoid } from './games/AgainstTheVoid';
import { ArkshipCivilization } from './games/ArkshipCivilization';
import { AetherVFX } from './games/AetherVFX';
import { StoryWorlds } from './games/StoryWorlds';
import { SmoresKatamari } from './games/SmoresKatamari';
import { EndlessGrok } from './games/EndlessGrok';
import { SunoStudio } from './media/SunoStudio';
import { COLLECTION } from '../content/collection.generated';
import type { ExhibitDefinition } from './contract';
import type { ExhibitModule } from './contract';

/**
 * The exhibit registry.
 *
 * Bespoke modules are registered here as each wing is built. Everything not yet
 * bespoke falls back to ProvisionalExhibit so the whole museum stays walkable
 * and testable while it is under construction. The Phase 9 content gate fails
 * the build if any fallback survives.
 */

/** Exhibits with a finished, bespoke implementation. Grows wave by wave. */
const BESPOKE = new Map<string, (def: ExhibitDefinition) => ExhibitModule>();

export function registerBespoke(id: string, factory: (def: ExhibitDefinition) => ExhibitModule): void {
  BESPOKE.set(id, factory);
}

// ── Vertical slice (plan Phase 5): five deliberately different exhibits that
// between them test large spatial sculpture, sequence/history, device
// interaction, a miniature game, and audio.
registerBespoke('E01', (def) => new StarsilkUniverse(def));
registerBespoke('E10', (def) => new WorldsVaultLineage(def));
registerBespoke('E19', (def) => new DexTilt(def));
registerBespoke('E25', (def) => new DnDexTable(def));
registerBespoke('E13', (def) => new SunoStudio(def));

// ── North wing: Starsilk & Drakken ──
registerBespoke('E02', (def) => new DrakkenCompendium(def));
registerBespoke('E03', (def) => new OrbitalTomb(def));
registerBespoke('E04', (def) => new PossibilityCartographer(def));
registerBespoke('E05', (def) => new StarsilkMaker(def));
registerBespoke('E06', (def) => new FieldAnatomy(def));
registerBespoke('E07', (def) => new TerraformingLaboratory(def));
registerBespoke('E08', (def) => new HeliocideObservatory(def));

// ── East wing: Dex Systems ──
registerBespoke('E17', (def) => new VoiceLab(def));
registerBespoke('E18', (def) => new CompanionSystems(def));
registerBespoke('E20', (def) => new UtilityBench(def));
registerBespoke('E21', (def) => new CivicSupport(def));
registerBespoke('E22', (def) => new CreativeTools(def));
registerBespoke('E23', (def) => new SensemakingLab(def));

// ── South wing: Games & Play ──
registerBespoke('E24', (def) => new InvincibleMagic(def));
registerBespoke('E26', (def) => new WestCatSystems(def));
registerBespoke('E27', (def) => new FullWeasel(def));
registerBespoke('E28', (def) => new AgainstTheVoid(def));
registerBespoke('E29', (def) => new ArkshipCivilization(def));
registerBespoke('E30', (def) => new AetherVFX(def));
registerBespoke('E31', (def) => new StoryWorlds(def));
registerBespoke('E32', (def) => new SmoresKatamari(def));
registerBespoke('E33', (def) => new EndlessGrok(def));

let installed = false;

/** Install every exhibit into the registry. Idempotent. */
export function installExhibits(): void {
  if (installed) return;
  installed = true;
  for (const record of COLLECTION.exhibits) {
    const bespoke = BESPOKE.get(record.id);
    registerExhibit(record.id, bespoke ?? ((def) => new ProvisionalExhibit(def)));
  }
}

export function bespokeCount(): number {
  return BESPOKE.size;
}

/** Exhibits with a finished bespoke implementation, in collection order. */
export function bespokeExhibitIds(): readonly string[] {
  return COLLECTION.exhibits.filter((e) => BESPOKE.has(e.id)).map((e) => e.id);
}

export function scaffoldedExhibitIds(): readonly string[] {
  return COLLECTION.exhibits.filter((e) => !BESPOKE.has(e.id)).map((e) => e.id);
}

export { registeredExhibitIds };
