import { getMessaging } from 'firebase-admin/messaging';
import { getFirebaseApp } from '../../lib/firebase.js';

export interface PushMessage {
  title: string;
  body: string;
  data?: Record<string, string>;
}

export interface PushSender {
  send(tokens: string[], message: PushMessage): Promise<void>;
}

export class FcmPushSender implements PushSender {
  async send(tokens: string[], message: PushMessage): Promise<void> {
    if (tokens.length === 0) return;
    await getMessaging(getFirebaseApp()).sendEachForMulticast({
      tokens,
      notification: { title: message.title, body: message.body },
      data: message.data,
    });
  }
}
