import { DeterministicMuseumGuide, type GuideReply } from '../guide/DeterministicMuseumGuide';
import { Panel } from './Panel';
import { el } from './dom';

const SUGGESTED_QUESTIONS = ['What is this museum?', 'What am I looking at?', 'Show me something I missed', 'Show me games', 'What is finished?', 'Who is Dexter?', 'Controls'] as const;

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
      placeholder: 'Ask about a project, a subject, a wing, where you are…',
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
    // Starting points for a visitor who does not yet know what can be asked.
    const suggestions = el('div', { class: 'guide-suggestions', role: 'group', 'aria-label': 'Example questions' },
      ...SUGGESTED_QUESTIONS.map((question) => el('button', {
        type: 'button', class: 'guide-suggestions__item', text: question, onclick: () => {
          this.query = question;
          this.reply = this.guide.answer(question);
          this.render();
        },
      })),
    );
    this.setContent(el('label', { for: 'dexgpt-guide-query', text: 'Ask DexGPT' }), input, ask, suggestions, answer);
  }
}
