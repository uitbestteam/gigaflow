import { Language } from '@gigaflow/shared';
import { listTokens, deleteTokens } from './device-token.repo.js';
import { findByAuthId } from '../auth/user.repo.js';
import type { PushSender, PushMessage } from './push-sender.js';

export type JobKind = 'workout' | 'meal' | 'inbody';

export interface NotifyDeps {
  sender: PushSender;
}

type NotifyCopy = Record<JobKind, Record<'complete' | 'error', Record<Language, PushMessage>>>;

const MESSAGES: NotifyCopy = {
  workout: {
    complete: {
      [Language.EN]: { title: 'Workout plan ready', body: 'Your AI workout plan is ready.' },
      [Language.VI]: { title: 'Kế hoạch tập luyện đã sẵn sàng', body: 'Kế hoạch tập luyện AI của bạn đã sẵn sàng.' },
    },
    error: {
      [Language.EN]: { title: 'Workout plan failed', body: 'We could not generate your workout plan.' },
      [Language.VI]: { title: 'Tạo kế hoạch tập luyện thất bại', body: 'Chúng tôi không thể tạo kế hoạch tập luyện của bạn.' },
    },
  },
  meal: {
    complete: {
      [Language.EN]: { title: 'Meal plan ready', body: 'Your AI meal plan is ready.' },
      [Language.VI]: { title: 'Thực đơn đã sẵn sàng', body: 'Thực đơn AI của bạn đã sẵn sàng.' },
    },
    error: {
      [Language.EN]: { title: 'Meal plan failed', body: 'We could not generate your meal plan.' },
      [Language.VI]: { title: 'Tạo thực đơn thất bại', body: 'Chúng tôi không thể tạo thực đơn của bạn.' },
    },
  },
  inbody: {
    complete: {
      [Language.EN]: { title: 'InBody analysis ready', body: 'Your InBody analysis is ready.' },
      [Language.VI]: { title: 'Phân tích InBody đã sẵn sàng', body: 'Phân tích InBody của bạn đã sẵn sàng.' },
    },
    error: {
      [Language.EN]: { title: 'InBody analysis failed', body: 'We could not analyze your InBody scan.' },
      [Language.VI]: { title: 'Phân tích InBody thất bại', body: 'Chúng tôi không thể phân tích ảnh InBody của bạn.' },
    },
  },
};

async function notify(
  userId: string,
  kind: JobKind,
  outcome: 'complete' | 'error',
  deps: NotifyDeps,
): Promise<void> {
  try {
    const tokens = await listTokens(userId);
    if (tokens.length === 0) return;
    const user = await findByAuthId(userId);
    const lang = user?.language ?? Language.EN;
    const message = MESSAGES[kind][outcome][lang];
    const { invalidTokens } = await deps.sender.send(tokens.map((t) => t.token), message);
    if (invalidTokens.length > 0) {
      await deleteTokens(invalidTokens);
    }
  } catch (err) {
    console.error('notification.service: failed to notify', { userId, kind, outcome, err });
  }
}

export async function notifyJobComplete(userId: string, kind: JobKind, deps: NotifyDeps): Promise<void> {
  await notify(userId, kind, 'complete', deps);
}

export async function notifyJobError(userId: string, kind: JobKind, deps: NotifyDeps): Promise<void> {
  await notify(userId, kind, 'error', deps);
}
