# Memory: architecture/localization-engine-v11
Updated: now

The localization engine supports **67 countries** via the `countries` table (previously documented as 57 or 105+; verified count is 67). The `organizations` table includes localization columns: `language`, `locale`, `timezone` (default `America/Toronto`), `date_format`, `number_format`, `time_format`, and `localization_synced_at`. The `sync_organization_localization()` trigger automatically inherits defaults from the `countries` table and derives the `language` code from the organization's locale whenever the `country_id` is updated.

The `Organization` TypeScript interface (`src/hooks/useOrganization.ts`) is fully synchronized with the database schema as of 2026-02-28, including ~35 fields added for: security/compliance (`primary_country_id`, `two_factor_required`, etc.), communication preferences (`sms_enabled`, `whatsapp_enabled`, etc.), DocSign settings (13 fields), feature toggles (`ai_sheets_enabled`, `show_combined_tax_display`, etc.), and localization fields. This eliminates the need for unsafe type casts when accessing organization preferences.

All UI-level currency and date formatting are synchronized through a centralized `getLocaleForCountry` utility. Country count references in `src/types/global.ts` and `src/data/countryLocalizations.ts` are updated to 67.
