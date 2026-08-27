import { FcmPushSender, type PushSender } from './push-sender.js';

export function buildPushSender(): PushSender {
  return new FcmPushSender();
}
