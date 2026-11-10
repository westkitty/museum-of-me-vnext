import { COLLECTION, EXHIBITS_BY_ID, WINGS_BY_ID, projectsForExhibit } from '../content/collection.generated';
import type { ExhibitRecord, ProjectRecord, WingRecord } from '../content/types';
import type { Journal } from '../state/Journal';
import type { VisitThread } from '../state/VisitThread';
import { threadWeaveForCurrent } from '../state/ThreadWeave';

export interface GuideAction {
  readonly kind: 'guide';
  readonly exhibitId: string;
  readonly label: string;
}

export interface GuideReply {
  readonly text: string;
  readonly actions: readonly GuideAction[];
}

/** Where the visitor is standing, read from the running museum when available. */
export interface GuideLocation {
  readonly exhibitId: string | null;
  readonly zoneLabel: string;
}

const FALLBACK = 'I only answer from the museum’s local collection and visit journal. Try an exhibit title, project name, a subject such as “voice” or “games”, “what is this museum?”, “controls”, “wings”, or “something I missed”.';

const CONTROL_WORDS = / (controls?|keys?|keyboard|move|walk|turn|jump|sprint|interact|help|mouse|touch) /;

/** Words that carry the shape of a question rather than its subject. */
const STOPWORDS = new Set([
  'a', 'an', 'the', 'and', 'or', 'of', 'to', 'in', 'on', 'at', 'for', 'with', 'by', 'from', 'into', 'as',
  'is', 'are', 'was', 'were', 'be', 'been', 'do', 'does', 'did', 'can', 'could', 'would', 'should', 'will',
  'i', 'me', 'my', 'you', 'your', 'we', 'it', 'its', 'this', 'that', 'these', 'those', 'there', 'here',
  'what', 'whats', 'which', 'who', 'whos', 'where', 'wheres', 'when', 'why', 'how',
  'tell', 'show', 'find', 'take', 'guide', 'give', 'see', 'look', 'looking', 'go', 'get', 'know', 'explain',
  'about', 'help', 'any', 'anything', 'some', 'something', 'more', 'please', 'like', 'want', 'have', 'has', 'made',
  'app', 'apps', 'application', 'applications', 'tool', 'tools', 'system', 'systems', 'first', 'best', 'good',
  'museum', 'exhibit', 'exhibits', 'project', 'projects', 'room', 'thing', 'things', 'stuff', 'one', 'work',
]);

/** Visitor vocabulary mapped onto the words the collection itself uses. */
const SYNONYMS: Readonly<Record<string, readonly string[]>> = {
  finished: ['completed'], done: ['completed'], complete: ['completed'], shipped: ['completed'],
  song: ['music'], songs: ['music'], audio: ['voice', 'music'], speech: ['voice'], dictation: ['dictate', 'voice'],
  play: ['game', 'playable'], gaming: ['game'], video: ['media', 'video'], film: ['media', 'video'],
  privacy: ['privacy', 'private'], lore: ['canon'], story: ['story', 'canon'], dragon: ['drakken'], dragons: ['drakken'],
  ai: ['ai', 'agent', 'model'], llm: ['model', 'inference'], server: ['infrastructure', 'storage'],
  phone: ['android'], mobile: ['android'], mac: ['macos'], map: ['geospatial'], maps: ['geospatial'],
};

const STATUS_WORDS = ['completed', 'playable', 'paused', 'abandoned', 'superseded', 'experimental'] as const;

