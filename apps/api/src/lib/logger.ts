export type LogLevel = 'info' | 'warn' | 'error';

export function log(level: LogLevel, message: string, fields?: Record<string, unknown>): void {
  const entry = {
    level,
    message,
    ts: new Date().toISOString(),
    ...fields,
  };
  process.stdout.write(`${JSON.stringify(entry)}\n`);
}
