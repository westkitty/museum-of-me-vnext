import { DeterministicMuseumGuide, type GuideReply } from '../guide/DeterministicMuseumGuide';
import { Panel } from './Panel';
import { el } from './dom';

/** Semantic, local-only surface for DexGPT’s deterministic museum guidance. */
export class MuseumGuidePanel extends Panel {
  private query = '';
  private reply: GuideReply | null = null;

  constructor(
    private readonly guide: DeterministicMuseumGuide,
    private readonly guideTo: (exhibitId: string) => void,
  ) {
    super('dexgpt-guide', 'DexGPT', 'Local museum guide');
  }

  protected render(): void {
    const input = el('input', {
      id: 'dexgpt-guide-query', type: 'search', value: this.query,
      placeholder: 'Ask about a project, exhibit, wing, controls…',
      oninput: (event: Event) => { this.query = (event.target as HTMLInputElement).value; },
      onkeydown: (event: Event) => {
        if ((event as KeyboardEvent).key === 'Enter') {
          event.preventDefault();
          this.reply = this.guide.answer(this.query);
          this.render();
          this.body.querySelector<HTMLInputElement>('#dexgpt-guide-query')?.focus();
        }
      },
    });
    const ask = el('button', {
      type: 'button', text: 'Ask DexGPT', onclick: () => {
        this.reply = this.guide.answer(this.query);
        this.render();
      },
    });
    const answer = this.reply
      ? el('section', { class: 'guide-answer', 'aria-live': 'polite' },
        el('p', { text: this.reply.text }),
        ...this.reply.actions.map((action) => el('button', {
          type: 'button', text: action.label, onclick: () => { this.guideTo(action.exhibitId); this.close(); },
        })),
      )
      : el('p', { class: 'panel__note', text: 'I use the local collection and your visit journal. I can guide you, but I do not teleport you.' });
    this.setContent(el('label', { for: 'dexgpt-guide-query', text: 'Ask DexGPT' }), input, ask, answer);
  }
}
