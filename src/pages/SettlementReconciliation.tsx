import { useMemo, useRef, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Wallet, RefreshCw, Upload, PlayCircle, Plus, Undo2, AlertTriangle, CheckCircle2, Clock, Layers, Split, Sliders, Search, ShieldAlert, ThumbsUp, ThumbsDown, Timer, Zap, Sparkles, Download, FileSpreadsheet } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { downloadSettlementTemplateCsv, downloadSettlementTemplateXlsx } from '@/lib/settlement-template';
import { CopilotPanel } from '@/components/settlements/CopilotPanel';
import {
  useProcessorAccounts, useSettlements, useSettlementMatches,
  useReviewQueue, useInvestigationQueue, useScoringRules, useMatchGroups,
  useExceptionsQueue, useFuzzyCandidates, useTriggerAutoMatch,
  usePostWriteoff, useAwaitingSecondApproval, useExpenseAccounts,
} from '@/hooks/useSettlements';
import { useBankAccounts } from '@/hooks/useBankAccounts';
import { useCurrencyFormatter } from '@/hooks/useCurrencyFormatter';
import { supabase } from '@/integrations/supabase/client';
import { useCurrentOrganization } from '@/hooks/useOrganization';
import { Textarea } from '@/components/ui/textarea';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import * as XLSX from 'xlsx';
import { SettlementAnalytics } from '@/components/settlements/SettlementAnalytics';
import { DisputesPanel } from '@/components/settlements/DisputesPanel';
import { useDisputes } from '@/hooks/useSettlements';
import { CurrencySelect } from '@/components/currency/CurrencySelect';
import { ProcessorLogo } from '@/components/settlements/ProcessorLogo';
import kpiTotal from '@/assets/settlement-kpi/total.png';
import kpiAutoMatched from '@/assets/settlement-kpi/auto-matched.png';
import kpiPending from '@/assets/settlement-kpi/pending.png';
import kpiInvestigation from '@/assets/settlement-kpi/investigation.png';
import kpiAggregate from '@/assets/settlement-kpi/aggregate.png';
import kpiSplit from '@/assets/settlement-kpi/split.png';
import kpiStuck from '@/assets/settlement-kpi/stuck.png';
import kpiApproval from '@/assets/settlement-kpi/approval.png';

const KpiImg = ({ src, alt }: { src: string; alt: string }) => (
  <img src={src} alt={alt} loading="lazy" width={32} height={32} className="h-8 w-8 object-contain" />
);


