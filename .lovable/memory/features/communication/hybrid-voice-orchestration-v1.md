# Memory: features/communication/hybrid-voice-orchestration-v1
Updated: now

The Hybrid Voice Calling system enables PSTN-to-PSTN bridging for global calls without requiring mobile data on the user's phone. Orchestrated by a 'voice-orchestrator' edge function, it bridges Leg A (user) and Leg B (destination) via a hybrid provider routing engine (Twilio for North America/Europe, Africa's Talking or Termii for Africa).

## Billing Engine
The system implements the **correct billing formula**:
```
charge = ceil(duration_seconds / billing_increment) × rate_per_minute / 60
```

Key billing features:
- **Per-second billing**: `billing_increment_seconds` can be set to 1 for per-second billing
- **Database function**: `calculate_voice_call_cost()` computes billable units and costs
- **Margin tracking**: Sessions store `provider_cost`, `margin_amount` for profitability analysis
- **FX lock**: `exchange_rate_locked` captures rate at call initiation for multi-currency

## Wallet Architecture
- **Prepaid Model**: `voice_wallets` with per-organization balance
- **Pre-call Reserve**: `reserve_voice_wallet()` atomically checks and reserves funds
- **Post-call Reconciliation**: `finalize_voice_billing_with_accounting()` calculates final cost, releases unused reserve, and posts journal entries

## Accounting Integration (GL Posting)
Completed calls automatically generate ledger entries:
- **Debit**: Communication Expense (P&L account matching '%communication expense%' or '%telephone%')
- **Credit**: Voice Wallet / Prepaid Asset (matching '%prepaid%' or '%voice wallet%')

Wallet top-ups via `topup_voice_wallet_with_accounting()`:
- **Debit**: Voice Wallet Asset
- **Credit**: Cash/Bank (payment account)

Multi-currency is supported with FX locked at call start.

## Session Tracking
Detailed audit via `voice_call_events` table logs:
- leg_a_initiated, leg_a_answered, leg_b_answered, bridged, call_completed
- Final event includes: duration, billable_seconds, final_cost, journal_entry_id
