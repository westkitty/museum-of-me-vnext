import { COLLECTION, EXHIBITS_BY_ID, WINGS_BY_ID, projectsForExhibit } from '../content/collection.generated';
import type { ExhibitRecord, ProjectRecord, WingRecord } from '../content/types';
import type { Journal } from '../state/Journal';
import type { VisitThread } from '../state/VisitThread';
import { threadWeaveForCurrent } from '../state/ThreadWeave';
import { GROUND_Y, LEVEL_1_Y, PLACEMENTS } from '../world/layout';
import { exhibitWalkDistance } from '../world/visitorRoute';
import { PROJECT_STAGE_LABEL, projectStage, type ProjectStage } from '../content/projectStage';

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
  /** Visitor feet position inside the museum, when known (null outside). */
  readonly position?: readonly [number, number, number] | null;
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

/** “Where did I leave off?” and other questions about the visitor's own journal. */
const RECAP_WORDS = / where (did|was) i (leave|left|stop|get)( off| to)? | (left|leave) off | where was i | what have i (seen|visited|opened|done|read) | (my|the) (visit|journal|history|bookmarks?|notes?) so far | my (journal|bookmarks|notes|history) | welcome back | recap | so far /;
const COMPARE_WORDS = / compare | comparing | comparison | versus | vs | difference between | differences between | different from | differ from | how (is|are|does|do) .+ differ /;
const ROOM_STORY_WORDS = / what changed | changes? between | how (do|did) (the )?(projects|they) (here )?(differ|change|evolve) | differ(ences?)? (between|among) (the )?projects | evolve | evolved | evolution | lineage | (projects|stages) (here|in (this|the) (room|exhibit|bay)) /;
const NEARBY_WORDS = / nearby | near (me|here) | close (by|to me) | closest | nearest | around (me|here) | next door | next to me /;

function articled(phrase: string): string {
  // “Creative universe” reads as “a creative universe”; “macOS application” keeps its casing.
  const shown = /^[A-Z][a-z]/.test(phrase) ? phrase[0].toLocaleLowerCase() + phrase.slice(1) : phrase;
  return `${/^[aeiou]/i.test(shown) ? 'an' : 'a'} ${shown}`;
}

function stageLabel(project: ProjectRecord): string {
  const stage = projectStage(project.status);
  return stage ? PROJECT_STAGE_LABEL[stage].toLocaleLowerCase() : 'stage not stated';
}

/** “2 active and 1 superseded”, from each project's own status line. */
function stageSummary(projects: readonly ProjectRecord[]): string {
  const counts = new Map<ProjectStage | 'unstated', number>();
  for (const project of projects) {
    const stage = projectStage(project.status) ?? 'unstated';
    counts.set(stage, (counts.get(stage) ?? 0) + 1);
  }
  const order: (ProjectStage | 'unstated')[] = ['active', 'experimental', 'paused', 'completed', 'superseded', 'abandoned', 'unstated'];
  return listNames(order.filter((stage) => counts.has(stage)).map((stage) => `${counts.get(stage)} ${stage === 'unstated' ? 'with no stated stage' : PROJECT_STAGE_LABEL[stage].toLocaleLowerCase()}`));
}

