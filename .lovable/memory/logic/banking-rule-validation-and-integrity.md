# Memory: logic/banking-rule-validation-and-integrity
Updated: just now

The 'TransactionRuleDialog' and 'RuleConditionBuilder' generate unique IDs for new conditions to prevent collisions. Rules include validation to ensure they have a name, valid conditions (non-empty values), and valid actions (GL account for 'categorize'/'post_to_gl', or a non-empty memo for 'add-memo'). The matching logic in 'useRuleAnalysis' and 'useCreditCardRuleAnalysis' performs case-insensitive comparisons for the 'logic_operator' (e.g., 'and'/'or') to ensure robust rule evaluation.

## Eligibility Filters
- **Bank transactions**: Both 'pending' and 'unmatched' status are eligible for rule matching (not just 'unmatched')
- **Credit card transactions**: 'pending', 'unmatched', or no status are eligible (excluding 'reconciled')
- Both filters exclude transactions that already have a category assigned

## TransactionRules Page
The '/banking/rules' page now supports analyzing both bank and credit card transactions:
- Toggle between Bank and Credit Card sources
- Select specific account/card to analyze
- Shows count of eligible (pending) transactions
- Processes transactions directly through the appropriate hook (bank or CC)
