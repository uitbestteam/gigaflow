# GigaFlow — Jira MCP Import Prompts

**Date:** 2026-08-26
**Mục đích:** Bộ prompt dán vào một agent đã kết nối **Jira qua MCP** để tạo **task board agile
đầy đủ** (project → epics → stories → sub-tasks → sprints → links) từ
`2026-08-26-gigaflow-features-spec.md`.
**Lưu ý:** File này CHỈ chứa prompt. Không tự chạy — bạn (hoặc agent Jira) thực thi.

---

## 0. Điều kiện tiên quyết

- Agent có quyền gọi Jira MCP (tạo issue, epic, sub-task, sprint, link, set field).
- Biết **project key** (ví dụ `GF`). Nếu chưa có project, tạo trước (Scrum, board Kanban/Scrum).
- Custom field **Story Points** tồn tại (Jira Cloud thường có sẵn ở Scrum). Nếu không, agent tạo/ánh xạ.
- Đặt file features spec ở nơi agent đọc được, hoặc dán nội dung kèm prompt.

> Trong mọi prompt bên dưới, thay `GF` bằng project key thật; thay tên board/sprint nếu cần.

---

## 1. Prompt — Khởi tạo cấu trúc board (chạy 1 lần)

```
Bạn là trợ lý quản trị Jira, thao tác qua Jira MCP. Thiết lập nền cho dự án "GigaFlow"
(project key: GF). Thực hiện:

1. Xác nhận project GF tồn tại (loại Scrum). Nếu chưa có, tạo project Scrum tên "GigaFlow", key GF.
2. Đảm bảo có issue types: Epic, Story, Sub-task, Bug.
3. Đảm bảo field "Story Points" khả dụng trên Story.
4. Tạo các Labels: backend, frontend, infra, ai, auth, design, test.
5. Tạo Components (nếu board dùng component): API, Web, Infra, AI, Design.
6. Tạo 6 Sprints trống tên: "Sprint 1" ... "Sprint 6" (chưa start).
7. Báo lại: project key, board id, sprint ids, và tên field Story Points thực tế.

KHÔNG tạo issue nội dung ở bước này. Chỉ dựng khung. Sau khi xong, in bảng tổng kết id.
```

---

## 2. Prompt — Tạo toàn bộ Epics

```
Dùng Jira MCP tạo 14 Epic sau trong project GF. Mỗi Epic đặt Summary theo "Mã — Tên",
Description ngắn theo mô tả, và Label chính. Trả về map {Mã Epic → Jira epic key} để dùng ở bước sau.

E1 — Foundation & Infrastructure | labels: infra,backend | Monorepo + GCP deploy + CI/CD.
E2 — Auth 3-mode (Firebase) | auth,backend,frontend | Guest anonymous → link Google/password, giữ uid.
E3 — Exercise Catalog | backend,frontend | Thư viện bài tập + custom exercise (guest tạo ngay).
E4 — Workout Plan & Templates | backend,frontend | Plan→Template→Slot, queue scheduling.
E5 — Active Session Logging & Progression | backend,frontend | Log 2-tap + prefill target.
E6 — Rest Timer & RIR | frontend,backend | Đếm rest + RIR optional mọi trình độ.
E7 — AI Workout Planner | ai,backend | AI engine Gemini-first, async Cloud Tasks, history-aware.
E8 — InBody OCR | ai,backend,frontend | Upload ảnh → OCR AI vision → metrics.
E9 — Meal Planner & TDEE | ai,backend,frontend | Thực đơn AI (chỉ Gemini) theo TDEE.
E10 — Notifications (FCM) | backend,frontend | Push khi job xong + nhắc tập.
E11 — Analytics, PR & Statistics | backend,frontend | PR, awards, thống kê.
E12 — Subscription & Quota | backend | Giới hạn AI; quota cơ bản cho guest & user.
E13 — UI/UX Design System | design,frontend | Dark data-forward, shadcn/ui + tokens.
E14 — Testing & Hardening | test,infra,backend | Unit/integration test, observability, prod.

In bảng {Mã Epic → epic key}.
```

---

## 3. Prompt — Tạo Stories cho một Epic (template lặp lại)

Dùng template này cho từng Epic. Nội dung story lấy từ `2026-08-26-gigaflow-features-spec.md`.

