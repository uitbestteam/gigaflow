/**
 * `@gigaflow/shared` exports the `zTranslatable` Zod *schema* but not a
 * `Translatable` *type* (see `packages/shared/src/schemas/common.ts`), so
 * this interface structurally mirrors it — no `any`, no shared-package
 * changes needed.
 */
export interface Translatable {
  en: string;
  vi: string;
}

/**
 * Resolves a `Translatable` value to a plain string for the active
 * language. Defaults to `en` for anything that isn't Vietnamese (including
 * locale variants like `en-US`), consistent with the app's i18next setup.
 *
 * Shared across features (HomePage, ActiveSessionPage, ...) so the
 * Translatable→string resolution logic lives in exactly one place.
 */
export function resolveTranslatable(value: Translatable, language: string): string {
  return language.startsWith('vi') ? value.vi : value.en;
}