function normalise(text: string): string {
  return text.toLocaleLowerCase().replace(/[’']/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
}

/** Light singularisation so “games” finds “game” without a stemming library. */
function stem(word: string): string {
  if (word.length > 4 && word.endsWith('ies')) return `${word.slice(0, -3)}y`;
  if (word.length > 3 && word.endsWith('s') && !word.endsWith('ss')) return word.slice(0, -1);
  return word;
}

function termsOf(text: string): string[] {
  return normalise(text).split(' ').filter((word) => word && !STOPWORDS.has(word)).map(stem);
}

/** Names a visitor might say for one record: the whole name and each “/”-separated part. */
function aliasesOf(name: string): string[] {
  const parts = [name, ...name.split('/'), name.replace(/\(.*?\)/g, ''), ...name.split(':')];
  const out = new Set<string>();
  for (const part of parts) {
    const alias = normalise(part).replace(/^the /, '');
    if (alias.length >= 4) out.add(alias);
  }
  return [...out];
}

interface NamedEntity {
  readonly alias: string;
  readonly project?: ProjectRecord;
  readonly exhibit: ExhibitRecord;
}

interface IndexedExhibit {
  readonly exhibit: ExhibitRecord;
  /** term → weight, with the project that contributed the strongest match. */
  readonly terms: Map<string, { weight: number; project?: ProjectRecord }>;
}

function hostOf(project: ProjectRecord): ExhibitRecord | undefined {
  return COLLECTION.exhibits.find((candidate) => candidate.projectIds.includes(project.id));
}

function buildEntities(): NamedEntity[] {
  const entities: NamedEntity[] = [];
  // Projects first: a shared name answers with the project's own summary.
  for (const project of COLLECTION.projects) {
    const exhibit = hostOf(project);
    if (!exhibit) continue;
    for (const alias of aliasesOf(project.name)) entities.push({ alias, project, exhibit });
  }
  for (const exhibit of COLLECTION.exhibits) {
    for (const alias of [...aliasesOf(exhibit.title), normalise(exhibit.slug)]) entities.push({ alias, exhibit });
  }
  return entities;
}

function buildIndex(): IndexedExhibit[] {
  return COLLECTION.exhibits.map((exhibit) => {
    // A term that recurs across a record's name, family and kind is more
    // central than one that appears once, so weights add across fields while
    // repeated use inside one field counts once.
    const byField = new Map<string, Map<string, { weight: number; project?: ProjectRecord }>>();
    const add = (field: string, text: string, weight: number, project?: ProjectRecord) => {
      for (const term of termsOf(text)) {
        const fields = byField.get(term) ?? new Map<string, { weight: number; project?: ProjectRecord }>();
        byField.set(term, fields);
        if (!fields.has(field)) fields.set(field, { weight, project });
      }
    };
    add('title', exhibit.title, 5);
    add('subtitle', exhibit.copy.subtitle, 2);
    add('plaque', exhibit.copy.plaque, 1);
    add('made', exhibit.copy.made, 1);
    for (const project of projectsForExhibit(exhibit.id)) {
      add('name', project.name, 5, project);
      add('family', project.family, 3, project);
      add('kind', project.kind, 3, project);
      add('status', project.status, 2, project);
      add('capabilities', project.capabilities.join(' '), 2, project);
      add('summary', project.summary, 1, project);
    }
    const terms = new Map<string, { weight: number; project?: ProjectRecord }>();
    for (const [term, fields] of byField) {
      let weight = 0;
      let strongest: { weight: number; project?: ProjectRecord } | undefined;
      for (const value of fields.values()) {
        weight += value.weight;
        if (value.project && (!strongest || value.weight > strongest.weight)) strongest = value;
      }
      terms.set(term, { weight, project: strongest?.project });
    }
    return { exhibit, terms };
  });
}

function wingAliases(wing: WingRecord): string[] {
  const first = normalise(wing.name).split(' ')[0];
  return [normalise(wing.name), normalise(wing.subtitle), `${wing.id} wing`, `${first} wing`, `${stem(first)} wing`];
}

function listNames(names: readonly string[]): string {
  if (names.length <= 1) return names.join('');
  return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
}

/**
 * Local, inspectable museum guide. It derives every answer from the existing
 * generated collection, the visit Journal and the visitor's present location;
 * it neither calls a provider nor owns a second content or navigation
 * authority. Matching is plain token arithmetic over the collection's own
 * words, so the same question always produces the same answer, offline.
 */
export class DeterministicMuseumGuide {
  private readonly entities = buildEntities();
  private readonly index = buildIndex();

  constructor(
    private readonly journal: Journal,
    private readonly visitThread?: VisitThread,
    private readonly location?: () => GuideLocation,
  ) {}

  answer(rawQuery: string): GuideReply {
    const query = normalise(rawQuery);
    if (!query) return this.reply('Ask about an exhibit, project, wing, controls, or something you have not visited yet.');
    const padded = ` ${query} `;
    const has = (pattern: RegExp) => pattern.test(padded);

    // Identity questions come first so that the guide, the dog and the museum
    // are never confused with the projects that happen to share their names.
    if (query === 'dexgpt' || has(/ (who|what) (are|r) (you|u) | (who|what) is dexgpt | your name | are you (dexter|an ai|real|chatgpt) |^ (hello|hi|hey) /)) return this.aboutGuide();
    if (has(/ dexter | dexters | sanctuary | stink weasel | the dog | phalene | papillon /)) return this.aboutDexter();
    if (has(/ how (many|big) | what is this (place|museum|building) | whats this (place|museum|building) | what is the museum | about (this|the) (museum|place|building) | who (made|built|makes|created) /)) return this.aboutMuseum();

    if (has(/ why this | why stop | why here | connect | connection /) && this.visitThread?.active) {
      const woven = threadWeaveForCurrent(this.visitThread.active, this.journal);
      const current = this.visitThread.currentStopId;
      if (woven && current) {
        const exhibit = EXHIBITS_BY_ID.get(current)!;
        const bridge = woven.bridgeFromPrevious ? ` ${woven.bridgeFromPrevious}` : '';
        return { text: `${exhibit.title}: ${woven.selectionReason}${bridge}`, actions: [this.action(exhibit)] };
      }
    }

    // A name the visitor actually said outranks every keyword below, so
    // “where is the Full Weasel” finds the cabinet instead of listing wings.
    const named = this.namedEntity(padded);
    if (named) return named.project ? this.forProject(named.project, named.exhibit) : this.forExhibit(named.exhibit);

    const exhibitById = COLLECTION.exhibits.find((candidate) => has(new RegExp(` ${candidate.id.toLocaleLowerCase()} `)));
    if (exhibitById) return this.forExhibit(exhibitById);

    if (has(/ where am i | what am i looking at | in front of me | what is (this|here|that) | whats (this|here|that) | this (exhibit|room|bay|one) | what can i do( here)? | what do i do( here)? /)) {
      return this.aboutHere();
    }

    const wing = COLLECTION.wings.find((candidate) => wingAliases(candidate).some((alias) => padded.includes(` ${alias} `)));
    if (wing) return this.forWing(wing);
    if (has(/ rotunda | stairs? | staircase | balcony | upstairs | downstairs | (upper|second) (floor|level) | fly | flying | flight /)) {
      return this.reply('The Reliquary Rotunda is the bright, neutral hub of the building. The four ground-level wings open from it. Two winding grand stairs on its southwest and southeast walls climb to the balcony, which leads to the two upper wings: Music, Promptcraft & Media to the northwest and Local Systems to the northeast. Stepping onto the low plinth at the centre lifts you into free flight until you land on a floor again. The Dexter Sanctuary is reached by a ramp below and behind the Rotunda.');
    }
    if (has(/ wings? | layout | floors? | levels? | mezzanine /)) {
      return this.reply(`The museum has six wings around the Reliquary Rotunda: ${COLLECTION.wings.map((candidate) => `${candidate.name} (${candidate.id}, ${candidate.level === 0 ? 'ground level' : 'upper level'})`).join(', ')}. The Dexter Sanctuary is separate, below and behind the Rotunda. Ask for a wing, an exhibit or a project and I will tell you what is there.`);
    }

    if (has(/ thread | tour | itinerary | route /)) {
      const active = this.visitThread?.active;
      const current = this.visitThread?.currentStopId;
      if (active && current) {
        const exhibit = EXHIBITS_BY_ID.get(current)!;
        return { text: `${active.title} is ${active.status}. Next: ${exhibit.title}. ${this.visitThread?.remainingCount ?? 0} stops remain. Ask “why this stop?” for the deterministic connection.`, actions: [this.action(exhibit)] };
      }
      return this.reply('Press T for Visit Thread. It builds a local self-guided itinerary from the actual collection and your journal, then reuses the map’s floor-line wayfinding. It never teleports you and it is not a score or achievement system.');
    }
    if (has(/ missed | unvisited | next | not seen | havent seen | start | begin | recommend | suggest | see first | should i (see|visit|go) /)) {
      const next = this.journal.nextUnvisited(COLLECTION.exhibits.map((exhibit) => exhibit.id));
      if (!next) return this.reply('Your visit journal records every exhibit as opened. The rooms remain available for a slower second look.');
      return this.forExhibit(EXHIBITS_BY_ID.get(next)!, 'Your next unvisited exhibit is');
    }

    // A question that is only about operating the museum is answered before
    // subject search; “help me find games” still reaches the collection.
    const aboutControls = has(CONTROL_WORDS);
    if (aboutControls && termsOf(padded.replace(new RegExp(CONTROL_WORDS.source, 'g'), ' ')).length === 0) return this.controls();

    const status = this.byStatus(query);
    if (status) return status;

    const found = this.search(query);
    if (found) return found;
    if (aboutControls) return this.controls();

    return this.reply(FALLBACK);
  }

  private controls(): GuideReply {
    return this.reply('Move with W/A/S/D or the arrow keys; Q/E turns; Shift sprints; Space jumps; F or Enter interacts. M opens the map, J the journal, T your Visit Thread, C the Curator Desk, Y the Study Lab, O settings, H the full accessible contents, and Ctrl+K the command palette. I can set the map’s existing floor-line guide, but I do not teleport you.');
  }

  private aboutGuide(): GuideReply {
    const lineage = COLLECTION.projects.find((project) => aliasesOf(project.name).includes('dexgpt'));
    const host = lineage ? hostOf(lineage) : undefined;
    return {
      text: 'I am DexGPT, the museum’s local guide. I answer only from the collection built into this page and from your own visit journal; nothing you type leaves your device. I am not Dexter — Dexter is a dog, and the Sanctuary below the Rotunda is his.'
        + (host ? ` The project I am named for is kept in ${host.title}.` : ''),
      actions: host ? [this.action(host)] : [],
    };
  }

  private aboutDexter(): GuideReply {
    return this.reply('Dexter is not a project and not an exhibit, and he is not me. He is a tricolour Phalène. Several systems in this museum carry his name; none of them are him. The Dexter Sanctuary is a quiet room below and behind the Rotunda, reached by a ramp through a narrow threshold on the northwest side. There is nothing to collect there and nothing to complete.');
  }

  private aboutMuseum(): GuideReply {
    const next = this.journal.nextUnvisited(COLLECTION.exhibits.map((exhibit) => exhibit.id));
    const opened = this.journal.visitedCount;
    return {
      text: `Museum of Me — The Reliquary of Iterative Becoming is a first-person museum of ${COLLECTION.projects.length} current project identities, presented through ${COLLECTION.exhibits.length} exhibits across ${COLLECTION.wings.length} wings on two levels around the Reliquary Rotunda. Each exhibit is something you can operate, not only read. The Dexter Sanctuary is kept separate from the collection. `
        + (opened > 0 ? `Your journal records ${opened} of ${COLLECTION.exhibits.length} exhibits opened. ` : 'There is no required order and nothing to unlock. ')
        + 'Ask for a subject, a project, a wing, or “something I missed”.',
      actions: next ? [this.action(EXHIBITS_BY_ID.get(next)!, 'Guide me to an exhibit I have not opened')] : [],
    };
  }

  private aboutHere(): GuideReply {
    const here = this.location?.();
    const exhibit = here?.exhibitId ? EXHIBITS_BY_ID.get(here.exhibitId) : undefined;
    if (exhibit) return this.forExhibit(exhibit, 'You are at');
    if (here) return this.reply(`You are in ${here.zoneLabel}, not inside an exhibit bay. Walk into a bay and ask again, or ask for a subject, a project, a wing, or “something I missed”.`);
    return this.aboutMuseum();
  }

  /** The longest collection name that appears whole in the visitor's words. */
  private namedEntity(padded: string): NamedEntity | null {
    let best: NamedEntity | null = null;
    for (const entity of this.entities) {
      if (!padded.includes(` ${entity.alias} `)) continue;
      if (!best || entity.alias.length > best.alias.length) best = entity;
    }
    return best;
  }

  /** “What is finished / paused / abandoned?” answered from each project's own status line. */
  private byStatus(query: string): GuideReply | null {
    const asked = termsOf(query).flatMap((term) => [term, ...(SYNONYMS[term] ?? [])]);
    const word = STATUS_WORDS.find((candidate) => asked.includes(candidate));
    if (!word || termsOf(query).length > 2) return null;
    const matches = COLLECTION.projects.filter((project) => project.status.toLocaleLowerCase().includes(word));
    if (matches.length === 0) return null;
    const hosts: ExhibitRecord[] = [];
    for (const project of matches) {
      const host = hostOf(project);
      if (host && !hosts.includes(host)) hosts.push(host);
    }
    const shown = matches.slice(0, 6).map((project) => `${project.name} (${project.status})`);
    const more = matches.length > shown.length ? `, and ${matches.length - shown.length} more` : '';
    return {
      text: `By their own status lines, ${matches.length} of ${COLLECTION.projects.length} projects ${matches.length === 1 ? 'is' : 'are'} ${word}: ${shown.join('; ')}${more}. The museum shows unfinished and superseded work as it is.`,
      actions: hosts.slice(0, 4).map((host) => this.action(host)),
    };
  }

  /** Subject search over the collection's own words, grouped by exhibit. */
  private search(query: string): GuideReply | null {
    const asked = termsOf(query);
    if (asked.length === 0) return null;
    const scored: { entry: IndexedExhibit; score: number; hits: number; projects: ProjectRecord[] }[] = [];
    for (const entry of this.index) {
      let score = 0;
      let hits = 0;
      const projects: ProjectRecord[] = [];
      for (const term of asked) {
        let best: { weight: number; project?: ProjectRecord } | undefined;
        for (const candidate of [term, ...(SYNONYMS[term] ?? []).map(stem)]) {
          for (const [indexed, value] of entry.terms) {
            const exact = indexed === candidate;
            const prefix = !exact && candidate.length >= 4 && indexed.startsWith(candidate);
            if (!exact && !prefix) continue;
            const weight = exact ? value.weight : value.weight * 0.6;
            if (!best || weight > best.weight) best = { weight, project: value.project };
          }
        }
        if (!best) continue;
        score += best.weight;
        hits++;
        if (best.project && !projects.includes(best.project)) projects.push(best.project);
      }
      // Every subject word the visitor used must be answered by the same exhibit.
      if (hits === asked.length && score >= 2) scored.push({ entry, score, hits, projects });
    }
    if (scored.length === 0) return null;
    scored.sort((a, b) => b.score - a.score || a.entry.exhibit.id.localeCompare(b.entry.exhibit.id));
    const top = scored[0];
    const runnerUp = scored[1];
    // One answer only when the subject really points at one place; a broad
    // subject such as “games” gets a ranked shortlist instead of a lucky winner.
    if (!runnerUp || (scored.length <= 3 && top.score >= runnerUp.score * 1.5)) {
      const titleTerms = termsOf(top.entry.exhibit.title);
      const namesExhibit = asked.every((term) => titleTerms.includes(term));
      if (top.projects.length === 1 && !namesExhibit) return this.forProject(top.projects[0], top.entry.exhibit);
      if (namesExhibit) return this.forExhibit(top.entry.exhibit, 'The closest match is');
      return this.forExhibit(top.entry.exhibit, top.projects.length > 1
        ? `${listNames(top.projects.map((project) => project.name))} are represented by`
        : 'The closest match is');
    }
    const shortlist = scored.slice(0, 4);
    const lines = shortlist.map(({ entry, projects }) => {
      const wing = WINGS_BY_ID.get(entry.exhibit.wing)!;
      const sameName = projects.length === 1 && normalise(projects[0].name).replace(/^the /, '') === normalise(entry.exhibit.title).replace(/^the /, '');
      const through = projects.length > 0 && !sameName ? ` (${listNames(projects.slice(0, 3).map((project) => project.name))})` : '';
      return `${entry.exhibit.title}${through} in ${wing.name}`;
    });
    const more = scored.length > shortlist.length ? ` and ${scored.length - shortlist.length} more` : '';
    return {
      text: `Several parts of the collection touch “${asked.join(' ')}”: ${lines.join('; ')}${more}. Name one and I will tell you what it is and what you can do there.`,
      actions: shortlist.map(({ entry }) => this.action(entry.exhibit)),
    };
  }

  private forWing(wing: WingRecord): GuideReply {
    const exhibits = COLLECTION.exhibits.filter((exhibit) => exhibit.wing === wing.id);
    const unopened = exhibits.filter((exhibit) => !this.journal.hasVisited(exhibit.id));
    return {
      text: `${wing.name} is the ${wing.subtitle}, on the ${wing.level === 0 ? 'ground level' : 'upper level'}. ${wing.blurb} It holds ${exhibits.length} exhibits: ${listNames(exhibits.map((exhibit) => exhibit.title))}.`
        + (unopened.length === 0 ? ' Your journal records all of them as opened.' : ''),
      actions: (unopened.length > 0 ? unopened : exhibits).slice(0, 3).map((exhibit) => this.action(exhibit)),
    };
  }

  private forProject(project: ProjectRecord, exhibit: ExhibitRecord): GuideReply {
    const wing = WINGS_BY_ID.get(exhibit.wing)!;
    return {
      text: `${project.name}: ${project.summary} Status: ${project.status}. It is represented by ${exhibit.title} in ${wing.name} (${this.whereIs(wing)}). At the exhibit: ${exhibit.copy.interaction}`,
      actions: [this.action(exhibit)],
    };
  }

  private forExhibit(exhibit: ExhibitRecord, lead = 'You can find'): GuideReply {
    const wing = WINGS_BY_ID.get(exhibit.wing)!;
    const projects = projectsForExhibit(exhibit.id).map((project) => project.name);
    const represents = projects.length > 1 || projects[0] !== exhibit.title ? ` It represents ${listNames(projects)}.` : '';
    const opened = this.journal.hasVisited(exhibit.id) ? ' Your journal records it as opened.' : '';
    return {
      text: `${lead} ${exhibit.title} in ${wing.name} (${this.whereIs(wing)}). ${exhibit.copy.plaque}${represents} At the exhibit: ${exhibit.copy.interaction}${opened}`,
      actions: [this.action(exhibit)],
    };
  }

  private whereIs(wing: WingRecord): string {
    return `${wing.subtitle}, ${wing.level === 0 ? 'ground level' : 'upper level'}`;
  }

  private action(exhibit: ExhibitRecord, label = `Guide me to ${exhibit.title}`): GuideAction {
    return { kind: 'guide', exhibitId: exhibit.id, label };
  }

  private reply(text: string): GuideReply {
    return { text, actions: [] };
  }
}
