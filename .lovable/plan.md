## Plan: Public Contact page + wire CTAs

### 1. Create `src/pages/Contact.tsx`
Public page styled to match landing (dark hero + form card). Includes:
- `LandingNav` at top, footer at bottom (reuse landing footer if extractable, else simple footer).
- Hero: "Contact us — We'd love to hear from you."
- Left column info cards: Email us (support@efin.money), Response time (within 1 business day), In-app support note.
- Right column form card with fields: Name, Email, Subject, Message, "Send message" button.
- Client-side validation via `zod` (name/email/subject/message, length limits) using shadcn `Input`, `Textarea`, `Button`, `useToast`.
- Submit handler: for now, `mailto:support@efin.money` fallback with prefilled subject/body (no backend added — UI-only per scope). Show success toast on submit.
- SEO: `<title>Contact — efinsuite Globe</title>`, meta description, canonical, single H1.

### 2. Register route
In `src/App.tsx` public routes block, add:
```
<Route path="/contact" element={<Contact />} />
```
Lazy import alongside other landing pages.

### 3. Wire CTAs to `/contact`
- `src/pages/Landing.tsx` line ~346: wrap "Book a Demo" `<Button>` in `<Link to="/contact">`.
- `src/pages/Landing.tsx` line ~743: wrap "Talk to Sales" `<Button>` in `<Link to="/contact">`.
- `src/pages/Landing.tsx` line ~810: change footer "Contact" `<a href="https://www.efintax.biz">` to `<Link to="/contact">`.

### Out of scope
- No backend/edge function for form submission this pass (mailto handoff). Can add a `send-contact-email` edge function later if desired.
