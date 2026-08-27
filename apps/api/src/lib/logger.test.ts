import { describe, it, expect, vi, afterEach } from 'vitest';
import { log } from './logger';

describe('log', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('writes a single parseable JSON line with level, message, ts', () => {
    const spy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);

    log('info', 'hello world');

    expect(spy).toHaveBeenCalledTimes(1);
    const written = spy.mock.calls[0]?.[0] as string;
    expect(written.endsWith('\n')).toBe(true);
    const parsed = JSON.parse(written.trimEnd());
    expect(parsed.level).toBe('info');
    expect(parsed.message).toBe('hello world');
    expect(typeof parsed.ts).toBe('string');
    expect(new Date(parsed.ts).toISOString()).toBe(parsed.ts);
  });

  it('merges extra fields into the JSON line', () => {
    const spy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);

    log('error', 'boom', { requestId: 'abc-123', path: '/api/x', status: 500 });

    const written = spy.mock.calls[0]?.[0] as string;
    const parsed = JSON.parse(written.trimEnd());
    expect(parsed.level).toBe('error');
    expect(parsed.message).toBe('boom');
    expect(parsed.requestId).toBe('abc-123');
    expect(parsed.path).toBe('/api/x');
    expect(parsed.status).toBe(500);
  });

  it('supports warn level', () => {
    const spy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);

    log('warn', 'careful');

    const written = spy.mock.calls[0]?.[0] as string;
    const parsed = JSON.parse(written.trimEnd());
    expect(parsed.level).toBe('warn');
  });
});
