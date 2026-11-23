# W01 Music Source Provenance & Acoustic Analysis (ISLAND-05 Addendum)

**Supplied source archive name:** `"Bouncier Tropical Calypso Groove_tracks.zip"`  
**Retained untouched originals location:** `.asset-sources/music/bouncier-tropical-calypso-groove/` (gitignored; excluded from `public/`, `dist/`, and `dist-standalone/`)  
**Composition structure:** **One synchronized musical composition** separated into stems (NOT separate independent tracks plus a separate finale).  
**Runtime deployment status:** **Not shipped yet.** All eleven canonical pocket worlds (`W01`–`W10`, `L01`) remain `DORMANT`, and no compressed `.m4a`/`.ogg` stems are distributed in `src/assets/` or `public/` yet.

---

## 1. Retained Untouched Originals & SHA-256 Registry

| Stem | Retained Filename | Bytes | SHA-256 | Container / Codec / Format | Duration (Frames @ 48 kHz) | Peak / RMS (dBFS) | Disposition |
|---|---|---:|---|---|---|---|---|
| Bass | `Bouncier Tropical Calypso Groove_bass.m4a` | `6,938,230` | `ac4cc3dc21dd9023f8a705854c7cc8b2c8760da533296a8c952fa6844b5add3d` | MP4/M4A · AAC-LC · Stereo · `48000 Hz` · `330,753 bps` stream (`initial_padding: 1024`) | `166.698 s` (`8,001,504` decoded stereo frames) | `-7.37` / `-21.05` | Audible stem (layer 1: foundation) |
| Drums | `Bouncier Tropical Calypso Groove_drums.m4a` | `7,116,257` | `092cd41e5ecc4b7d29fa0fcf551c144e130f1210473609bd3edc2443d1dd50b7` | MP4/M4A · AAC-LC · Stereo · `48000 Hz` · `339,295 bps` stream (`initial_padding: 1024`) | `166.698 s` (`8,001,504` decoded stereo frames) | `-3.12` / `-25.78` | Audible stem (layer 2: rhythm) |
| Other | `Bouncier Tropical Calypso Groove_other.m4a` | `7,818,827` | `53e3254ac511dce3f9533e0c08596d726cbccdde6261f04b3c88f47e2b747a69` | MP4/M4A · AAC-LC · Stereo · `48000 Hz` · `373,007 bps` stream (`initial_padding: 1024`) | `166.698 s` (`8,001,504` decoded stereo frames) | `-2.72` / `-19.99` | Audible stem (layer 3: harmonic/melodic instruments) |
| Vocals | `Bouncier Tropical Calypso Groove_vocals.m4a` | `92,657` | `d7d8355166f692ae0e89ea903ea75cd955ca5fa430b20feea6f1b7333d9ba129` | MP4/M4A · AAC-LC · Stereo · `48000 Hz` · `2,275 bps` stream (`initial_padding: 1024`) | `166.698 s` (`8,001,504` decoded stereo frames) | `0.0` peak (`-inf` dBFS) | **Digital silence — excluded from runtime distribution** |

**Explicit vocals finding:** Decoding `Bouncier Tropical Calypso Groove_vocals.m4a` to 32-bit float PCM produces `0.0` maximum sample amplitude across all `8,001,504` stereo frames. Per owner instruction, it is never treated as an audible 4th stem, never distributed in runtime bundles, and no artificial vocal track may be invented.

---

## 2. Synchronized Arrangement & Timing Analysis

Because `bass`, `drums`, and `other` share one locked sample timeline (`166.698 s`, `48000 Hz`), they must play from **one synchronized transport origin** and be revealed progressively through gain automation rather than restarted independently:

1. **Stage 1 — Foundation (`bass`):** `bass` enters alone (`drums` and `other` running silently in lockstep at gain `0`).
2. **Stage 2 — Rhythm Entry (`+ drums`):** Reveal `drums` at a verified musical boundary (`next-bar` / `next-cue`) while preserving `bass`'s running timeline position.
3. **Stage 3 — Complete Arrangement (`+ other`):** Reveal `other` to unveil the complete instrumental groove.
4. **Stage 4 — Coral-Cathedral Ensemble & Choreography:** Play all three stems together in synchronized harmony for the monumental coral-cathedral ensemble and synchronized environmental choreography, driven by cue-sheet beat/bar/cue events.

*All creature-to-stem mappings and exact gameplay cue trigger timings remain provisional until W01 creative design and interaction pacing are authored.*

### Measured Beat Grid & Structural Landmarks

