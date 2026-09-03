# CRA XML Schemas

This directory holds the Canada Revenue Agency (CRA) XSD schema files used for
soft validation of generated information-return XML. The schemas are resolved
at runtime by `src/lib/efile/craSchemaVersion.ts`.

## Layout

```
craSchemas/
  2026/    ← 2026 schema (stable, already shipped by CRA)
  2027/    ← 2027 schema (draft now; final published early October)
```

## How to add / update schemas

1. Download the XSD package from CRA's "Download the CRA schema" link on the
   [Get ready to file](https://www.canada.ca/en/revenue-agency/services/e-services/filing-information-returns-electronically-t4-t5-other-types-returns-overview/filing-information-returns-electronically-t4-t5-other-types-returns-what-you-should-know-before.html)
   page.
2. Extract all `.xsd` files into the correct year directory.
3. Ensure the file names match `CRA_SCHEMA_FILES` in
   `src/lib/efile/craSchemaVersion.ts` (e.g. `T4.xsd`, `T4A.xsd`, `T5.xsd`,
   `T5018.xsd`, `GSTHST.xsd`, plus any referenced shared files like
   `simple.xsd` / `complex.xsd`).
4. When CRA publishes the **final** 2027 schema (early October), replace the
   draft `.xsd` files in `2027/`. No generator code changes are required.

## Graceful degradation

If a `.xsd` file is missing for a year/return type, validation reports a
"schema not available" warning instead of failing. This lets the system run
fully before the schemas are dropped in.
