/** Path constants for the app router (`App.tsx`) — the single source of truth for route strings. */
export const ROUTES = {
  home: '/',
  session: '/session/:id',
  sessionSummary: '/session/:id/summary',
  account: '/account',
  exercises: '/exercises',
} as const;

export function sessionPath(id: string): string {
  return `/session/${id}`;
}

export function sessionSummaryPath(id: string): string {
  return `/session/${id}/summary`;
}
