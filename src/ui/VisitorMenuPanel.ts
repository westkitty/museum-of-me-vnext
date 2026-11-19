import { Panel } from './Panel';
import { el } from './dom';

export class VisitorMenuPanel extends Panel {
  constructor(private readonly actions: () => ReadonlyArray<{ label: string; open: () => void }>) {
    super('visitor-menu', 'Museum', '');
  }

  protected render(): void {
    this.setContent(el('nav', { class: 'visitor-menu__actions', 'aria-label': 'Visitor tools' },
      ...this.actions().map(({ label, open }) => el('button', {
        class: 'panel__card', type: 'button', text: label,
        onclick: () => {
          this.close();
          open();
        },
      })),
    ));
  }
}
