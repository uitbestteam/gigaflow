import { describe, it, expect } from 'vitest';
import { zTranslatable, zObjectId, apiSuccess, Language } from '../index';

describe('shared schemas', () => {
  it('accepts a valid translatable', () => {
    const r = zTranslatable.safeParse({ en: 'Bench', vi: 'Đẩy ngực' });
    expect(r.success).toBe(true);
  });
  it('rejects a translatable missing vi', () => {
    const r = zTranslatable.safeParse({ en: 'Bench' });
    expect(r.success).toBe(false);
  });
  it('validates 24-hex object id', () => {
    expect(zObjectId.safeParse('651f1f77bcf86cd799439011').success).toBe(true);
    expect(zObjectId.safeParse('not-an-id').success).toBe(false);
  });
  it('wraps data in success envelope', () => {
    expect(apiSuccess({ x: 1 }, 'ok')).toEqual({ success: true, data: { x: 1 }, message: 'ok' });
  });
  it('exposes Language enum', () => {
    expect(Language.VI).toBe('vi');
  });
});