/** Levenshtein distance, giving up once it passes `limit`. */
function editDistance(a: string, b: string, limit: number): number {
  let previous = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const current = [i];
    let rowMin = i;
    for (let j = 1; j <= b.length; j++) {
      const value = Math.min(previous[j] + 1, current[j - 1] + 1, previous[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      current.push(value);
      rowMin = Math.min(rowMin, value);
    }
    if (rowMin > limit) return limit + 1;
    previous = current;
  }
  return previous[b.length];
}

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
  /** True when this device's journal already held visits as the page loaded. */
  private readonly returningVisitor: boolean;

  constructor(
    private readonly journal: Journal,
    private readonly visitThread?: VisitThread,
    private readonly location?: () => GuideLocation,
  ) {
    this.returningVisitor = journal.visitedCount > 0;
  }

  answer(rawQuery: string, allowRespell = true): GuideReply {
    const query = normalise(rawQuery);
    if (!query) return this.reply('Ask about an exhibit, project, wing, controls, or something you have not visited yet.');
    const padded = ` ${query} `;
    const has = (pattern: RegExp) => pattern.test(padded);

    // Identity questions come first so that the guide, the dog and the museum
    // are never confused with the projects that happen to share their names.
    if (query === 'dexgpt' || has(/ (who|what) (are|r) (you|u) | (who|what) is dexgpt | your name | are you (dexter|an ai|real|chatgpt) |^ (hello|hi|hey) /)) return this.aboutGuide();
    if (has(/ dexter | dexters | sanctuary | stink weasel | the dog | phalene | papillon /)) return this.aboutDexter();
    if (has(/ how (many|big) | what is this (place|museum|building) | whats this (place|museum|building) | what is the museum | about (this|the) (museum|place|building) | who (made|built|makes|created) /)) return this.aboutMuseum();

    // The visitor's own record, before any collection search: “where did I
    // leave off” is about the journal, not about a project called “leave”.
    if (has(RECAP_WORDS)) return this.recap();

    // Two named things and a comparing word: answer about both, side by side.
    if (has(COMPARE_WORDS)) {
      const compared = this.compare(padded);
      if (compared) return compared;
    }

    if (has(ROOM_STORY_WORDS)) {
      const story = this.roomStory(padded);
      if (story) return story;
    }

    if (has(NEARBY_WORDS)) return this.nearby();

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
    if (has(/ stairs? | staircase | upstairs | downstairs | (get|go|way) (up|down|back) | which floor | what floor /)) {
      const directions = this.verticalDirections();
      if (directions) return this.reply(directions);
    }
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

    // Before giving up: a misspelt collection word, then the subjects that
    // each word does match on its own. Every suggestion is a real record.
    if (allowRespell) {
      const respelt = this.respell(query);
      if (respelt) {
        const again = this.answer(respelt.query, false);
        if (again.actions.length > 0) {
          return { text: `I read ${respelt.changes.map(([from, to]) => `“${from}” as “${to}”`).join(' and ')}. ${again.text}`, actions: again.actions };
        }
      }
    }
    const partial = this.partialMatches(query);
    if (partial) return partial;

    return this.reply(FALLBACK);
  }

  /**
   * A short “welcome back” line for the guide panel, from this device's
   * journal only. Null on a first visit, so a new visitor sees no history.
   */
  welcomeBack(): string | null {
    if (!this.returningVisitor) return null;
    const recent = this.journal.all()[0];
    const exhibit = recent ? EXHIBITS_BY_ID.get(recent.exhibitId) : undefined;
    if (!exhibit) return null;
    const count = this.journal.visitedCount;
    return `Welcome back. Your journal on this device records ${count} of ${COLLECTION.exhibits.length} exhibits opened; the most recent was ${exhibit.title}. Ask “where did I leave off?” to pick up from there.`;
  }

  /** “Where did I leave off?” — a summary of the visitor's own journal. */
  private recap(): GuideReply {
    const entries = this.journal.all().filter((entry) => EXHIBITS_BY_ID.has(entry.exhibitId));
    const next = this.journal.nextUnvisited(COLLECTION.exhibits.map((exhibit) => exhibit.id));
    if (entries.length === 0) {
      return {
        text: 'Your journal on this device has no opened exhibits yet, so there is nothing to pick up from. There is no required order; ask for a subject, a wing, or “something I missed”.',
        actions: next ? [this.action(EXHIBITS_BY_ID.get(next)!, 'Guide me to a first exhibit')] : [],
      };
    }
    const last = EXHIBITS_BY_ID.get(entries[0].exhibitId)!;
    const lastWing = WINGS_BY_ID.get(last.wing)!;
    const before = entries.slice(1, 3).map((entry) => EXHIBITS_BY_ID.get(entry.exhibitId)!.title);
    const marks = entries.filter((entry) => entry.bookmarked).map((entry) => EXHIBITS_BY_ID.get(entry.exhibitId)!.title);
    const notes = entries.filter((entry) => entry.note.trim().length > 0).length;
    const parts = [
      `Your journal on this device records ${entries.length} of ${COLLECTION.exhibits.length} exhibits opened. The most recent was ${last.title} in ${lastWing.name}${before.length > 0 ? `; before that, ${listNames(before)}` : ''}.`,
    ];
    if (marks.length > 0) parts.push(`You bookmarked ${listNames(marks.slice(0, 4))}${marks.length > 4 ? ` and ${marks.length - 4} more` : ''}.`);
    if (notes > 0) parts.push(`You left ${notes === 1 ? 'a note' : `notes`} on ${notes} ${notes === 1 ? 'exhibit; it is' : 'exhibits; they are'} in the Journal (J).`);
    const actions: GuideAction[] = [];
    const saved = this.journal.guideTarget;
    const savedExhibit = saved?.kind === 'exhibit' ? EXHIBITS_BY_ID.get(saved.id) : undefined;
    if (savedExhibit && !this.journal.hasVisited(savedExhibit.id)) {
      parts.push(`Your floor line was leading to ${savedExhibit.title}.`);
      actions.push(this.action(savedExhibit, `Carry on to ${savedExhibit.title}`));
    }
    // Pick up where the visitor was: the next unopened room in the same wing.
    const sameWing = COLLECTION.exhibits.find((exhibit) => exhibit.wing === last.wing && !this.journal.hasVisited(exhibit.id));
    const onward = sameWing ?? (next ? EXHIBITS_BY_ID.get(next) : undefined);
    if (onward && onward.id !== savedExhibit?.id) {
      parts.push(sameWing
        ? `${sameWing.title} is the next room in ${lastWing.name} you have not opened.`
        : `${lastWing.name} is fully opened; ${onward.title} is the next room you have not opened.`);
      actions.push(this.action(onward));
    }
    if (!onward) parts.push('Every exhibit is recorded as opened; the rooms remain open for a slower second look.');
    actions.push(this.action(last, `Back to ${last.title}`));
    return { text: parts.join(' '), actions };
  }

  /** Every distinct collection record named in the visitor's words, longest names first, no overlaps. */
  private namedEntities(padded: string): NamedEntity[] {
    const hits: { entity: NamedEntity; start: number; end: number }[] = [];
    const sorted = [...this.entities].sort((a, b) => b.alias.length - a.alias.length);
    for (const entity of sorted) {
      const start = padded.indexOf(` ${entity.alias} `);
      if (start < 0) continue;
      const end = start + entity.alias.length + 1;
      if (hits.some((hit) => start < hit.end && end > hit.start)) continue;
      hits.push({ entity, start, end });
    }
    for (const exhibit of COLLECTION.exhibits) {
      const start = padded.indexOf(` ${exhibit.id.toLocaleLowerCase()} `);
      if (start >= 0 && !hits.some((hit) => start < hit.end && start + 4 > hit.start)) {
        hits.push({ entity: { alias: exhibit.id.toLocaleLowerCase(), exhibit }, start, end: start + 4 });
      }
    }
    hits.sort((a, b) => a.start - b.start);
    const out: NamedEntity[] = [];
    for (const { entity } of hits) {
      const duplicate = out.some((seen) => (entity.project ? seen.project?.id === entity.project.id : !seen.project && seen.exhibit.id === entity.exhibit.id));
      if (!duplicate) out.push(entity);
    }
    return out;
  }

  /** Side-by-side answer for two exhibits or projects, from their own records only. */
  private compare(padded: string): GuideReply | null {
    const named = this.namedEntities(padded);
    if (named.length === 0) return null;
    if (named.length === 1) {
      const only = named[0];
      const families = new Set((only.project ? [only.project] : projectsForExhibit(only.exhibit.id)).map((project) => project.family));
      const kin = COLLECTION.exhibits.filter((exhibit) => exhibit.id !== only.exhibit.id
        && projectsForExhibit(exhibit.id).some((project) => families.has(project.family))).slice(0, 3);
      const title = only.project?.name ?? only.exhibit.title;
      return {
        text: `Name two exhibits or projects and I will set them side by side. ${kin.length > 0
          ? `Rooms that share a project family with ${title}: ${listNames(kin.map((exhibit) => exhibit.title))}.`
          : `No other room shares a project family with ${title}.`}`,
        actions: kin.map((exhibit) => this.action(exhibit)),
      };
    }
    const [a, b] = named;
    if (a.project && b.project) return this.compareProjects(a.project, a.exhibit, b.project, b.exhibit);
    return this.compareExhibits(a.exhibit, b.exhibit);
  }

  private compareProjects(a: ProjectRecord, aHost: ExhibitRecord, b: ProjectRecord, bHost: ExhibitRecord): GuideReply {
    const line = (project: ProjectRecord, host: ExhibitRecord) => `${project.name} is ${articled(project.kind)} in the ${project.family} family, status “${project.status}”, shown in ${host.title} (${WINGS_BY_ID.get(host.wing)!.name}). ${project.summary}`;
    const together = aHost.id === bHost.id
      ? `Both are kept in the same room, ${aHost.title}.`
      : a.family === b.family ? `They share the ${a.family} family but are shown in different rooms.` : 'They come from different project families.';
    return {
      text: `${line(a, aHost)} ${line(b, bHost)} ${together}`,
      actions: aHost.id === bHost.id ? [this.action(aHost)] : [this.action(aHost), this.action(bHost)],
    };
  }

  private compareExhibits(a: ExhibitRecord, b: ExhibitRecord): GuideReply {
    if (a.id === b.id) return this.forExhibit(a);
    const line = (exhibit: ExhibitRecord) => {
      const wing = WINGS_BY_ID.get(exhibit.wing)!;
      const projects = projectsForExhibit(exhibit.id);
      return `${exhibit.title} (${wing.name}, ${wing.level === 0 ? 'ground level' : 'upper level'}) holds ${projects.length === 1 ? `one project, ${stageLabel(projects[0])}` : `${projects.length} projects — ${stageSummary(projects)}`}. ${exhibit.copy.plaque}`;
    };
    const aFamilies = new Set(projectsForExhibit(a.id).map((project) => project.family));
    const shared = [...new Set(projectsForExhibit(b.id).map((project) => project.family).filter((family) => aFamilies.has(family)))];
    const place = a.wing === b.wing ? `Both are in ${WINGS_BY_ID.get(a.wing)!.name}.` : `They are in different wings.`;
    const kinship = shared.length > 0 ? `They share the ${listNames(shared)} ${shared.length === 1 ? 'family' : 'families'}.` : 'They share no project family.';
    const opened = [a, b].filter((exhibit) => this.journal.hasVisited(exhibit.id)).map((exhibit) => exhibit.title);
    return {
      text: `${line(a)} ${line(b)} ${place} ${kinship}${opened.length > 0 ? ` Your journal records ${listNames(opened)} as opened.` : ''}`,
      actions: [this.action(a), this.action(b)],
    };
  }

  /** How the projects kept in one room differ: each one's own stage, status line and lesson. */
  private roomStory(padded: string): GuideReply | null {
    const named = this.namedEntities(padded)[0];
    const hereId = this.location?.()?.exhibitId ?? null;
    const exhibit = named?.exhibit ?? (hereId ? EXHIBITS_BY_ID.get(hereId) : undefined);
    if (!exhibit) {
      if (!/ (here|this room|this exhibit|this bay) /.test(padded)) return null;
      return this.reply('You are not standing in an exhibit bay just now. Walk into one and ask again, or name the exhibit, and I will set out how its projects differ.');
    }
    const projects = projectsForExhibit(exhibit.id);
    if (projects.length === 1) {
      const [project] = projects;
      return {
        text: `${exhibit.title} holds a single project, ${project.name} (${stageLabel(project)}; its status line reads “${project.status}”). Its lesson: ${project.lesson}`,
        actions: [this.action(exhibit)],
      };
    }
    const lines = projects.map((project) => `${project.name} — ${stageLabel(project)} (“${project.status}”): ${project.lesson}`);
    return {
      text: `${exhibit.title} holds ${projects.length} projects; by their own records, ${stageSummary(projects)}. ${lines.join(' ')} The museum keeps no dates finer than each project's period, so this is not a timeline.`,
      actions: [this.action(exhibit)],
    };
  }

  /** The closest rooms on the visitor's own floor, by walking distance on the guide's routes. */
  private nearby(): GuideReply {
    const here = this.location?.();
    const at = here?.position;
    if (!at) return this.reply('Inside the museum I can tell you which rooms are nearest to where you stand. Ask again once you are through the doors.');
    const [x, y, z] = at;
    if (y < GROUND_Y - 1) return this.reply('No exhibit is on the lower level: the Dexter Sanctuary stands apart from the collection. Walk back up the ramp to the Rotunda, where every hall begins.');
    const sameFloor = PLACEMENTS.filter((placement) => Math.abs(placement.anchor[1] - y) < 3 && placement.exhibitId !== here.exhibitId);
    const closest = sameFloor
      .map((placement) => ({ placement, straight: Math.hypot(placement.visitorSpot[0] - x, placement.visitorSpot[2] - z) }))
      .sort((a, b) => a.straight - b.straight || a.placement.exhibitId.localeCompare(b.placement.exhibitId))
      .slice(0, 6)
      .map(({ placement }) => ({ exhibit: EXHIBITS_BY_ID.get(placement.exhibitId)!, metres: Math.round(exhibitWalkDistance(at, placement.exhibitId)) }))
      .filter((entry) => entry.exhibit)
      .sort((a, b) => a.metres - b.metres || a.exhibit.id.localeCompare(b.exhibit.id))
      .slice(0, 3);
    if (closest.length === 0) return this.reply('No exhibit is on this floor near you. Ask for a wing and I will tell you how to reach it.');
    const lines = closest.map(({ exhibit, metres }) => `${exhibit.title} in ${WINGS_BY_ID.get(exhibit.wing)!.name}, about ${Math.max(1, metres)} m on foot${this.journal.hasVisited(exhibit.id) ? ' (opened)' : ' (not yet opened)'}`);
    return {
      text: `Nearest to you on the ${y >= LEVEL_1_Y - 2 ? 'upper' : 'ground'} floor: ${lines.join('; ')}.`,
      actions: closest.map(({ exhibit }) => this.action(exhibit)),
    };
  }

  /** Corrects words one or two letters away from the collection's own vocabulary. */
  private respell(query: string): { query: string; changes: [string, string][] } | null {
    const known = this.vocabulary();
    const changes: [string, string][] = [];
    const words = query.split(' ').map((word) => {
      if (word.length < 5 || STOPWORDS.has(word) || known.has(word) || known.has(stem(word))) return word;
      const limit = word.length >= 8 ? 2 : 1;
      let best: string | null = null;
      let bestDistance = limit + 1;
      for (const candidate of known) {
        if (Math.abs(candidate.length - word.length) > limit) continue;
        const distance = editDistance(word, candidate, limit);
        if (distance < bestDistance || (distance === bestDistance && best !== null && candidate < best)) {
          best = candidate;
          bestDistance = distance;
        }
      }
      if (!best || bestDistance > limit) return word;
      changes.push([word, best]);
      return best;
    });
    return changes.length > 0 ? { query: words.join(' '), changes } : null;
  }

  private vocabularyCache: Set<string> | null = null;
  private vocabulary(): Set<string> {
    if (this.vocabularyCache) return this.vocabularyCache;
    const words = new Set<string>();
    for (const entity of this.entities) for (const word of entity.alias.split(' ')) if (word.length >= 4) words.add(word);
    for (const entry of this.index) for (const term of entry.terms.keys()) if (term.length >= 4) words.add(term);
    for (const wing of COLLECTION.wings) for (const word of normalise(wing.name).split(' ')) if (word.length >= 4) words.add(word);
    this.vocabularyCache = words;
    return words;
  }

  /** No exhibit answers every word: name what each word does find on its own. */
  private partialMatches(query: string): GuideReply | null {
    const asked = [...new Set(termsOf(query))];
    if (asked.length < 2) return null;
    const perTerm: { term: string; exhibits: ExhibitRecord[] }[] = [];
    for (const term of asked) {
      const candidates = [term, ...(SYNONYMS[term] ?? []).map(stem)];
      const exhibits = this.index
        .map((entry) => ({ entry, weight: Math.max(0, ...candidates.map((candidate) => entry.terms.get(candidate)?.weight ?? 0)) }))
        .filter(({ weight }) => weight >= 2)
        .sort((a, b) => b.weight - a.weight || a.entry.exhibit.id.localeCompare(b.entry.exhibit.id))
        .slice(0, 3)
        .map(({ entry }) => entry.exhibit);
      if (exhibits.length > 0) perTerm.push({ term, exhibits });
    }
    if (perTerm.length === 0) return null;
    const missing = asked.filter((term) => !perTerm.some((entry) => entry.term === term));
    const actions: GuideAction[] = [];
    for (const { exhibits } of perTerm) for (const exhibit of exhibits) if (!actions.some((action) => action.exhibitId === exhibit.id) && actions.length < 4) actions.push(this.action(exhibit));
    return {
      text: `Nothing in the collection answers “${asked.join(' ')}” all together. ${perTerm.map(({ term, exhibits }) => `For “${term}”: ${listNames(exhibits.map((exhibit) => exhibit.title))}.`).join(' ')}`
        + (missing.length > 0 ? ` The collection has nothing for “${missing.join('”, “')}”.` : ''),
      actions,
    };
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

  /** Stair directions from where the visitor actually stands. */
  private verticalDirections(): string | null {
    const at = this.location?.()?.position;
    if (!at) return null;
    const [x, y] = at;
    const east = x >= 0;
    const media = WINGS_BY_ID.get('media')?.name ?? 'the media wing';
    const infra = WINGS_BY_ID.get('infra')?.name ?? 'the infrastructure wing';
    if (y >= LEVEL_1_Y - 2) {
      return `You are on the upper floor. The way down is a grand stair at either end of the balcony: the west end, beside ${media}, and the east end, beside ${infra}. The ${east ? 'east' : 'west'} end is nearer. Step into the stair at its open end — the well is railed — and it winds down the Rotunda wall to the ground floor. Signs on the wall say “Stairs down to the Rotunda”.`;
    }
    if (y < GROUND_Y - 1) {
      return 'You are on the lower level, in or near the Dexter Sanctuary. Walk back up its ramp to the Rotunda; the two grand stairs to the upper floor start at the Rotunda’s south-west and south-east walls, either side of the entrance hall arch.';
    }
    return `You are on the ground floor. The two grand stairs start at the Rotunda’s south-west and south-east walls, either side of the entrance hall arch, and wind up to the balcony; the ${east ? 'south-east' : 'south-west'} one is on your side. Signs at their feet name the upper wings: ${media} and ${infra}.`;
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
