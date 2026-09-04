# GigaFlow web — Neon Energy redesign brief

Mobile-first redesign. Dark base, vibrant neon gradients, heavy but tasteful
motion. **Restyle only** — do NOT change data flow, query keys, API calls,
props contracts, or i18n keys' meaning. Keep all existing functionality and
tests' behavior; update only class-based/style assertions you break.

## Visual language

- **Base** is dark (`bg-bg` ≈ near-black blue). Surfaces: `bg-surface`,
  `bg-surface-2`, `bg-surface-3` (increasing elevation).
- **Primary accent** = neon gradient blue→violet→magenta. Use `bg-grad-primary`
  for hero/CTA fills, `text-gradient` for headline words, `.gradient-border`
  (via `<Card variant="glow">`) for standout cards. Don't gradient everything —
  one focal gradient per screen; supporting elements stay flat surfaces.
- **Muscle/section identity colors** (already tokens): `push`/`grad-push` (rose),
  `pull`/`grad-pull` (green), `legs`/`grad-legs` (amber), `core`/`grad-core`
  (cyan). Use these to color-code workout content.
- **Radii**: `rounded-md` (14px) default, `rounded-lg` (20px) cards/sheets,
  `rounded-pill` for chips/toggles. **Shadows**: `shadow-card`, and
  `shadow-glow-accent`/`shadow-glow-blue` for glowing focal elements.
- Numbers use `tnum` (tabular). Headlines: `font-extrabold tracking-tight`.

## Layout rules (mobile-first)

- The frame (`MainLayout`) already provides a centered ≤520px column, a glassy
  sticky header, and a bottom tab bar. Pages render INSIDE that — do **not** add
  your own header/nav/tab bar, and do not add horizontal page scroll.
- Design for a 375px-wide phone first. Touch targets ≥44px (`min-h-11`).
  Bottom of page has `pb-24` room already for the nav; long lists are fine.
- Wide/overflowing content (charts, tables) scrolls inside its own
  `overflow-x-auto` container, never the page body.
- Empty / loading / error states must be redesigned too (use `Skeleton` /
  `SkeletonList` for loading, a friendly gradient-icon empty state, a retry
  button on error).

## Components to use (shared — do NOT edit these files)

- `Button` (`variant`: `solid` gradient CTA | `ghost` | `outline` | `danger`;
  `size`: `sm|md|lg`; `fullWidth`). Default solid is the neon CTA.
- `Card` (`variant`: `default` | `glow` gradient-border | `flat`).
- `motion.tsx`: `PageTransition` (already applied by layout — don't re-wrap),
  `FadeIn`, `Stagger` + `StaggerItem` (list reveals), `Pressable` (tap-scale
  wrapper for big tappable cards/tiles).
- `icons.tsx`: stroke icons (`HomeIcon`, `DumbbellIcon`, `SparklesIcon`,
  `UtensilsIcon`, `ChartIcon`, `FlameIcon`, `PlusIcon`, `CheckIcon`,
  `ChevronRightIcon`, `ArrowLeftIcon`, `BellIcon`, `CameraIcon`, `UserIcon`,
  `GoogleIcon`). Size via `width`/`height`; color via `text-*`.
- `ProgressRing` (gradient ring, `value` 0–1, centered `children`).
- `Skeleton` / `SkeletonList`.

## Motion (make it feel alive, respect reduced-motion — framer-motion handles it)

- Reveal page sections with `FadeIn` / `Stagger`+`StaggerItem` on mount.
- Tappable cards/tiles: wrap in `Pressable` (or add `active:scale-[0.97]`).
- Animate meaningful values: counts via a count-up, bars/rings via CSS width/
  dash transitions. Add a celebratory pop (`animate-pop`) on completion moments
  (e.g. finishing a set/session). Keep it smooth on low-end phones — no
  never-ending heavy loops except subtle `animate-gradient`/`animate-pulse-glow`
  on a single focal element.

## i18n

- All user-facing copy MUST go through `t('…')` (react-i18next). If you need new
  copy, add the key to BOTH `src/i18n/en.ts` and `src/i18n/vi.ts` AND the
  `TranslationSchema` interface in `en.ts`. Never hardcode English or Vietnamese
  strings in TSX. Match existing key grouping.

## Quality bar / definition of done

- `pnpm --filter @gigaflow/web exec tsc --noEmit` passes.
- Your feature's tests pass: `pnpm --filter @gigaflow/web test -- run <paths>`.
- No `any`, keep TS strict, `.js` import extensions where the file already uses
  them, follow surrounding code style.
- Only touch the files you were assigned. Do not modify shared shell/token files
  or another agent's files.
