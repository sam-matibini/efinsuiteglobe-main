# Refine the eterfaceID brand and add two product films

## Goal
Create a distinctive eterfaceID identity from the supplied fingerprint shield and existing wordmark, then demonstrate two real product workflows with polished short animations.

## Brand refinement
- Redraw the uploaded shield as a clean, original, scalable fingerprint emblem using the selected navy, cyan, blue, and existing signal-red palette.
- Pair the emblem with the existing `eterfaceID` wordmark, preserving the red `ID` accent and current typography character.
- Build responsive full and compact logo variants so the mark remains legible in narrow navigation and footer layouts.
- Replace the text-only branding in the site header and footer with the refined logo lockup, with accessible labels and consistent sizing.
- Keep the visual language restrained and credible for regulated financial services rather than using glossy security-logo effects.

## Two short product films
- Produce two lightweight, silent, looping product films using the app’s actual interface language and realistic example data:
  1. **Screening:** a customer record enters matching, source lists resolve, identifiers narrow candidates, and a reviewable sanctions/PEP result appears with explained confidence.
  2. **Transaction monitoring:** transactions stream through rules, a suspicious pattern is detected, its risk score rises, and an analyst alert is created with a reason.
- Use branded motion, crisp interface details, and short readable beats; avoid fake controls, unverifiable claims, or decorative stock footage.
- Include poster frames and respect reduced-motion and data-saving preferences, with an informative still visible when playback is unavailable.

## Placement
- Replace the homepage’s static verification-record panel with a composed product-film area featuring both workflows without making the opening section taller or cramped.
- Add the screening film to the AML Screening & Monitoring page beside the matching explanation.
- Add the transaction-monitoring film to the Fraud & Risk Intelligence page beside a concise transaction-risk section.
- Ensure both films crop and remain readable across mobile and desktop, with no autoplay audio and no intrusive controls.

## Technical details
- Create reusable `BrandLogo` and `ProductFilm` presentation components.
- Store the final video files through the project’s asset delivery system rather than committing large binaries.
- Preserve the existing semantic colour tokens, route metadata, navigation, and application functionality.
- Verify the header/footer and every film placement at desktop and mobile widths, check reduced motion, playback, loading, layout stability, accessibility labels, and the final build.

## Out of scope
- No changes to screening logic, transaction rules, customer data, or authenticated console workflows.
- No redesign of the wider public site beyond the branding and film placements requested.
