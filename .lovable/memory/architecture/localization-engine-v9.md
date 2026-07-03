# Memory: architecture/localization-engine-v9
Updated: 2026-02-08

The localization engine supports 57 countries (including North America, Europe, Africa, Middle East, Asia-Pacific, and Uganda) via the 'countries' table. 

## Organization Localization Fields

The 'organizations' table includes specific preference columns:
- `date_format` - Date formatting pattern (e.g., 'MM/DD/YYYY', 'DD/MM/YYYY')
- `number_format` - Number formatting pattern (e.g., '1,234.56', '1.234,56')
- `time_format` - Time format ('12h' or '24h')
- `timezone` - IANA timezone (e.g., 'America/Toronto', 'UTC')
- `locale` - BCP 47 locale code (e.g., 'en-CA', 'fr-FR')
- `currency` - ISO 4217 currency code (e.g., 'CAD', 'USD')

## Country Defaults

The 'countries' table includes:
- `date_format`, `number_format`, `time_format` - Formatting defaults
- `default_timezone` - Default IANA timezone for the country
- `default_currency` - ISO 4217 currency code
- `default_locale` - BCP 47 locale code (e.g., 'en-US', 'en-CA', 'fr-FR')

## Automatic Sync Trigger

The `sync_organization_localization()` trigger automatically inherits country defaults whenever an organization's `country_id` is set or changed:
- Only syncs fields that are NULL (doesn't override user preferences)
- Sets `localization_synced_at` timestamp when sync occurs
- Syncs: `date_format`, `number_format`, `time_format`, `timezone`, `currency`

## E.164 Phone Normalization

E.164 normalization for phone numbers is handled via `normalize_phone_e164` to ensure cross-module consistency in messaging and voice routing.