```
Trong project GF, tạo các Story dưới Epic {EPIC_KEY} (tương ứng {Mã Epic}). Với MỖI story:
- Summary = "Mã-Story — Tên" (vd "E5-S3 — Progression rule engine").
- Parent/Epic Link = {EPIC_KEY}.
- Description = phần mô tả + danh sách Acceptance Criteria (giữ định dạng Given/When/Then / AC1,AC2...).
- Story Points = số pt cho trong ngoặc.
- Priority: map P0→Highest, P1→High, P2→Medium, P3→Low.
- Labels = các label ghi ở story.
Nếu story ≥5pt, tạo Sub-task cho các bước kỹ thuật rõ ràng (schema, endpoint, UI, test) khi hợp lý.
Sau khi tạo, trả map {Mã story → issue key}.

Danh sách story của epic này:
<DÁN nguyên phần story của epic tương ứng từ features-spec.md>
```

> Lặp prompt trên 14 lần (mỗi epic), hoặc dùng prompt one-shot ở mục 5.

---

## 4. Prompt — Gán Sprint + tạo Dependency links

```
Trong project GF, thực hiện:

A) Gán story vào sprint theo bảng (dùng Mã story → issue key đã tạo):
- Sprint 1: tất cả story thuộc E1, và E13-S1, E13-S2.
- Sprint 2: tất cả story E2 và E12.
- Sprint 3: tất cả story E3 và E4.
- Sprint 4: tất cả story E5 và E6.
- Sprint 5: tất cả story E7 và E10.
- Sprint 6: tất cả story E8, E9, E11, E14. (E13-S3/S4 xếp Sprint 3 nếu còn chỗ.)

B) Tạo link "blocks / is blocked by" theo phụ thuộc epic:
- E2,E3 is blocked by E1.  E4 is blocked by E3.  E5 is blocked by E4.
- E6 is blocked by E5.  E7 is blocked by E4,E5.  E8 is blocked by E7-S1.
- E9 is blocked by E7-S1.  E10 is blocked by E2,E7.  E11 is blocked by E5.
- E12 is blocked by E2.  E7-S2 is blocked by E1-S9 (Cloud Tasks).

C) Story dùng AI (E7,E8,E9) thêm link tới E7-S1 (Unified AI engine) là "is blocked by".

In danh sách link đã tạo + story chưa gán được (nếu có).
```

---

## 5. Prompt — One-shot (nếu agent đọc được file trực tiếp)

```
Bạn là trợ lý Jira qua MCP. Đọc file:
docs/superpowers/specs/2026-08-26-gigaflow-features-spec.md

Từ nội dung đó, dựng ĐẦY ĐỦ board Scrum trong project GF:

1. Với mỗi "EPIC E<n> — <tên>" → tạo 1 Epic (Summary "E<n> — <tên>", description = dòng Goal,
   labels từ dòng Labels).
2. Với mỗi story "E<n>-S<m> — <tên> (<pt>pt, <P?>)" → tạo Story dưới đúng Epic:
   - Story Points = <pt>; Priority map P0→Highest,P1→High,P2→Medium,P3→Low;
   - Labels = các label sau tiêu đề story;
   - Description = mô tả + toàn bộ Acceptance Criteria (giữ nguyên AC/Given-When-Then).
3. Story ≥5pt: tự chẻ Sub-task hợp lý (schema/endpoint/UI/test).
4. Gán Sprint 1–6 theo bảng "Dependency / sprint gợi ý" cuối file.
5. Tạo link blocks/is-blocked-by theo mục "Depends on" của từng epic và ghi chú phụ thuộc.
6. KHÔNG bịa story ngoài file. Nếu thiếu thông tin (vd sprint id), hỏi lại trước khi tạo.

Sau khi hoàn tất, in báo cáo: số epic, số story, tổng story points mỗi sprint, và mọi link đã tạo.
Trước khi tạo hàng loạt, in DRY-RUN (danh sách sẽ tạo) và chờ tôi xác nhận "OK tạo".
```

---

## 6. Prompt — Bug/Task rời (khi cần thêm sau)

```
Trong GF, tạo <Bug|Task>: Summary "<...>", Priority <...>, Labels <...>, Epic Link <EPIC_KEY nếu có>,
Description gồm: bối cảnh, bước tái hiện (nếu bug), kết quả mong đợi, acceptance. Trả issue key.
```

---

## 7. Ghi chú vận hành

- **Thứ tự chạy:** Mục 1 → 2 → (3 lặp | hoặc 5 one-shot) → 4.
- Luôn yêu cầu agent **DRY-RUN + xác nhận** trước khi tạo hàng loạt (tránh tạo nhầm nhiều issue).
- Nếu Jira MCP không hỗ trợ tạo sprint/link: agent tạo issue trước, xuất CSV/JSON để import tay
  phần sprint/link, và báo lại giới hạn.
- Story points là ước lượng ban đầu — điều chỉnh khi refinement.
- Nguồn chân lý nội dung là `features-spec.md`; sửa story thì sửa file trước rồi đồng bộ Jira.