export default function SettlementReconciliation() {
  const { accounts, isLoading: accLoading, upsert: upsertAccount } = useProcessorAccounts();
  const { settlements, isLoading: sLoading, importCsv, syncStripe, runMatching } = useSettlements();
  const { matches, isLoading: mLoading, reverse } = useSettlementMatches();
  const { items: reviewItems, approve, reject } = useReviewQueue();
  const { items: investigationItems, reassign, markWriteOff } = useInvestigationQueue();
  const { rules, upsert: upsertRule, resetToDefaults } = useScoringRules();
  const { groups } = useMatchGroups();
  const [exceptionFilters, setExceptionFilters] = useState<{ agingBucket?: string; reason?: string }>({});
  const { items: exceptionItems } = useExceptionsQueue(exceptionFilters);
  const triggerAutoMatch = useTriggerAutoMatch();
  const postWriteoff = usePostWriteoff();
  const { count: awaitingSecond } = useAwaitingSecondApproval();
  const { accounts: bankAccounts } = useBankAccounts();
  const { accounts: expenseAccounts } = useExpenseAccounts();
  const { disputes } = useDisputes();
  const openDisputes = disputes.filter((d: any) => d.status === 'needs_response' || d.status === 'under_review').length;
  const fmt = useCurrencyFormatter();
  const [accountDialogOpen, setAccountDialogOpen] = useState(false);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [writeoffTarget, setWriteoffTarget] = useState<any | null>(null);
  const [writeoffAccountId, setWriteoffAccountId] = useState<string>('');
  const [writeoffReason, setWriteoffReason] = useState('');
  const [expandedSettlement, setExpandedSettlement] = useState<string | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [copilotOpen, setCopilotOpen] = useState(false);
  useMemo(() => { supabase.auth.getUser().then(({ data }) => setCurrentUserId(data.user?.id ?? null)); }, []);

  const kpis = useMemo(() => {
    const total = settlements.length;
    const autoMatched = settlements.filter((s) => s.status === 'matched').length;
    const pendingReview = reviewItems.length;
    const investigation = investigationItems.length;
    const aggregateGroups = groups.filter((g: any) => g.group_type === 'aggregate').length;
    const splitGroups = groups.filter((g: any) => g.group_type === 'split').length;
    const stuck = settlements.filter((s) => ['pending', 'exception'].includes(s.status) && ['8-14d', '15-30d', '30d+'].includes(s.aging_bucket)).length;
    const totalAmt = settlements.reduce((sum, s) => sum + Number(s.net_amount || 0), 0);
    const matchedAmt = settlements.filter((s) => s.status === 'matched').reduce((sum, s) => sum + Number(s.net_amount || 0), 0);
    return { total, autoMatched, pendingReview, investigation, aggregateGroups, splitGroups, stuck, totalAmt, matchedAmt };
  }, [settlements, reviewItems, investigationItems, groups]);


  return (
    <div className="space-y-6 p-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Wallet className="h-7 w-7 text-primary" />
            Settlement Reconciliation
          </h1>
          <p className="text-muted-foreground">Match payment-processor payouts (Stripe, Adyen, Paysafe) against bank statement deposits.</p>
        </div>
        <div className="flex gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline"><Download className="h-4 w-4 mr-2" /> Template</Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem onClick={() => downloadSettlementTemplateXlsx()}>
                <FileSpreadsheet className="h-4 w-4 mr-2" /> XLSX (with notes)
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => downloadSettlementTemplateCsv()}>
                <Download className="h-4 w-4 mr-2" /> CSV
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <Button variant="outline" onClick={() => setImportDialogOpen(true)}>
            <Upload className="h-4 w-4 mr-2" />Import CSV
          </Button>
          <Button variant="outline" onClick={() => setCopilotOpen(true)}>
            <Sparkles className="h-4 w-4 mr-2" />Copilot
          </Button>
          <Button variant="outline" onClick={() => triggerAutoMatch.mutate()} disabled={triggerAutoMatch.isPending}>
            <Zap className={`h-4 w-4 mr-2 ${triggerAutoMatch.isPending ? 'animate-pulse' : ''}`} />
            Run Auto-Match Cron
          </Button>
          <Button onClick={() => runMatching.mutate(undefined)} disabled={runMatching.isPending}>
            <PlayCircle className="h-4 w-4 mr-2" />
            {runMatching.isPending ? 'Matching…' : 'Run Matching'}
          </Button>
        </div>
      </div>

      {/* KPI tiles */}
      <div className="grid gap-4 md:grid-cols-4 lg:grid-cols-8">
        <KpiCard icon={<KpiImg src={kpiTotal} alt="Total" />} label="Total" value={kpis.total} subValue={fmt.formatCurrency(kpis.totalAmt)} />
        <KpiCard icon={<KpiImg src={kpiAutoMatched} alt="Auto-matched" />} label="Auto-matched" value={kpis.autoMatched} subValue={fmt.formatCurrency(kpis.matchedAmt)} />
        <KpiCard icon={<KpiImg src={kpiPending} alt="Pending review" />} label="Pending review" value={kpis.pendingReview} />
        <KpiCard icon={<KpiImg src={kpiInvestigation} alt="Investigation" />} label="Investigation" value={kpis.investigation} />
        <KpiCard icon={<KpiImg src={kpiAggregate} alt="Aggregate groups" />} label="Aggregate groups" value={kpis.aggregateGroups} />
        <KpiCard icon={<KpiImg src={kpiSplit} alt="Split groups" />} label="Split groups" value={kpis.splitGroups} />
        <KpiCard icon={<KpiImg src={kpiStuck} alt="Stuck" />} label="Stuck > 7d" value={kpis.stuck} />
        <KpiCard icon={<KpiImg src={kpiApproval} alt="Awaiting approval" />} label="Awaiting 2nd approval" value={awaitingSecond} />
      </div>


      <Tabs defaultValue="settlements" className="space-y-4">
        <TabsList className="flex-wrap">
          <TabsTrigger value="settlements">Settlements</TabsTrigger>
          <TabsTrigger value="matches">Matches</TabsTrigger>
          <TabsTrigger value="review">Review queue {reviewItems.length > 0 && <Badge variant="secondary" className="ml-1">{reviewItems.length}</Badge>}</TabsTrigger>
          <TabsTrigger value="investigation">Investigation {investigationItems.length > 0 && <Badge variant="destructive" className="ml-1">{investigationItems.length}</Badge>}</TabsTrigger>
          <TabsTrigger value="exceptions">Exceptions {exceptionItems.length > 0 && <Badge variant="destructive" className="ml-1">{exceptionItems.length}</Badge>}</TabsTrigger>
          <TabsTrigger value="processors">Processor Accounts</TabsTrigger>
          <TabsTrigger value="rules">Scoring rules</TabsTrigger>
          <TabsTrigger value="disputes">Disputes {openDisputes > 0 && <Badge variant="destructive" className="ml-1">{openDisputes}</Badge>}</TabsTrigger>
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
        </TabsList>

        <TabsContent value="disputes">
          <DisputesPanel />
        </TabsContent>


        <TabsContent value="exceptions">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between flex-wrap gap-2">
              <CardTitle>Exceptions & Aging</CardTitle>
              <div className="flex gap-2">
                <Select value={exceptionFilters.agingBucket ?? 'all'} onValueChange={(v) => setExceptionFilters((f) => ({ ...f, agingBucket: v === 'all' ? undefined : v }))}>
                  <SelectTrigger className="w-36"><SelectValue placeholder="Aging" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All aging</SelectItem>
                    <SelectItem value="0-3d">0-3 days</SelectItem>
                    <SelectItem value="4-7d">4-7 days</SelectItem>
                    <SelectItem value="8-14d">8-14 days</SelectItem>
                    <SelectItem value="15-30d">15-30 days</SelectItem>
                    <SelectItem value="30d+">30+ days</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={exceptionFilters.reason ?? 'all'} onValueChange={(v) => setExceptionFilters((f) => ({ ...f, reason: v === 'all' ? undefined : v }))}>
                  <SelectTrigger className="w-48"><SelectValue placeholder="Reason" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All reasons</SelectItem>
                    <SelectItem value="no_candidates">No candidates</SelectItem>
                    <SelectItem value="fuzzy_below_threshold">Fuzzy below threshold</SelectItem>
                    <SelectItem value="low_confidence">Low confidence</SelectItem>
                    <SelectItem value="amount_outside_tolerance">Amount outside tolerance</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardHeader>
            <CardContent>
              {exceptionItems.length === 0 ? (
                <p className="text-sm text-muted-foreground">No exceptions. 🎉</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Processor</TableHead>
                      <TableHead>Reference</TableHead>
                      <TableHead className="text-right">Net</TableHead>
                      <TableHead>Aging</TableHead>
                      <TableHead>Reason</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {exceptionItems.map((s: any) => (
                      <ExceptionRow
                        key={s.id}
                        settlement={s}
                        expanded={expandedSettlement === s.id}
                        onToggle={() => setExpandedSettlement(expandedSettlement === s.id ? null : s.id)}
                        onWriteoff={() => {
                          setWriteoffTarget(s);
                          setWriteoffAccountId(s.processor_account?.default_writeoff_account_id ?? '');
                          setWriteoffReason('');
                        }}
                        fmt={fmt}
                      />
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>


        <TabsContent value="settlements">
          <Card>
            <CardHeader><CardTitle>Imported Settlements</CardTitle></CardHeader>
            <CardContent>
              {sLoading ? <p className="text-sm text-muted-foreground">Loading…</p> : settlements.length === 0 ? (
                <p className="text-sm text-muted-foreground">No settlements yet. Import a CSV or sync from Stripe.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Processor</TableHead>
                      <TableHead>Reference</TableHead>
                      <TableHead className="text-right">Gross</TableHead>
                      <TableHead className="text-right">Fees</TableHead>
                      <TableHead className="text-right">Net</TableHead>
                      <TableHead>Expected Deposit</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {settlements.slice(0, 100).map((s) => (
                      <TableRow key={s.id}>
                        <TableCell className="font-mono text-xs">{s.settlement_date}</TableCell>
                        <TableCell>{s.processor_account?.display_name ?? '—'}</TableCell>
                        <TableCell className="font-mono text-xs">{s.settlement_ref}</TableCell>
                        <TableCell className="text-right">{fmt.formatCurrency(Number(s.gross_amount), { currencyOverride: s.currency })}</TableCell>
                        <TableCell className="text-right text-muted-foreground">{fmt.formatCurrency(Number(s.fees), { currencyOverride: s.currency })}</TableCell>
                        <TableCell className="text-right font-medium">{fmt.formatCurrency(Number(s.net_amount), { currencyOverride: s.currency })}</TableCell>
                        <TableCell className="font-mono text-xs">{s.expected_deposit_date ?? '—'}</TableCell>
                        <TableCell><StatusBadge status={s.status} /></TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="matches">
          <Card>
            <CardHeader><CardTitle>Reconciled Matches</CardTitle></CardHeader>
            <CardContent>
              {mLoading ? <p className="text-sm text-muted-foreground">Loading…</p> : matches.length === 0 ? (
                <p className="text-sm text-muted-foreground">No matches yet. Run matching after importing settlements.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Settlement</TableHead>
                      <TableHead>Bank Deposit</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Confidence</TableHead>
                      <TableHead className="text-right">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {matches.map((m) => (
                      <TableRow key={m.id}>
                        <TableCell className="font-mono text-xs">{m.settlement?.settlement_ref}</TableCell>
                        <TableCell className="text-xs">
                          {m.bank_transaction?.transaction_date} · {m.bank_transaction?.description ?? '—'}
                        </TableCell>
                        <TableCell>{fmt.formatCurrency(Number(m.matched_amount ?? 0))}</TableCell>
                        <TableCell><Badge variant="outline">{m.match_type}</Badge></TableCell>
                        <TableCell>
                          <Badge variant={Number(m.confidence_score) >= 95 ? 'default' : 'secondary'}>
                            {Number(m.confidence_score).toFixed(0)}%
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <Button size="sm" variant="ghost" onClick={() => {
                            const reason = prompt('Reason for reversing this match?');
                            if (reason) reverse.mutate({ id: m.id, reason });
                          }}>
                            <Undo2 className="h-3 w-3 mr-1" /> Reverse
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="processors">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Processor Accounts</CardTitle>
              <Button size="sm" onClick={() => setAccountDialogOpen(true)}>
                <Plus className="h-4 w-4 mr-1" /> Add Account
              </Button>
            </CardHeader>
            <CardContent>
              {accLoading ? <p className="text-sm text-muted-foreground">Loading…</p> : accounts.length === 0 ? (
                <p className="text-sm text-muted-foreground">No processor accounts configured. Add one to start importing settlements.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Processor</TableHead>
                      <TableHead>Currency</TableHead>
                      <TableHead>Destination Bank</TableHead>
                      <TableHead>Auto-match</TableHead>
                      <TableHead>Fuzzy</TableHead>
                      <TableHead>Dual approval</TableHead>
                      <TableHead>Write-off acct</TableHead>
                      <TableHead>FX reval</TableHead>
                      <TableHead>Last Sync</TableHead>
                      <TableHead className="text-right">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {accounts.map((a) => (
                      <TableRow key={a.id}>
                        <TableCell>{a.display_name}</TableCell>
                        <TableCell><div className="flex items-center gap-2"><ProcessorLogo processor={a.processor} /><span className="capitalize text-sm">{a.processor}</span></div></TableCell>
                        <TableCell>{a.currency}</TableCell>
                        <TableCell>{a.bank_accounts?.name ?? '—'}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Switch
                              checked={!!a.auto_match_enabled}
                              onCheckedChange={(v) => upsertAccount.mutate({ id: a.id, auto_match_enabled: v })}
                            />
                            <span className="text-xs text-muted-foreground font-mono">{a.auto_match_schedule ?? '*/15 * * * *'}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Switch
                              checked={a.enable_fuzzy_matching !== false}
                              onCheckedChange={(v) => upsertAccount.mutate({ id: a.id, enable_fuzzy_matching: v })}
                            />
                            <span className="text-xs text-muted-foreground">min {Math.round(Number(a.fuzzy_min_similarity ?? 0.75) * 100)}%</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Switch
                              checked={!!a.require_dual_approval}
                              onCheckedChange={(v) => upsertAccount.mutate({ id: a.id, require_dual_approval: v })}
                            />
                            <Input
                              type="number"
                              className="h-7 w-24 text-xs"
                              value={a.dual_approval_threshold ?? 1000}
                              onChange={(e) => upsertAccount.mutate({ id: a.id, dual_approval_threshold: Number(e.target.value) })}
                            />
                          </div>
                        </TableCell>
                        <TableCell>
                          <Select
                            value={a.default_writeoff_account_id ?? ''}
                            onValueChange={(v) => upsertAccount.mutate({ id: a.id, default_writeoff_account_id: v || null })}
                          >
                            <SelectTrigger className="h-7 w-40 text-xs"><SelectValue placeholder="Select…" /></SelectTrigger>
                            <SelectContent>
                              {expenseAccounts.map((acc: any) => (
                                <SelectItem key={acc.id} value={acc.id}>{acc.code} · {acc.name}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Switch
                              checked={!!a.revaluation_enabled}
                              onCheckedChange={(v) => upsertAccount.mutate({ id: a.id, revaluation_enabled: v })}
                            />
                            <div className="flex flex-col gap-1">
                              <Select
                                value={a.unrealized_fx_gain_account_id ?? ''}
                                onValueChange={(v) => upsertAccount.mutate({ id: a.id, unrealized_fx_gain_account_id: v || null })}
                              >
                                <SelectTrigger className="h-6 w-32 text-[10px]"><SelectValue placeholder="Gain a/c" /></SelectTrigger>
                                <SelectContent>
                                  {expenseAccounts.map((acc: any) => (
                                    <SelectItem key={acc.id} value={acc.id}>{acc.code} · {acc.name}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              <Select
                                value={a.unrealized_fx_loss_account_id ?? ''}
                                onValueChange={(v) => upsertAccount.mutate({ id: a.id, unrealized_fx_loss_account_id: v || null })}
                              >
                                <SelectTrigger className="h-6 w-32 text-[10px]"><SelectValue placeholder="Loss a/c" /></SelectTrigger>
                                <SelectContent>
                                  {expenseAccounts.map((acc: any) => (
                                    <SelectItem key={acc.id} value={acc.id}>{acc.code} · {acc.name}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">{a.last_sync_at ? new Date(a.last_sync_at).toLocaleString() : 'Never'}</TableCell>
                        <TableCell className="text-right">
                          {a.processor === 'stripe' && (
                            <Button size="sm" variant="outline" onClick={() => syncStripe.mutate(a.id)} disabled={syncStripe.isPending}>
                              <RefreshCw className={`h-3 w-3 mr-1 ${syncStripe.isPending ? 'animate-spin' : ''}`} />
                              Sync Stripe
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="review">
          <Card>
            <CardHeader><CardTitle>Review queue (80–94% confidence)</CardTitle></CardHeader>
            <CardContent>
              {reviewItems.length === 0 ? (
                <p className="text-sm text-muted-foreground">No matches awaiting review.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Settlement</TableHead>
                      <TableHead>Bank deposit</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Confidence</TableHead>
                      <TableHead className="text-right">Decision</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {reviewItems.map((m: any) => (
                      <TableRow key={m.id}>
                        <TableCell className="font-mono text-xs">
                          {m.settlement?.settlement_ref}
                          {m.requires_second_approval && (
                            <Badge variant="outline" className="ml-2 text-[10px]">Needs 2nd approval</Badge>
                          )}
                          {m.preparer_user_id && (
                            <div className="text-[10px] text-muted-foreground mt-1">Preparer recorded</div>
                          )}
                        </TableCell>
                        <TableCell className="text-xs">{m.bank_transaction?.transaction_date} · {m.bank_transaction?.description ?? '—'}</TableCell>
                        <TableCell className="text-right">{fmt.formatCurrency(Number(m.matched_amount ?? 0))}</TableCell>
                        <TableCell><Badge variant="outline">{m.match_type}</Badge></TableCell>
                        <TableCell>
                          <Popover>
                            <PopoverTrigger asChild>
                              <Button variant="ghost" size="sm" className="h-7 px-2"><Badge variant="secondary">{Number(m.confidence_score).toFixed(0)}%</Badge></Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-72">
                              <p className="text-xs font-semibold mb-2">Score breakdown</p>
                              <div className="space-y-1 text-xs">
                                {(m.score_breakdown ?? []).map((b: any, i: number) => (
                                  <div key={i} className="flex justify-between">
                                    <span className="text-muted-foreground">{b.rule_key}</span>
                                    <span className={b.contribution < 0 ? 'text-destructive' : ''}>{b.contribution > 0 ? '+' : ''}{b.contribution}</span>
                                  </div>
                                ))}
                                {(!m.score_breakdown || m.score_breakdown.length === 0) && <p className="text-muted-foreground">No breakdown recorded.</p>}
                              </div>
                            </PopoverContent>
                          </Popover>
                        </TableCell>
                        <TableCell className="text-right space-x-1">
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <span>
                                  <Button
                                    size="sm"
                                    variant="default"
                                    onClick={() => approve.mutate(m.id)}
                                    disabled={approve.isPending || (m.requires_second_approval && m.preparer_user_id && m.preparer_user_id === currentUserId)}
                                  >
                                    <ThumbsUp className="h-3 w-3 mr-1" /> {m.requires_second_approval && !m.preparer_user_id ? 'Prepare' : 'Approve'}
                                  </Button>
                                </span>
                              </TooltipTrigger>
                              {m.requires_second_approval && m.preparer_user_id === currentUserId && (
                                <TooltipContent>Segregation of duties: a different user must provide the second approval.</TooltipContent>
                              )}
                            </Tooltip>
                          </TooltipProvider>
                          <Button size="sm" variant="outline" onClick={() => {
                            const r = prompt('Reason for rejecting?');
                            if (r) reject.mutate({ id: m.id, reason: r });
                          }}>
                            <ThumbsDown className="h-3 w-3 mr-1" /> Reject
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="investigation">
          <Card>
            <CardHeader><CardTitle>Investigation queue (low confidence / no candidate)</CardTitle></CardHeader>
            <CardContent>
              {investigationItems.length === 0 ? (
                <p className="text-sm text-muted-foreground">No exceptions.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Processor</TableHead>
                      <TableHead>Reference</TableHead>
                      <TableHead className="text-right">Net</TableHead>
                      <TableHead className="text-right">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {investigationItems.map((s: any) => (
                      <TableRow key={s.id}>
                        <TableCell className="font-mono text-xs">{s.settlement_date}</TableCell>
                        <TableCell>{s.processor_account?.display_name ?? '—'}</TableCell>
                        <TableCell className="font-mono text-xs">{s.settlement_ref}</TableCell>
                        <TableCell className="text-right">{fmt.formatCurrency(Number(s.net_amount), { currencyOverride: s.currency })}</TableCell>
                        <TableCell className="text-right space-x-1">
                          <FindCandidatesButton
                            settlement={s}
                            onReassign={(bankTxId, reason) => reassign.mutate({ settlementId: s.id, bankTransactionId: bankTxId, reason })}
                          />
                          <Button size="sm" variant="outline" onClick={() => {
                            const r = prompt('Reason to write off this settlement?');
                            if (r) markWriteOff.mutate({ settlementId: s.id, reason: r });
                          }}>Write off</Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="rules">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="flex items-center gap-2"><Sliders className="h-4 w-4" /> Scoring rules</CardTitle>
              <Button variant="outline" size="sm" onClick={() => {
                if (confirm('Reset to global defaults? This deletes all org-specific overrides.')) resetToDefaults.mutate();
              }}>Reset to defaults</Button>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Rule</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead className="w-32">Weight</TableHead>
                    <TableHead className="w-24">Active</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rules.map((r: any) => (
                    <TableRow key={r.rule_key}>
                      <TableCell className="font-mono text-xs">{r.rule_key}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{r.description}</TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          defaultValue={r.weight}
                          className="h-8 w-24"
                          onBlur={(e) => {
                            const w = Number(e.target.value);
                            if (w !== Number(r.weight)) upsertRule.mutate({ rule_key: r.rule_key, weight: w, is_active: r.is_active, description: r.description });
                          }}
                        />
                      </TableCell>
                      <TableCell>
                        <Switch checked={r.is_active} onCheckedChange={(v) => upsertRule.mutate({ rule_key: r.rule_key, weight: Number(r.weight), is_active: v, description: r.description })} />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="analytics">
          <SettlementAnalytics />
        </TabsContent>
      </Tabs>

      <Dialog open={!!writeoffTarget} onOpenChange={(o) => { if (!o) setWriteoffTarget(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Write off settlement</DialogTitle>
            <DialogDescription>
              {writeoffTarget && (
                <>
                  Posts a balanced journal entry: DR write-off account / CR destination bank GL for
                  <strong> {fmt.formatCurrency(Number(writeoffTarget.net_amount), { currencyOverride: writeoffTarget.currency })}</strong>.
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Write-off GL account</Label>
              <Select value={writeoffAccountId} onValueChange={setWriteoffAccountId}>
                <SelectTrigger><SelectValue placeholder="Select account" /></SelectTrigger>
                <SelectContent>
                  {expenseAccounts.map((a: any) => (
                    <SelectItem key={a.id} value={a.id}>{a.code} · {a.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Reason</Label>
              <Textarea value={writeoffReason} onChange={(e) => setWriteoffReason(e.target.value)} placeholder="Why is this being written off?" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setWriteoffTarget(null)}>Cancel</Button>
            <Button
              disabled={!writeoffAccountId || !writeoffReason || postWriteoff.isPending}
              onClick={() => {
                if (!writeoffTarget) return;
                postWriteoff.mutate(
                  { settlementId: writeoffTarget.id, writeoffAccountId, reason: writeoffReason },
                  { onSuccess: () => setWriteoffTarget(null) },
                );
              }}
            >
              {postWriteoff.isPending ? 'Posting…' : 'Post write-off'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>


      <AddProcessorAccountDialog
        open={accountDialogOpen}
        onOpenChange={setAccountDialogOpen}
        bankAccounts={bankAccounts ?? []}
        onSave={(payload) => upsertAccount.mutate(payload, { onSuccess: () => setAccountDialogOpen(false) })}
      />
      <ImportCsvDialog
        open={importDialogOpen}
        onOpenChange={setImportDialogOpen}
        accounts={accounts}
        onImport={(processorAccountId, rows, fileName) =>
          importCsv.mutate({ processorAccountId, rows, fileName }, { onSuccess: () => setImportDialogOpen(false) })
        }
      />
      <CopilotPanel open={copilotOpen} onOpenChange={setCopilotOpen} />
    </div>
  );
}

function KpiCard({ icon, label, value, subValue }: { icon: React.ReactNode; label: string; value: number | string; subValue?: string }) {
  return (
    <Card>
      <CardHeader className="pb-2 flex flex-row items-center justify-between">
        <CardTitle className="text-sm text-muted-foreground">{label}</CardTitle>
        {icon}
      </CardHeader>
      <CardContent>
        <p className="text-2xl font-bold">{value}</p>
        {subValue && <p className="text-xs text-muted-foreground mt-1">{subValue}</p>}
      </CardContent>
    </Card>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; variant: any }> = {
    pending: { label: 'Pending', variant: 'secondary' },
    matched: { label: 'Matched', variant: 'default' },
    partially_matched: { label: 'Partial', variant: 'outline' },
    exception: { label: 'Exception', variant: 'destructive' },
    written_off: { label: 'Written off', variant: 'outline' },
  };
  const cfg = map[status] ?? { label: status, variant: 'outline' };
  return <Badge variant={cfg.variant}>{cfg.label}</Badge>;
}

function AddProcessorAccountDialog({
  open, onOpenChange, bankAccounts, onSave,
}: { open: boolean; onOpenChange: (v: boolean) => void; bankAccounts: any[]; onSave: (p: any) => void }) {
  const [form, setForm] = useState({
    processor: 'stripe',
    display_name: '',
    currency: 'USD',
    expected_bank_account_id: '',
    external_account_id: '',
    date_window_days: 3,
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add Processor Account</DialogTitle>
          <DialogDescription>Configure a payment processor account so its payouts can be imported and reconciled.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Display name</Label>
            <Input value={form.display_name} onChange={(e) => setForm({ ...form, display_name: e.target.value })} placeholder="Stripe Main" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Processor</Label>
              <Select value={form.processor} onValueChange={(v) => setForm({ ...form, processor: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="stripe">Stripe</SelectItem>
                  <SelectItem value="adyen">Adyen</SelectItem>
                  <SelectItem value="paysafe">Paysafe</SelectItem>
                  <SelectItem value="square">Square</SelectItem>
                  <SelectItem value="paypal">PayPal</SelectItem>
                  <SelectItem value="generic">Generic</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Currency</Label>
              <CurrencySelect value={form.currency} onChange={(code) => setForm({ ...form, currency: code })} />
            </div>
          </div>
          <div>
            <Label>Destination bank account</Label>
            <Select value={form.expected_bank_account_id} onValueChange={(v) => setForm({ ...form, expected_bank_account_id: v })}>
              <SelectTrigger><SelectValue placeholder="Select bank account" /></SelectTrigger>
              <SelectContent>
                {bankAccounts.map((b) => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>External account ID</Label>
              <Input value={form.external_account_id} onChange={(e) => setForm({ ...form, external_account_id: e.target.value })} placeholder="acct_..." />
            </div>
            <div>
              <Label>Date window (days)</Label>
              <Input type="number" min={0} max={14} value={form.date_window_days}
                onChange={(e) => setForm({ ...form, date_window_days: Number(e.target.value) })} />
            </div>
          </div>
          {form.processor === 'stripe' && (
            <p className="text-xs text-muted-foreground">
              Stripe sync uses the project's <code>STRIPE_SECRET_KEY</code> secret. If it isn't configured, sync will fail with a clear error message.
            </p>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={() => onSave(form)} disabled={!form.display_name || !form.expected_bank_account_id}>Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ImportCsvDialog({
  open, onOpenChange, accounts, onImport,
}: { open: boolean; onOpenChange: (v: boolean) => void; accounts: any[]; onImport: (id: string, rows: any[], fileName?: string) => void }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [processorAccountId, setProcessorAccountId] = useState('');
  const [parsed, setParsed] = useState<{ rows: any[]; fileName: string } | null>(null);

  const handleFile = async (f: File) => {
    const buf = await f.arrayBuffer();
    const wb = XLSX.read(buf, { type: 'array' });
    const ws = wb.Sheets[wb.SheetNames[0]];
    const rows: any[] = XLSX.utils.sheet_to_json(ws, { raw: false, defval: '' });
    // Normalise common header variants
    const cleaned = rows.map((r) => {
      const out: any = {};
      for (const [k, v] of Object.entries(r)) {
        const key = String(k).trim().toLowerCase().replace(/[^a-z0-9]+/g, '_');
        out[key] = typeof v === 'string' ? v.trim() : v;
      }
      // Date normalisation
      if (out.settlement_date) out.settlement_date = toIsoDate(out.settlement_date);
      if (out.expected_deposit_date) out.expected_deposit_date = toIsoDate(out.expected_deposit_date);
      return out;
    });
    setParsed({ rows: cleaned, fileName: f.name });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Import Settlements (CSV / Excel)</DialogTitle>
          <DialogDescription>
            Required columns: <code>settlement_ref</code>, <code>settlement_date</code>, <code>net_amount</code> (or gross/fees/etc.), <code>currency</code>.
            Optional: <code>payer_name</code>, <code>payee_name</code>, <code>payout_ref</code>, <code>expected_deposit_date</code>, <code>fees</code>, <code>chargebacks</code>, <code>refunds</code>, <code>reserves</code>.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Processor account</Label>
            <Select value={processorAccountId} onValueChange={setProcessorAccountId}>
              <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
              <SelectContent>
                {accounts.map((a) => <SelectItem key={a.id} value={a.id}>{a.display_name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>File</Label>
            <Input ref={fileRef} type="file" accept=".csv,.xls,.xlsx" onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])} />
          </div>
          {parsed && <p className="text-xs text-muted-foreground">{parsed.rows.length} rows parsed from {parsed.fileName}.</p>}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button
            onClick={() => parsed && processorAccountId && onImport(processorAccountId, parsed.rows, parsed.fileName)}
            disabled={!parsed || !processorAccountId}
          >Import {parsed ? `${parsed.rows.length} rows` : ''}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function FindCandidatesButton({ settlement, onReassign }: { settlement: any; onReassign: (bankTxId: string, reason: string) => void }) {
  const [open, setOpen] = useState(false);
  const [candidates, setCandidates] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const fmt = useCurrencyFormatter();
  const { organization } = useCurrentOrganization();

  const load = async () => {
    if (!organization?.id) return;
    setLoading(true);
    const expected = settlement.expected_deposit_date ?? settlement.settlement_date;
    const lo = shiftDateStr(expected, -7);
    const hi = shiftDateStr(expected, 7);
    const target = Math.abs(Number(settlement.net_amount));
    const { data } = await supabase
      .from('bank_transactions')
      .select('id, transaction_date, amount, description, reference_number:reference, bank_account_id, status')
      .gte('transaction_date', lo)
      .lte('transaction_date', hi)
      .eq('transaction_type', 'deposit')
      .limit(50);
    const filtered = (data ?? []).filter((b: any) => Math.abs(Math.abs(Number(b.amount)) - target) < target * 0.25);
    setCandidates(filtered);
    setLoading(false);
  };

  return (
    <>
      <Button size="sm" variant="outline" onClick={() => { setOpen(true); load(); }}>
        <Search className="h-3 w-3 mr-1" /> Find
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Candidate bank deposits</DialogTitle>
            <DialogDescription>Net amount {fmt.formatCurrency(Number(settlement.net_amount), { currencyOverride: settlement.currency })} · Expected {settlement.expected_deposit_date ?? settlement.settlement_date}</DialogDescription>
          </DialogHeader>
          {loading ? <p className="text-sm text-muted-foreground">Searching…</p> : candidates.length === 0 ? (
            <p className="text-sm text-muted-foreground">No nearby bank deposits found.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {candidates.map((b) => (
                  <TableRow key={b.id}>
                    <TableCell className="font-mono text-xs">{b.transaction_date}</TableCell>
                    <TableCell className="text-xs">{b.description}</TableCell>
                    <TableCell className="text-right">{fmt.formatCurrency(Number(b.amount))}</TableCell>
                    <TableCell>
                      <Button size="sm" onClick={() => {
                        const reason = prompt('Note for this manual match (optional)?') ?? '';
                        onReassign(b.id, reason);
                        setOpen(false);
                      }}>Assign</Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

function shiftDateStr(yyyyMmDd: string, days: number): string {
  if (!yyyyMmDd) return yyyyMmDd;
  const d = new Date(yyyyMmDd + 'T00:00:00');
  d.setDate(d.getDate() + days);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}


function toIsoDate(input: string): string {
  if (!input) return input;
  // Already YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}/.test(input)) return input.slice(0, 10);
  const d = new Date(input);
  if (Number.isNaN(d.getTime())) return input;
  return d.toISOString().slice(0, 10);
}

function ExceptionRow({ settlement: s, expanded, onToggle, onWriteoff, fmt }: { settlement: any; expanded: boolean; onToggle: () => void; onWriteoff: () => void; fmt: any }) {
  const { candidates, isLoading, acceptCandidate } = useFuzzyCandidates(expanded ? s.id : null);
  return (
    <>
      <TableRow className="cursor-pointer" onClick={onToggle}>
        <TableCell className="font-mono text-xs">{s.settlement_date}</TableCell>
        <TableCell>{s.processor_account?.display_name ?? '—'}</TableCell>
        <TableCell className="font-mono text-xs">{s.settlement_ref}</TableCell>
        <TableCell className="text-right font-medium">{fmt.formatCurrency(Number(s.net_amount), { currencyOverride: s.currency })}</TableCell>
        <TableCell><Badge variant={['8-14d', '15-30d', '30d+'].includes(s.aging_bucket) ? 'destructive' : 'secondary'}>{s.aging_bucket ?? '—'}</Badge></TableCell>
        <TableCell className="text-xs text-muted-foreground">{s.exception_reason ?? '—'}</TableCell>
        <TableCell className="text-right">
          <Button size="sm" variant="outline" onClick={(e) => { e.stopPropagation(); onWriteoff(); }}>
            <ThumbsDown className="h-3 w-3 mr-1" /> Write off
          </Button>
        </TableCell>
      </TableRow>
      {expanded && (
        <TableRow>
          <TableCell colSpan={7} className="bg-muted/30">
            <div className="space-y-2 p-2">
              <p className="text-xs font-semibold flex items-center gap-1"><Sparkles className="h-3 w-3" /> Fuzzy candidates</p>
              {isLoading ? <p className="text-xs text-muted-foreground">Loading…</p> : candidates.length === 0 ? (
                <p className="text-xs text-muted-foreground">No fuzzy candidates cached. Run matching with Level 5 enabled.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Bank deposit</TableHead>
                      <TableHead>Date Δ</TableHead>
                      <TableHead className="text-right">Amount Δ</TableHead>
                      <TableHead>Similarity</TableHead>
                      <TableHead>Score</TableHead>
                      <TableHead className="text-right">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {candidates.map((c: any) => (
                      <TableRow key={c.id}>
                        <TableCell className="text-xs">{c.bank_transaction?.transaction_date} · {c.bank_transaction?.description ?? '—'}</TableCell>
                        <TableCell className="text-xs">{c.date_delta_days}d</TableCell>
                        <TableCell className="text-right text-xs">{fmt.formatCurrency(Number(c.amount_delta))}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <div className="w-16 h-1.5 bg-muted rounded overflow-hidden">
                              <div className="h-full bg-primary" style={{ width: `${Math.round(Number(c.similarity_score) * 100)}%` }} />
                            </div>
                            <span className="text-xs">{Math.round(Number(c.similarity_score) * 100)}%</span>
                          </div>
                        </TableCell>
                        <TableCell><Badge variant={Number(c.total_score) >= 80 ? 'default' : 'secondary'}>{Math.round(Number(c.total_score))}</Badge></TableCell>
                        <TableCell className="text-right">
                          <Button size="sm" variant="outline" className="mr-1" onClick={() => acceptCandidate.mutate({ candidateId: c.id, autoApprove: false })}>
                            Send to review
                          </Button>
                          <Button size="sm" onClick={() => acceptCandidate.mutate({ candidateId: c.id, autoApprove: true })}>
                            <ThumbsUp className="h-3 w-3 mr-1" /> Accept
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </div>
          </TableCell>
        </TableRow>
      )}
    </>
  );
}

