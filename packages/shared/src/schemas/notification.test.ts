import { describe, it, expect } from 'vitest';
import { zRegisterDeviceTokenInput, zDeviceToken, DevicePlatform } from '../index';

describe('notification schemas', () => {
  it('accepts a token with platform', () => {
    expect(zRegisterDeviceTokenInput.safeParse({ token: 'abc', platform: DevicePlatform.ANDROID }).success).toBe(true);
  });
  it('accepts a token without platform', () => {
    expect(zRegisterDeviceTokenInput.safeParse({ token: 'abc' }).success).toBe(true);
  });
  it('rejects an empty token', () => {
    expect(zRegisterDeviceTokenInput.safeParse({ token: '' }).success).toBe(false);
  });
  it('rejects an unknown platform', () => {
    expect(zRegisterDeviceTokenInput.safeParse({ token: 'abc', platform: 'watch' }).success).toBe(false);
  });
});
