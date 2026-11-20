/**
 * A visitor-facing reading of a project's free-text `status`. The canonical
 * status string is never rewritten or replaced: it is shown alongside this
 * stage, which only groups it so a visitor can tell a living project from an
 * experiment, a pause, a finished work or a superseded line at a glance.
 */
export type ProjectStage = 'active' | 'experimental' | 'paused' | 'completed' | 'superseded' | 'abandoned';

export const PROJECT_STAGE_LABEL: Readonly<Record<ProjectStage, string>> = {
  active: 'Active',
  experimental: 'Experimental',
  paused: 'Paused',
  completed: 'Completed',
  superseded: 'Superseded',
  abandoned: 'Abandoned',
};

/** First matching word wins, in this order: the most specific state first. */
const RULES: readonly [RegExp, ProjectStage][] = [
  [/\babandoned\b/i, 'abandoned'],
  [/\bsuperseded\b/i, 'superseded'],
  [/\bpaused\b/i, 'paused'],
  [/^\s*completed\b/i, 'completed'],
  [/^\s*experimental\b/i, 'experimental'],
  [/\bactive\b/i, 'active'],
];

export function projectStage(status: string): ProjectStage | null {
  for (const [pattern, stage] of RULES) if (pattern.test(status)) return stage;
  return null;
}

/** "Name (paused)" — a project name with its lifecycle stage for index lists.
 * Active projects are left plain so the exceptions stand out. */
export function projectNameWithStage(project: { readonly name: string; readonly status: string }): string {
  const stage = projectStage(project.status);
  return stage && stage !== 'active' ? `${project.name} (${PROJECT_STAGE_LABEL[stage].toLocaleLowerCase()})` : project.name;
}
