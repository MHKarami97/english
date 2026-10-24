# Persian localization review

This release adds a Persian interface, English content isolation, RTL layout support, a persisted language preference, and localized backup errors. The default interface language is Persian; English remains available in Settings.

## Localized areas

Navigation, offline banner, update prompts, accessibility labels, Home, Library, Units, Word detail, Favorites, Today, Review, Flashcards, Study, Practice, Quiz, Matching, Placement, Mistakes, Search, Settings, import/export dialogs, confirmation dialogs, quiz instructions, feedback, results, and backup validation errors.

## Language behavior

The selected language is stored in Dexie under `uiLanguage` and mirrored in `localStorage`. `initLocale()` runs before app mount, preventing a language flash. Switching language updates `<html lang>`, `<html dir>`, the document title, and interface strings. Book words, definitions, examples, IPA, and unit titles remain English.

## RTL rules

The document direction is controlled by `directionOf(locale)`. Layout uses logical CSS properties. Directional icons use `rtl:-scale-x-100`. English content is wrapped in `<bdi lang="en" dir="ltr">`; numeric fields use `dir="ltr"`. The flashcard flip direction is mirrored in RTL, and physical arrow keys in Study follow the visual card order.

## CI

`.github/workflows/ci.yml` runs on pushes and pull requests targeting `main`: lint, typecheck, tests, and build. It uses Node 22.12 and npm dependency caching. It does not deploy; deployment remains handled by `deploy.yml`.

## Manual QA checklist

- Switch Persian to English and back; reload and confirm persistence.
- Check `<html lang>` and `<html dir>` after switching.
- Review a unit in Persian; English words, definitions, and examples remain LTR.
- Use Space, 1-4, Enter, P, U, and arrow keys in Review and Quiz.
- Test swipe gestures in Study in Persian.
- Run a placement test and apply its result.
- Export a backup, import it in merge mode, then test invalid JSON.
- Check Search with Persian and English queries.
- Check mobile navigation, bottom action areas, and safe-area insets.

## Known follow-ups

`BackupError` messages are code-based; consumers expecting English `error.message` should use `error.code`. A future improvement could add the language switcher to the top bar. Swipe gesture semantics in `FlashCard.vue` should be manually verified after the RTL flip change.
