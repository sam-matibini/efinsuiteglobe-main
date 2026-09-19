import { createFileRoute } from "@tanstack/react-router";

import { CTASection, PageHero, Section } from "@/components/site/primitives";
import { API_BASE_PATH, API_GROUPS, ERROR_CODES, SANDBOX_TEST_VALUES, WEBHOOK_EVENTS } from "@/lib/api-spec";

export const Route = createFileRoute("/developers")({
  head: () => ({
    meta: [
      { title: "API reference for KYC, KYB and AML — eterfaceID" },
      {
        name: "description",
        content:
          "Full REST reference: create cases, verify documents and liveness, screen sanctions and PEP lists, monitor payments, file reports, and receive signed webhooks.",
      },
      { property: "og:title", content: "API reference for KYC, KYB and AML — eterfaceID" },
      {
        property: "og:description",
        content: "Everything the eterfaceID console does, over one documented HTTP API with keys, webhooks and OpenAPI.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Developers,
});

const quickStart = `curl https://eterfaceid.com${API_BASE_PATH}/cases \\
  -H "Authorization: Bearer eid_live_xxxxxxxxxxxx" \\
  -H "Content-Type: application/json" \\
  -H "Idempotency-Key: efin-10231" \\
  -d '{
    "case_type": "person",
    "subject_name": "Amelia Okonkwo",
    "country": "CA",
    "reference": "customer_8842"
  }'`;

const signatureSample = `const expected = crypto
  .createHmac("sha256", process.env.ETERFACEID_WEBHOOK_SECRET)
  .update(rawBody)
  .digest("hex");

if (req.headers["x-eterfaceid-signature"] !== expected) {
  return res.status(401).end();
}`;

function Code({ children }: { children: string }) {
  return (
    <pre className="overflow-x-auto rounded-lg border border-border bg-card p-4 text-xs leading-relaxed">
      <code>{children}</code>
    </pre>
  );
}

function MethodTag({ method }: { method: string }) {
  return (
    <span className="rounded border border-border px-1.5 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-wide">
      {method}
    </span>
  );
}

function Developers() {
  return (
    <>
      <PageHero
        eyebrow="Developers"
        title="One API for identity, ownership, screening and monitoring"
        lede="Everything the eterfaceID console does is available over HTTP. Authenticate with an API key, page through results, retry safely with idempotency keys, and receive signed webhooks when something changes."
      />

      <Section title="Quick start" intro="Create your first case in one request.">
        <div className="grid gap-6 lg:grid-cols-2">
          <ol className="space-y-3 text-sm text-muted-foreground">
            <li>
              <strong className="text-foreground">1.</strong> In the console, open Settings and create an API key. Test
              keys start <code className="font-mono">eid_test_</code>, live keys{" "}
              <code className="font-mono">eid_live_</code>. The secret is shown once.
            </li>
            <li>
              <strong className="text-foreground">2.</strong> Send it on every request as{" "}
              <code className="font-mono">Authorization: Bearer eid_…</code>.
            </li>
            <li>
              <strong className="text-foreground">3.</strong> Check it works with{" "}
              <code className="font-mono">GET {API_BASE_PATH}/ping</code>.
            </li>
            <li>
              <strong className="text-foreground">4.</strong> Add a webhook endpoint in Settings so results reach you
              without polling.
            </li>
          </ol>
          <Code>{quickStart}</Code>
        </div>
      </Section>

      <Section
        title="Conventions"
        intro="The same rules apply to every endpoint, so there are no surprises per resource."
      >
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[
            {
              title: "Base URL",
              body: `All paths below are relative to https://eterfaceid.com${API_BASE_PATH}.`,
            },
            {
              title: "Scoping",
              body: "A key only ever reads and writes records belonging to its own company. Nothing else is visible.",
            },
            {
              title: "Paging",
              body: "List endpoints accept ?limit= (up to 200) and ?offset=, newest first.",
            },
            {
              title: "Idempotency",
              body: "Send an Idempotency-Key header on creates. A repeat of the same key returns the first response instead of creating a duplicate.",
            },
          ].map((item) => (
            <div key={item.title} className="rounded-lg border border-border bg-card p-4">
              <h3 className="text-sm font-semibold">{item.title}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{item.body}</p>
            </div>
          ))}
        </div>
      </Section>

      <Section
        title="Sandbox and live keys"
        intro="Build against sandbox for free; live keys are issued once your business is verified and the agreement is signed."
      >
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="rounded-lg border border-border bg-card p-5">
            <h3 className="text-sm font-semibold">Sandbox — eid_test_…</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              Available the moment you create an account, unlimited and never billed. Sandbox keys never
              query the real sanctions and watchlists, never open a real bank connection and never call
              The KYB: results are simulated so you can test every branch of your code. Use these names
              to drive the outcome:
            </p>
            <ul className="mt-3 space-y-1 text-sm">
              {SANDBOX_TEST_VALUES.map((v) => (
                <li key={v.value}>
                  <code className="font-mono text-xs">{v.value}</code>{" "}
                  <span className="text-muted-foreground">— {v.effect}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="rounded-lg border border-border bg-card p-5">
            <h3 className="text-sm font-semibold">Live — eid_live_…</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              Live keys reach the real lists, real bank connections, official registries through The KYB
              and your billable usage. Before they can
              be created, an administrator completes <strong>Go live</strong> in the console: business
              details and beneficial owners are submitted and verified, the commercial agreement is signed,
              and an eterfaceID reviewer confirms.
            </p>
            <p className="mt-2 text-sm text-muted-foreground">
              A live call is refused with a clear error code when access is not approved, the agreement is
              missing, the account is suspended, or the month&apos;s included volume is used up. Each key is
              also limited to 120 calls a minute.
            </p>
          </div>
        </div>
      </Section>



      {API_GROUPS.map((group) => (
        <Section key={group.name} title={group.name} intro={group.blurb}>
          <div className="space-y-4">
            {group.endpoints.map((ep) => (
              <div key={`${ep.method}${ep.path}`} className="rounded-lg border border-border bg-card p-5">
                <div className="flex flex-wrap items-center gap-3">
                  <MethodTag method={ep.method} />
                  <code className="font-mono text-sm">
                    {API_BASE_PATH}
                    {ep.path}
                  </code>
                  <span className="text-sm font-semibold">{ep.summary}</span>
                </div>
                <p className="mt-2 text-sm text-muted-foreground">{ep.description}</p>
                {ep.request ? (
                  <div className="mt-4">
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Request</p>
                    <Code>{JSON.stringify(ep.request, null, 2)}</Code>
                  </div>
                ) : null}
                {ep.response ? (
                  <div className="mt-4">
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Response</p>
                    <Code>{JSON.stringify(ep.response, null, 2)}</Code>
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        </Section>
      ))}

      <Section title="Webhooks" intro="Signed with your endpoint secret so you can prove we sent them.">
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="overflow-hidden rounded-lg border border-border">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-4 py-2 font-medium">Event</th>
                  <th className="px-4 py-2 font-medium">Sent when</th>
                </tr>
              </thead>
              <tbody>
                {WEBHOOK_EVENTS.map((w) => (
                  <tr key={w.event} className="border-t border-border">
                    <td className="px-4 py-2 font-mono text-xs">{w.event}</td>
                    <td className="px-4 py-2 text-muted-foreground">{w.when}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">
              Each delivery carries an <code className="font-mono">x-eterfaceid-signature</code> header — a SHA-256 HMAC
              of the raw body using the signing secret shown once when you add the endpoint. Compare it before trusting
              the payload. Deliveries and their responses are logged in Settings.
            </p>
            <div className="mt-4">
              <Code>{signatureSample}</Code>
            </div>
          </div>
        </div>
      </Section>

      <Section title="Errors" intro="Every failure returns JSON with an error code and a plain message.">
        <div className="overflow-hidden rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-4 py-2 font-medium">Code</th>
                <th className="px-4 py-2 font-medium">HTTP</th>
                <th className="px-4 py-2 font-medium">Meaning</th>
              </tr>
            </thead>
            <tbody>
              {ERROR_CODES.map((e) => (
                <tr key={e.code} className="border-t border-border">
                  <td className="px-4 py-2 font-mono text-xs">{e.code}</td>
                  <td className="px-4 py-2">{e.status}</td>
                  <td className="px-4 py-2 text-muted-foreground">{e.meaning}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>

      <Section
        title="OpenAPI"
        intro="Import the machine-readable spec into Postman, or generate a client in your language."
      >
        <a
          className="inline-flex rounded-md border border-border px-4 py-2 text-sm font-medium hover:bg-muted"
          href={`${API_BASE_PATH}/openapi.json`}
        >
          Download openapi.json
        </a>
      </Section>

      <CTASection
        title="Integrating eterfaceID?"
        body="Tell us what you are building and we will help you scope the first calls."
      />
    </>
  );
}
