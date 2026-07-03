import { useMemo, useState } from 'react';
import { PenLine, ShieldCheck, History, Crown, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { ExecutiveSignatureDialog } from './ExecutiveSignatureDialog';
import {
  useIsDesignatedExecutiveSigner,
  useLatestExecutiveSignaturesBoth,
  useExecutiveSignatureHistory,
  useExecutiveSignerSettings,
  type ExecStatementType,
  type ExecutiveSignatureRow,
  type ExecSignerRole,
} from '@/hooks/useExecutiveSignatures';
import { useLocalizedCurrency } from '@/hooks/useLocalizedCurrency';

interface Props {
  statementType: ExecStatementType;
  statementTitle: string;
  periodStart: Date;
  periodEnd: Date;
  /** Optional human label like "For the year ended December 31, 2025". */
  periodLabel?: string;
}

function SignatureSlot({
  icon,
  roleLabel,
  signed,
  signerName,
  signerTitle,
  formatDate,
}: {
  icon: React.ReactNode;
  roleLabel: string;
  signed: ExecutiveSignatureRow | null | undefined;
  signerName: string;
  signerTitle: string;
  formatDate: (d: Date, f?: 'short' | 'medium' | 'long') => string;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
        {icon}
        <span>{roleLabel}</span>
        {signed ? (
          <Badge variant="secondary" className="text-[10px]">
            Signed • Rev {signed.revision}
          </Badge>
        ) : (
          <Badge variant="outline" className="text-[10px]">
            Not yet signed
          </Badge>
        )}
      </div>
      <div className="border rounded p-3 bg-white h-24 flex items-center justify-center">
        {signed ? (
          <img
            src={signed.signature_image_url}
            alt={`${roleLabel} signature`}
            className="max-h-full max-w-full object-contain"
            style={{ mixBlendMode: 'multiply' }}
          />
        ) : (
          <span className="text-xs text-muted-foreground italic">
            Signature line
          </span>
        )}
      </div>
      <div className="space-y-0.5 text-sm">
        <div className="font-semibold text-foreground">
          {signed?.signer_name || signerName || '—'}
        </div>
        <div className="text-muted-foreground text-xs">
          {signed?.signer_title || signerTitle}
        </div>
        {signed && (
          <div className="text-[11px] text-muted-foreground">
            Signed on {formatDate(new Date(signed.signed_at), 'long')}
          </div>
        )}
      </div>
    </div>
  );
}

export function ExecutiveSignatureBlock({
  statementType,
  statementTitle,
  periodStart,
  periodEnd,
  periodLabel,
}: Props) {
  const { formatDate } = useLocalizedCurrency();
  const {
    isDesignated,
    role: myRole,
    signerName,
    signerTitle,
    primaryName,
    primaryTitle,
    secondaryName,
    secondarySignerTitle,
    hasPrimaryDesignated,
    hasSecondaryDesignated,
  } = useIsDesignatedExecutiveSigner();
  const { data: settings } = useExecutiveSignerSettings();
  const key = useMemo(
    () => ({ statementType, periodStart, periodEnd }),
    [statementType, periodStart, periodEnd],
  );
  const { primary: primaryQ, secondary: secondaryQ } =
    useLatestExecutiveSignaturesBoth(key);
  const { data: history = [] } = useExecutiveSignatureHistory(key);
  const [openRole, setOpenRole] = useState<ExecSignerRole | null>(null);

  const latestPrimary = primaryQ.data ?? null;
  const latestSecondary = secondaryQ.data ?? null;

  const computedPeriodLabel =
    periodLabel ||
    `${formatDate(periodStart, 'medium')} — ${formatDate(periodEnd, 'medium')}`;

  // Hide entirely if nothing to show
  if (
    !latestPrimary &&
    !latestSecondary &&
    !hasPrimaryDesignated &&
    !hasSecondaryDesignated
  )
    return null;

  const showSecondaryColumn =
    !!latestSecondary || hasSecondaryDesignated;

  return (
    <Card className="p-5 mt-6 print:border print:shadow-none">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-accent" />
            <h4 className="text-sm font-semibold text-foreground">
              Approved on behalf of the Board / Management
            </h4>
          </div>
          <p className="text-xs text-muted-foreground">
            {statementTitle} — {computedPeriodLabel}
          </p>
        </div>

        <div className="flex items-center gap-2">
          {history.length > 0 && (
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="ghost" size="sm" className="gap-1">
                  <History className="w-4 h-4" />
                  {history.length} revision{history.length === 1 ? '' : 's'}
                </Button>
              </PopoverTrigger>
              <PopoverContent align="end" className="w-80 p-0">
                <div className="max-h-64 overflow-auto divide-y">
                  {history.map((row) => (
                    <div key={row.id} className="p-3 text-xs space-y-0.5">
                      <div className="flex justify-between font-medium">
                        <span>
                          {row.signer_role === 'secondary'
                            ? 'Secondary'
                            : 'Primary'}{' '}
                          • Rev {row.revision}
                        </span>
                        <span className="text-muted-foreground">
                          {formatDate(new Date(row.signed_at), 'medium')}
                        </span>
                      </div>
                      <div className="text-muted-foreground">
                        {row.signer_name} — {row.signer_title}
                      </div>
                      {row.archived_pdf_url && (
                        <a
                          className="text-accent underline"
                          href={row.archived_pdf_url}
                          target="_blank"
                          rel="noreferrer"
                        >
                          Download archived PDF
                        </a>
                      )}
                    </div>
                  ))}
                </div>
              </PopoverContent>
            </Popover>
          )}
          {isDesignated && (
            <Button
              size="sm"
              variant={
                (myRole === 'primary' ? latestPrimary : latestSecondary)
                  ? 'outline'
                  : 'default'
              }
              onClick={() => setOpenRole(myRole)}
              className="gap-1"
            >
              <PenLine className="w-4 h-4" />
              {(myRole === 'primary' ? latestPrimary : latestSecondary)
                ? 'Re-sign'
                : 'Sign as ' + (signerTitle || 'Executive')}
            </Button>
          )}
        </div>
      </div>

      <div
        className={`mt-4 grid grid-cols-1 ${
          showSecondaryColumn ? 'md:grid-cols-2' : ''
        } gap-6`}
      >
        <SignatureSlot
          icon={<Crown className="w-3.5 h-3.5 text-amber-500" />}
          roleLabel={primaryTitle || 'CEO / President'}
          signed={latestPrimary}
          signerName={primaryName}
          signerTitle={primaryTitle}
          formatDate={formatDate}
        />
        {showSecondaryColumn && (
          <SignatureSlot
            icon={<Users className="w-3.5 h-3.5 text-blue-500" />}
            roleLabel={secondarySignerTitle || 'CFO / Treasurer'}
            signed={latestSecondary}
            signerName={secondaryName}
            signerTitle={secondarySignerTitle}
            formatDate={formatDate}
          />
        )}
      </div>

      {(latestPrimary || latestSecondary) && (
        <p className="text-xs text-muted-foreground italic mt-4">
          “
          {latestPrimary?.certification_text ||
            latestSecondary?.certification_text}
          ”
        </p>
      )}

      {isDesignated && openRole && (
        <ExecutiveSignatureDialog
          open={openRole !== null}
          onOpenChange={(v) => setOpenRole(v ? openRole : null)}
          statementType={statementType}
          statementTitle={statementTitle}
          periodStart={periodStart}
          periodEnd={periodEnd}
          periodLabel={computedPeriodLabel}
          signerName={signerName}
          signerTitle={signerTitle}
          signerRole={openRole}
        />
      )}
    </Card>
  );
}
