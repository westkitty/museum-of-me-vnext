import { Panel } from './Panel';
import { el } from './dom';
import { FULL_WEASEL_ENTRY } from '../assets/fullWeaselArtifact';

/**
 * The finished first-party game lives in a local, same-origin iframe. It is
 * created only while engaged so its React timers, media and input cannot run
 * invisibly behind the Museum.
 */
export class FullWeaselPanel extends Panel {
  private frame: HTMLIFrameElement | null = null;

  constructor() {
    super('full-weasel', 'The Full Weasel', 'E27 · local first-party artifact');
  }

  get frameWindow(): Window | null {
    return this.frame?.contentWindow ?? null;
  }

  protected override render(): void {
    this.frame = el('iframe', {
      class: 'full-weasel__frame',
      src: FULL_WEASEL_ENTRY,
      title: 'The Full Weasel rhythm game',
      sandbox: 'allow-scripts allow-same-origin',
      referrerpolicy: 'no-referrer',
      allow: 'autoplay; vibrate',
    }) as HTMLIFrameElement;
    this.setContent(
      el('p', { class: 'panel__note', text: 'A complete local build of the finished rhythm game. Tap or click inside to play; Escape or Close returns to the museum.' }),
      this.frame,
    );
  }

  override close(): void {
    // Removing the iframe stops its React timers, media playback and capture
    // before first-person Museum input is released.
    this.frame?.remove();
    this.frame = null;
    super.close();
  }
}