- **Tempo:** `92.00 BPM` constant across the entire `166.698 s` track (linear regression across `63` downbeats measured `92.00334 BPM`, bar length `2.608601 s`, downbeat residual std `6.86 ms`, max drift `< 8 ms` across 20 s windows).
- **Meter / Bar Structure:** `4/4` (`~0.652174 s/beat`, `~2.608696 s/bar` at exact `92.00 BPM`), spanning `~63.5` full groove bars (`0.033 s .. ~165.6 s`) plus a natural `~1.2 s` decay tail ending at `166.698 s`.
- **Opening transient:** First drum transient crosses `0.05` at `0.049 s`; downbeat anchor aligns cleanly around `~0.033 s`.
- **Ending cadence:** Drums stop after `165.48 s` (final `1.0 s` RMS is `-180 dBFS`), bass decays past `166.41 s` (`-52.3 dBFS` to `-180 dBFS`), and `other` rings cleanly out to `166.698 s` (`-58.3 dBFS`).

---

## 3. Loop Seam & Repeat-Region Inspection

**Hard-looping the full export (`0 .. 166.698 s`) is NOT seamless:**
- Jumping from the `166.698 s` outro fade directly to `0.0 s` creates an abrupt silence-to-downbeat slam (`drums` `-180 dBFS -> -23.3 dBFS`, `+156.7 dB` step; `other` `+9.0 dB`; `bass` `+3.7 dB`).
- Even on exact 32-bar phrase boundaries inside the groove, a hard splice (`crossfadeSeconds = 0`) exhibits a `16x–41x` sample-to-sample step discontinuity because continuous reverberation and instrumental tails differ between phrases.
- Using centered **equal-power crossfade looping** (`crossfadeSeconds = 0.06–0.12 s`) across the locked multitrack stem passes eliminates boundary clicks (`click_ratio 0.81x–1.29x` vs natural continuation) with **zero beat-phase drift**.

### Verified Provisional Repeat Regions (All Beat-Locked on `92 BPM`, `4/4`)

| Loop Region ID | Bar Range | Time Range (`startSeconds -> endSeconds`) | Span | Equal-Power `crossfadeSeconds` | Acoustic Inspection Summary | Intended Role |
|---|---|---|---:|---:|---|---|
| `exploration-loop` *(recommended default)* | `8 -> 40` (`32` bars) | `20.902 s -> 104.377 s` | `83.475 s` | `0.06 s` | Opens cleanly with the natural 8-bar intro (`bars 0..7`); both bar `8` and bar `40` sit after brief structural breaths (`click_ratio 0.84x`, pre-2-bar match `0.71–0.77`); releasing loop continues smoothly through `bars 40..63` to the natural ending. | Long exploration before ensemble finale |
| `full-cycle-loop` | `0 -> 32` (`32` bars) | `0.033 s -> 83.508 s` | `83.475 s` | `0.12 s` | `click_ratio 1.29x` (`0.81x` @ `60 ms`), `seam_dB_err <= 0.72 dB` across `bass`/`drums`/`other`, strong 32-bar phrase correspondence. | Full-cycle groove repetition |
| `extended-loop` | `0 -> 56` (`56` bars) | `0.033 s -> 146.114 s` | `146.082 s` | `0.06 s` | Plays almost the entire composition (`~2:26`) before wrapping cleanly (`click_ratio 1.01x`), leaving `bars 56..63` as the natural outro cadence on release. | Extended promenade prior to resolution |
| `mid-groove-loop` | `20 -> 52` (`32` bars) | `52.205 s -> 135.680 s` | `83.475 s` | `0.06 s` | Tightest combined bass+other forward phrase match (`B=0.710`, `O=0.819`, `click_ratio 1.04x`, `seam_dB_err 0.66–1.26 dB`). | Sustained mid-piece vamp |

---

## 4. Mandatory Pre-Distribution Asset Governance Gates

Before shipping compressed runtime stems or activating `W01`:

1. **Creator & Licensing Sign-off:** Owner must confirm the exact `creator`, `license`, `attribution`, and `source` strings for `src/assets/manifest.ts` and `docs/ASSET_POLICY.md`.
2. **Derived Runtime Transcode (3 Stems Only):** Compress *only* `bass`, `drums`, and `other` into web-delivery stereo files (`>= 48 kHz` / deterministic encoder), leaving the untouched originals in `.asset-sources/`. Record both `sourceHash` (above) and `processedHash` in `src/assets/manifest.ts`. Exclude `vocals.m4a` completely.
3. **Transfer & Initial-Visit Budget Compliance:** Notice the raw `.m4a` stems total `~20.86 MB` (`6.94 + 7.12 + 7.82 MB`). Shipping `>= 20 MB` in the eager initial bundle would violate the `20 MB` initial-visit ceiling (`scripts/check-budgets.mjs`). Runtime stems for `W01` must either target an appropriately sized compressed bitrate *and/or* remain excluded from the initial rotunda transfer until `W01` entry (verified via `npm run check:budgets` and `npm run verify:dist`), while maintaining full `file://` standalone compatibility.
4. **Pocket-World Activation:** Do not flip `W01` from `dormant` to `verified` until the W01 world geometry, creatures, accessibility captions, and final cue timings are complete and tested.
