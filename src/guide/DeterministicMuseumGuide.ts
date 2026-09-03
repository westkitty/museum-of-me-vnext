import { COLLECTION, EXHIBITS_BY_ID, WINGS_BY_ID } from '../content/collection.generated';
import type { Journal } from '../state/Journal';

export interface GuideAction {
  readonly kind: 'guide';
  readonly exhibitId: string;
  readonly label: string;
}

export interface GuideReply {
  readonly text: string;
  readonly actions: readonly GuideAction[];
}

/**
 * Local, inspectable museum guide. It derives every answer from the existing
 * generated collection and Journal; it neither calls a provider nor owns a
 * second content or navigation authority.
 */
export class DeterministicMuseumGuide {
  constructor(private readonly journal: Journal) {}

  answer(rawQuery: string): GuideReply {
    const query = rawQuery.trim().toLocaleLowerCase();
    if (!query) return this.reply('Ask about an exhibit, project, wing, controls, or something you have not visited yet.');

    if (/\b(controls?|move|walk|key|keyboard|help)\b/.test(query)) {
      return this.reply('Move with W/A/S/D or the arrow keys; Q/E turns; Shift sprints; Space jumps; F or Enter interacts. M opens the map, J the journal, and Ctrl+K the command palette. I can set the map’s existing floor-line guide, but I do not teleport you.');
    }
    if (/\b(wing|wings|where am i|where)\b/.test(query) && !/\b(project|exhibit)\b/.test(query)) {
      return this.reply(`The museum has ${COLLECTION.wings.map((wing) => `${wing.name} (${wing.id})`).join(', ')}. Ask for an exhibit or project and I will identify its wing.`);
    }
    if (/\b(missed|unvisited|next)\b/.test(query)) {
      const next = this.journal.nextUnvisited(COLLECTION.exhibits.map((exhibit) => exhibit.id));
      if (!next) return this.reply('Your visit journal records every exhibit as opened. The rooms remain available for a slower second look.');
      return this.forExhibit(next, 'Your next unvisited exhibit is');
    }

    const exhibitById = COLLECTION.exhibits.find((candidate) => query.includes(candidate.id.toLocaleLowerCase()));
    if (exhibitById) return this.forExhibit(exhibitById.id, 'You can find');

    const project = COLLECTION.projects.find((candidate) => this.matches(query, candidate.name));
    if (project) {
      const host = COLLECTION.exhibits.find((candidate) => candidate.projectIds.includes(project.id));
      if (host) return this.forExhibit(host.id, `${project.name}: ${project.summary} It is represented by`);
    }

    const exhibit = COLLECTION.exhibits.find((candidate) => this.matches(query, candidate.title));
    if (exhibit) return this.forExhibit(exhibit.id, 'You can find');

    return this.reply('I only answer from the museum’s local collection and visit journal. Try an exhibit title, project name, “controls”, “wings”, or “something I missed”.');
  }

  private forExhibit(exhibitId: string, lead: string): GuideReply {
    const exhibit = EXHIBITS_BY_ID.get(exhibitId)!;
    const wing = WINGS_BY_ID.get(exhibit.wing)!;
    return {
      text: `${lead} ${exhibit.title} in ${wing.name}. ${wing.blurb}`,
      actions: [{ kind: 'guide', exhibitId, label: `Guide me to ${exhibit.title}` }],
    };
  }

  private reply(text: string): GuideReply {
    return { text, actions: [] };
  }

  private matches(query: string, candidate: string): boolean {
    const normalized = candidate.toLocaleLowerCase();
    return normalized.includes(query) || query.includes(normalized)
      || query.split(/\s+/).filter(Boolean).every((word) => normalized.includes(word));
  }
}
