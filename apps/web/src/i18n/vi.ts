import type { TranslationSchema } from './en';

/**
 * Vietnamese catalog — mirrors the key shape of `en.ts` exactly (enforced
 * by the `TranslationSchema` type import) so both locales stay in sync.
 */
const vi: TranslationSchema = {
  common: {
    appName: 'GigaFlow',
    account: 'Tài khoản',
    retry: 'Thử lại',
    cancel: 'Hủy',
    save: 'Lưu',
    loading: 'Đang tải…',
  },
  auth: {
    splashLabel: 'Đang đăng nhập…',
    errorTitle: 'Đã có lỗi xảy ra',
    errorBody: 'Không thể đăng nhập.',
    retry: 'Thử lại',
    upgradeTitle: 'Lưu tiến trình của bạn',
    upgradeBody: 'Liên kết tài khoản để không mất lịch sử tập luyện.',
    continueWithGoogle: 'Tiếp tục với Google',
    emailLabel: 'Email',
    passwordLabel: 'Mật khẩu',
    upgradeWithEmail: 'Tạo tài khoản',
  },
  home: {
    title: 'Trang chủ',
    queueTitle: 'Sắp tới',
    queueEmpty: 'Chưa có buổi tập nào trong hàng chờ.',
    emptyStateTitle: 'Bắt đầu kế hoạch đầu tiên',
    emptyStateBody: 'Chọn một preset để bắt đầu ngay.',
    presetPpl: 'Đẩy / Kéo / Chân',
    presetUpperLower: 'Thân trên / Thân dưới',
    presetFullBody: 'Toàn thân',
    startSession: 'Bắt đầu buổi tập',
    loadError: 'Không thể tải kế hoạch của bạn.',
  },
  session: {
    title: 'Buổi tập đang diễn ra',
    restTimerTitle: 'Nghỉ',
    restTimerSkip: 'Bỏ qua nghỉ',
    rirLabel: 'RIR (số reps còn dư sức)',
    finish: 'Kết thúc buổi tập',
    cancel: 'Hủy buổi tập',
    logSet: 'Ghi set',
    prevSet: 'trước: {{weight}} × {{reps}}',
    pause: 'Tạm dừng',
    resume: 'Tiếp tục',
    rirEasy: 'Dễ (3 RIR)',
    rirModerate: 'Vừa (1 RIR)',
    rirHard: 'Khó (0 RIR)',
  },
  summary: {
    title: 'Tổng kết buổi tập',
    doneTitle: 'Hoàn thành buổi tập #{{n}}',
    duration: 'Thời lượng',
    totalVolume: 'Tổng khối lượng',
    newPr: 'Kỷ lục mới',
    backHome: 'Về trang chủ',
    prBadge: 'PR',
    setsAvg: '{{count}} set · TB {{avg}}kg',
  },
};

export default vi;
