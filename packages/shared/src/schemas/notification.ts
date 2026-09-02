import { z } from 'zod';
import { DevicePlatform } from '../enums/index.js';

export const zRegisterDeviceTokenInput = z.object({
  token: z.string().min(1),
  platform: z.nativeEnum(DevicePlatform).optional(),
});

export type RegisterDeviceTokenInput = z.infer<typeof zRegisterDeviceTokenInput>;

export const zDeviceToken = z.object({
  id: z.string(),
  userId: z.string(),
  token: z.string(),
  platform: z.nativeEnum(DevicePlatform).optional(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});

export type DeviceToken = z.infer<typeof zDeviceToken>;
