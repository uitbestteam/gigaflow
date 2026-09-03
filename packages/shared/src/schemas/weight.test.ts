import { describe, it, expect } from 'vitest';
import { zLogWeightInput, zWeightLog } from '../index.js';

describe('weight schemas', () => {
  it('accepts a valid log input without loggedAt', () => {
    expect(zLogWeightInput.safeParse({ weightKg: 70.5 }).success).toBe(true);
  });

  it('accepts a valid log input with loggedAt', () => {
    const result = zLogWeightInput.safeParse({ weightKg: 70.5, loggedAt: '2024-01-01T00:00:00.000Z' });
    expect(result.success).toBe(true);
  });

  it('rejects a non-positive weight', () => {
    expect(zLogWeightInput.safeParse({ weightKg: 0 }).success).toBe(false);
    expect(zLogWeightInput.safeParse({ weightKg: -5 }).success).toBe(false);
  });

  it('rejects a missing weight', () => {
    expect(zLogWeightInput.safeParse({}).success).toBe(false);
  });

  it('parses a full weight log', () => {
    const log = {
      id: '507f1f77bcf86cd799439011',
      userId: 'u1',
      weightKg: 70.5,
      loggedAt: new Date(),
      createdAt: new Date(),
    };
    expect(zWeightLog.safeParse(log).success).toBe(true);
  });

  it('rejects a weight log with non-positive weight', () => {
    const log = {
      id: '507f1f77bcf86cd799439011',
      userId: 'u1',
      weightKg: 0,
      loggedAt: new Date(),
      createdAt: new Date(),
    };
    expect(zWeightLog.safeParse(log).success).toBe(false);
  });

  it('coerces ISO date strings for loggedAt/createdAt into Date instances', () => {
    const log = {
      id: '507f1f77bcf86cd799439011',
      userId: 'u1',
      weightKg: 70.5,
      loggedAt: '2026-01-15T10:30:00.000Z',
      createdAt: '2026-01-15T10:30:00.000Z',
    };
    const result = zWeightLog.safeParse(log);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.loggedAt).toBeInstanceOf(Date);
      expect(result.data.createdAt).toBeInstanceOf(Date);
    }
  });

  it('still accepts real Date instances for loggedAt/createdAt', () => {
    const log = {
      id: '507f1f77bcf86cd799439011',
      userId: 'u1',
      weightKg: 70.5,
      loggedAt: new Date(),
      createdAt: new Date(),
    };
    const result = zWeightLog.safeParse(log);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.loggedAt).toBeInstanceOf(Date);
      expect(result.data.createdAt).toBeInstanceOf(Date);
    }
  });
});
