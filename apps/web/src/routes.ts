/** Path constants for the app router (`App.tsx`) — the single source of truth for route strings. */
export const ROUTES = {
  home: '/',
  session: '/session/:id',
  sessionSummary: '/session/:id/summary',
  account: '/account',
  exercises: '/exercises',
  plans: '/plans',
  planNew: '/plans/new',
  planEdit: '/plans/:id/edit',
  generate: '/generate',
  meal: '/meal',
} as const;

export function sessionPath(id: string): string {
  return `/session/${id}`;
}

export function sessionSummaryPath(id: string): string {
  return `/session/${id}/summary`;
}

/** Path to the plan builder in "create" mode. Consumed by the T7 builder route. */
export function planNewPath(): string {
  return '/plans/new';
}

/** Path to the plan builder in "edit" mode for an existing plan. Consumed by the T7 builder route. */
export function planEditPath(id: string): string {
  return `/plans/${id}/edit`;
}
