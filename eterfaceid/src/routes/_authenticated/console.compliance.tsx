import { createFileRoute } from "@tanstack/react-router";

import { ConsoleShell, Panel } from "@/components/console/shell";
import { COMPLIANCE_MAP, MODULE_CAPABILITIES, MODULE_TITLES, type ModuleKey } from "@/lib/compliance-map";

export const Route = createFileRoute("/_authenticated/console/compliance")({
  head: () => ({
    meta: [
      { title: "Regulatory coverage — eterfaceID console" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: CompliancePage,
});

const MODULES: ModuleKey[] = ["kyc", "kyb", "aml", "fraud"];

function CompliancePage() {
  return (
    <ConsoleShell>
      <div className="space-y-6">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight">Regulatory coverage</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            What each module does and the rules it is built to satisfy across Canada, the European Union, the
            United States and African jurisdictions. Always confirm against the current text of the law that
            applies to your business.
          </p>
        </div>

        {MODULES.map((module) => (
          <Panel key={module} title={MODULE_TITLES[module]}>
            <ul className="mb-5 grid gap-1 text-sm sm:grid-cols-2">
              {MODULE_CAPABILITIES[module].map((c) => (
                <li key={c} className="text-foreground">
                  <span className="mr-2 text-[var(--verify)]">✓</span>
                  {c}
                </li>
              ))}
            </ul>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] border-collapse text-sm">
                <thead>
                  <tr className="border-b border-[var(--rule)] text-left text-xs uppercase tracking-widest text-muted-foreground">
                    <th className="py-2 pr-4">Region</th>
                    <th className="py-2 pr-4">Law or standard</th>
                    <th className="py-2 pr-4">Authority</th>
                    <th className="py-2 pr-4">Citation</th>
                    <th className="py-2">Applied to</th>
                  </tr>
                </thead>
                <tbody>
                  {COMPLIANCE_MAP[module].map((row) => (
                    <tr key={row.law} className="border-b border-[var(--rule)] align-top">
                      <td className="py-3 pr-4 font-medium">{row.region}</td>
                      <td className="py-3 pr-4">{row.law}</td>
                      <td className="py-3 pr-4 text-muted-foreground">{row.authority}</td>
                      <td className="py-3 pr-4 font-mono text-xs text-muted-foreground">{row.citation}</td>
                      <td className="py-3 text-muted-foreground">{row.covers.join(" · ")}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Panel>
        ))}
      </div>
    </ConsoleShell>
  );
}
