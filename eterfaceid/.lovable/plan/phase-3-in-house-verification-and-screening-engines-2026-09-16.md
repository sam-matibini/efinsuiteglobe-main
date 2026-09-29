# Phase 3 — In-house verification and screening engines

Goal: eterfaceID does its own work. Screening and identity checks run on our own
data and our own code, with no per-check vendor fee. Outside services are
optional add-ons you can switch on later, never the thing the product depends on.

## Part 1 — Own sanctions, PEP and watchlist engine

Build our own list warehouse and matching engine.

- A list warehouse that ingests free official sources: Canada OSFI consolidated
  list, Canada SEMA/Justice lists, UN Security Council consolidated, US OFAC SDN
  and consolidated, EU consolidated, UK HMT, plus open PEP and watchlist data.
  Each record keeps its source, list version, publication date and every known
  alias, date of birth, nationality and address.
- A refresh job that re-downloads each source on a schedule, versions it, and
  records what changed since the previous version. Nothing is silently
  overwritten — old versions stay for audit.
- Our own name-matching engine: normalisation (accents, case, punctuation,
  company suffixes), transliteration for non-Latin names, token-level fuzzy
  comparison, nickname and initial handling, date-of-birth and country
  proximity, and a transparent score with the reasons that produced it. Every
  hit shows why it matched, which is what an examiner asks for.
- Ongoing rescreening: when a list version changes, every open case is re-run
  against the changed records only, and new hits become monitoring alerts.
- Adverse media: our own keyword and category scan over public news search, with
  hits classified into predicate-offence categories.

## Part 2 — Own document, selfie and liveness engine

- Document capture and reading: passport and ID machine-readable zone parsing
  with check-digit validation, ID-number format validation per Canadian
  province, expiry and issuing-authority checks, and image-integrity signals
  (screen replay, print copy, tampering around the photo and text fields).
- Face-to-document match and liveness scoring, run in our own runtime with open
  face models. Liveness uses an action challenge plus passive signals.
- Selfie and document images are stored encrypted for seven years in private
  storage, viewable only by reviewers inside the case file, with every view
  written to the audit trail.
- Extracted fields feed the case automatically: name, date of birth, address,
  ID number, expiry, issuing country.

## Part 3 — Own risk signals

- Device and network risk from data we collect ourselves: browser and device
  fingerprint, timezone and language mismatch, IP-to-claimed-country mismatch,
  datacentre/VPN/Tor address ranges from free public lists, velocity and repeat
  device across cases.
- Email risk: disposable-domain list, domain age and mail-record checks, plus
  address pattern signals.
- Phone risk: number plan validation, line-type and carrier inference from free
  numbering data.
- A single risk score built from every signal, with the contribution of each
  factor shown to the reviewer.

## Part 4 — Optional add-ons (only when you have keys)

A provider layer with a clean on/off switch per capability. Nothing breaks when
they are off; the in-house engine remains the default.

- Plaid — bank-account and identity confirmation.
- Interac verification — Canadian bank-backed identity confirmation.
- Twilio or Telesign — phone risk and one-time codes.
- ipinfo / IPQS / AbuseIPDB — richer IP and email reputation.

Each add-on is enabled from Settings, with its key saved in the secure secrets
store, never in code.

## Public API

A versioned REST API so customers integrate once: create verification, submit
documents, run screening, fetch case status, receive webhooks. Authenticated by
the API keys you already issue, with sandbox and live separation.

## Order of work

1. Screening: list warehouse, ingestion, matching engine, hit review, ongoing rescreening.
2. Documents and selfie: capture, reading, face match, liveness, encrypted storage.
3. Risk signals and the combined score.
4. Public API and webhooks.
5. Optional add-ons as your keys arrive.

## Technical notes

- New tables: `watchlist_sources`, `watchlist_versions`, `watchlist_entities`
  (with alias/dob/nationality child rows), `screening_runs`, plus verification
  tables for `documents`, `selfies`, `device_signals` and `risk_factors`. Every
  table gets grants, row-level security and append-only audit coverage,
  matching the existing schema conventions.
- Ingestion and matching run as TanStack server functions; scheduled refresh via
  a public cron route guarded by a shared secret.
- Matching uses Postgres trigram and phonetic indexes for candidate selection,
  then our own scorer for the final decision — fast enough for live API calls.
- Images go to a private storage bucket, server-side encrypted, accessed only
  through signed short-lived URLs issued to authorised reviewers.
- Face embedding and liveness models run through ONNX in the server runtime;
  capture-side quality checks run in the browser.
- Provider layer: one interface per capability (`identity`, `bank`, `phone`,
  `ip_email`) with an in-house implementation always registered first.
