import { CraModule } from '@/components/cra/CraModule';
import { formatWhen } from '@/lib/cra/engine';
import { useCraTaxCentre } from '@/hooks/useCraTaxCentre';

export default function CraActivity() {
  const cra = useCraTaxCentre();
  return (
    <CraModule
      title="CRA activity"
      description="Each CRA view, filing, payment, and authorization change is appended to this log. Entries are not edited."
    >
      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full min-w-[960px] text-left text-sm">
          <thead className="bg-muted/50">
            <tr>
              {['Date/time', 'User', 'Client', 'Action', 'CRA account', 'Authorization', 'EFILE submission', 'CRA response', 'Confirmation', 'IP/device'].map((heading) => (
                <th key={heading} className="px-3 py-2 font-medium">{heading}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {cra.ledger.audit.map((event) => (
              <tr key={event.id} className="border-t">
                <td className="px-3 py-2 whitespace-nowrap">{formatWhen(event.at)}</td>
                <td className="px-3 py-2">{event.userEmail}</td>
                <td className="px-3 py-2">{event.client}</td>
                <td className="px-3 py-2">{event.action}</td>
                <td className="px-3 py-2">{event.craAccount ?? '—'}</td>
                <td className="px-3 py-2">{event.authorization}</td>
                <td className="px-3 py-2">{event.efileSubmission ?? '—'}</td>
                <td className="px-3 py-2">{event.craResponse ?? '—'}</td>
                <td className="px-3 py-2">{event.confirmation ?? '—'}</td>
                <td className="px-3 py-2">{event.ipDevice}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </CraModule>
  );
}
