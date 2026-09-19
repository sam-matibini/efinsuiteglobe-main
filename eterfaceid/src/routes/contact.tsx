import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { z } from "zod";
import { PageHero, Placeholder, Section } from "@/components/site/primitives";

export const Route = createFileRoute("/contact")({
  head: () => ({
    meta: [
      { title: "Contact us — eterfaceID" },
      {
        name: "description",
        content:
          "Talk to the eterfaceID team about identity verification, business verification and AML screening for your business.",
      },
      { property: "og:title", content: "Contact us — eterfaceID" },
      {
        property: "og:description",
        content: "Book a walkthrough or ask about sandbox access.",
      },
    ],
  }),
  component: Contact,
});

const schema = z.object({
  name: z.string().trim().min(1, "Please enter your name").max(100),
  email: z.string().trim().email("Please enter a valid email address").max(255),
  company: z.string().trim().min(1, "Please enter your company").max(120),
  volume: z.string().trim().max(60).optional(),
  message: z.string().trim().min(1, "Please tell us what you need").max(1500),
});

type Errors = Partial<Record<keyof z.infer<typeof schema>, string>>;

const field =
  "mt-2 w-full rounded-sm border border-rule bg-background px-3 py-2.5 text-[0.9rem] text-ink outline-none transition-colors focus:border-signal";
const label = "text-[0.8rem] font-medium text-ink";

function Contact() {
  const [errors, setErrors] = useState<Errors>({});
  const [sent, setSent] = useState(false);

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const parsed = schema.safeParse({
      name: form.get("name"),
      email: form.get("email"),
      company: form.get("company"),
      volume: form.get("volume"),
      message: form.get("message"),
    });

    if (!parsed.success) {
      const next: Errors = {};
      for (const issue of parsed.error.issues) {
        const key = issue.path[0] as keyof Errors;
        if (!next[key]) next[key] = issue.message;
      }
      setErrors(next);
      return;
    }
    setErrors({});
    setSent(true);
  }

  return (
    <>
      <PageHero
        eyebrow="Contact"
        title="Tell us what you are onboarding"
        lede="The fastest first call is one where we already know whether you are verifying individuals, businesses, or both, and roughly how many."
      />

      <Section>
        <div className="grid gap-14 lg:grid-cols-[1.1fr_0.9fr]">
          <div>
            {sent ? (
              <div className="rounded-sm border border-rule bg-paper p-8">
                <h2 className="text-[1.1rem] font-semibold text-ink">Thanks — that is noted</h2>
                <p className="mt-3 max-w-[56ch] text-[0.92rem] leading-[1.7] text-ink-soft">
                  This form is not connected to an inbox yet, so nothing has actually been sent.
                  Once the backend is added in the next phase, submissions will land in the team
                  queue and you will get a confirmation email.
                </p>
                <button
                  type="button"
                  onClick={() => setSent(false)}
                  className="mt-6 rounded-sm border border-ink/25 px-4 py-2 text-[0.82rem] font-medium text-ink transition-colors hover:border-ink"
                >
                  Back to the form
                </button>
              </div>
            ) : (
              <form onSubmit={onSubmit} noValidate className="grid gap-6 sm:grid-cols-2">
                <div className="sm:col-span-1">
                  <label className={label} htmlFor="name">
                    Your name
                  </label>
                  <input id="name" name="name" className={field} maxLength={100} />
                  {errors.name && (
                    <p className="mt-1.5 text-[0.78rem] text-destructive">{errors.name}</p>
                  )}
                </div>
                <div className="sm:col-span-1">
                  <label className={label} htmlFor="email">
                    Work email
                  </label>
                  <input id="email" name="email" type="email" className={field} maxLength={255} />
                  {errors.email && (
                    <p className="mt-1.5 text-[0.78rem] text-destructive">{errors.email}</p>
                  )}
                </div>
                <div className="sm:col-span-1">
                  <label className={label} htmlFor="company">
                    Company
                  </label>
                  <input id="company" name="company" className={field} maxLength={120} />
                  {errors.company && (
                    <p className="mt-1.5 text-[0.78rem] text-destructive">{errors.company}</p>
                  )}
                </div>
                <div className="sm:col-span-1">
                  <label className={label} htmlFor="volume">
                    Monthly verifications (optional)
                  </label>
                  <input id="volume" name="volume" className={field} maxLength={60} />
                </div>
                <div className="sm:col-span-2">
                  <label className={label} htmlFor="message">
                    What do you need to verify?
                  </label>
                  <textarea
                    id="message"
                    name="message"
                    rows={6}
                    maxLength={1500}
                    className={field}
                  />
                  {errors.message && (
                    <p className="mt-1.5 text-[0.78rem] text-destructive">{errors.message}</p>
                  )}
                </div>
                <div className="sm:col-span-2">
                  <button
                    type="submit"
                    className="rounded-sm bg-primary px-5 py-3 text-[0.88rem] font-medium text-primary-foreground transition-colors hover:bg-ink"
                  >
                    Send
                  </button>
                </div>
              </form>
            )}
          </div>

          <aside className="border-t border-rule pt-8 lg:border-l lg:border-t-0 lg:pl-12 lg:pt-0">
            <h2 className="text-[0.72rem] font-semibold uppercase tracking-[0.14em] text-ink-soft">
              Other ways to reach us
            </h2>
            <dl className="mt-5 space-y-5 text-[0.9rem]">
              <div>
                <dt className="text-ink-soft">Sales</dt>
                <dd className="mt-1 text-ink">
                  <Placeholder>sales@yourdomain</Placeholder>
                </dd>
              </div>
              <div>
                <dt className="text-ink-soft">Support</dt>
                <dd className="mt-1 text-ink">
                  <Placeholder>support@yourdomain</Placeholder>
                </dd>
              </div>
              <div>
                <dt className="text-ink-soft">Phone</dt>
                <dd className="mt-1 text-ink">
                  <Placeholder>phone number</Placeholder>
                </dd>
              </div>
              <div>
                <dt className="text-ink-soft">Office</dt>
                <dd className="mt-1 text-ink">
                  <Placeholder>registered office address</Placeholder>
                </dd>
              </div>
            </dl>
          </aside>
        </div>
      </Section>
    </>
  );
}
