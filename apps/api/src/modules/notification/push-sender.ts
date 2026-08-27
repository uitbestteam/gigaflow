import { getMessaging } from 'firebase-admin/messaging';
import { getFirebaseApp } from '../../lib/firebase.js';

export interface PushMessage {
  title: string;
  body: string;
  data?: Record<string, string>;
}

export interface PushSendResult {
  invalidTokens: string[];
}

export interface PushSender {
  send(tokens: string[], message: PushMessage): Promise<PushSendResult>;
}

const INVALID_TOKEN_ERROR_CODES = new Set([
  'messaging/registration-token-not-registered',
  'messaging/invalid-argument',
]);

export class FcmPushSender implements PushSender {
  async send(tokens: string[], message: PushMessage): Promise<PushSendResult> {
    if (tokens.length === 0) return { invalidTokens: [] };
    const result = await getMessaging(getFirebaseApp()).sendEachForMulticast({
      tokens,
      notification: { title: message.title, body: message.body },
      data: message.data,
    });
    const invalidTokens = result.responses
      .map((response, index) => ({ response, token: tokens[index] }))
      .filter(
        ({ response }) =>
          !response.success &&
          response.error !== undefined &&
          INVALID_TOKEN_ERROR_CODES.has(response.error.code),
      )
      .map(({ token }) => token)
      .filter((token): token is string => token !== undefined);
    return { invalidTokens };
  }
}
