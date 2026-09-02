import { useEffect, useMemo, useRef, useState } from 'react';
import { QueryClient, QueryClientProvider, useQuery, useQueryClient } from '@tanstack/react-query';
import { Check, ClipboardList, Clock3, LogIn, Mail, Phone, RefreshCw, Search, ShieldCheck, Trash2, UserRound, Users, X } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { Link, Route, Switch, Router as WouterRouter, useLocation } from 'wouter';
import {
  getGetVisitorSummaryQueryKey,
  getHealthCheckQueryKey,
  getListVisitorsQueryKey,
  useCreateVisitor,
  useDeleteVisitor,
  useGetVisitorSummary,
  useHealthCheck,
  useListVisitors,
} from '@workspace/api-client-react';
import { addOfflineVisitor, deleteLocalVisitor, fetchVisitorsOfflineSafe, getLocalSummary, getLocalVisitors, saveLocalVisitors, syncOfflineData } from './offline';
import { ErrorBoundary } from '@/components/error-boundary';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import NotFound from '@/pages/not-found';
import type { ReactNode } from 'react';

type RegisterForm = {
  name: string;
  phone: string;
  personToMeet: string;
  purpose: string;
};

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 15_000, refetchOnWindowFocus: true } },
});

function formatDate(date: Date) {
  return new Intl.DateTimeFormat('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }).format(date);
}

function formatTime(value: string | Date | null | undefined) {
  if (!value) return 'No check-ins yet';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Recently';
  return new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit' }).format(date);
}

type VisitorRecord = {
  id: number;
  name: string;
  phone: string;
  personToMeet: string;
  purpose: string;
  checkedInAt: string | Date;
};

function formatFullCheckIn(value: string | Date) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Recently';
  return new Intl.DateTimeFormat('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(date);
}

function initials(name: string) {
  return name.split(' ').filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join('') || '?';
}

function Field({ label, name, placeholder, icon, register, error, type = 'text', maxLength }: {
  label: string;
  name: keyof RegisterForm;
  placeholder: string;
  icon: ReactNode;
  register: ReturnType<typeof useForm<RegisterForm>>['register'];
  error?: string;
  type?: string;
  maxLength?: number;
}) {
  return (
    <div className="field-group">
      <label className="field-label" htmlFor={`field-${name}`}>{label}</label>
      <div className="input-wrap">
        <span className="input-icon">{icon}</span>
        <input
          id={`field-${name}`}
          data-testid={`input-${name}`}
          className="input-control"
          type={type}
          maxLength={maxLength}
          placeholder={placeholder}
          autoComplete="off"
          {...register(name, { required: `${label} is required` })}
        />
      </div>
      {error ? <span className="input-error" data-testid={`error-${name}`}>{error}</span> : null}
    </div>
  );
}

function Navigation() {
  return (
    <>
      <aside className="side-rail">
        <div style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '0 8px' }}>
          <div className="brand-mark" aria-hidden="true"><LogIn size={19} strokeWidth={2.5} /></div>
          <div><div className="brand-name">Harbor</div><div className="brand-caption">front desk</div></div>
        </div>
        <div style={{ marginTop: 48 }}>
          <div className="brand-caption" style={{ padding: '0 12px', marginBottom: 10 }}>Workspace</div>
          <Link href="/" className="rail-link active" data-testid="link-register"><ClipboardList size={17} /> Register</Link>
          <button className="rail-link" onClick={() => document.getElementById('visitor-history')?.scrollIntoView({ behavior: 'smooth' })} data-testid="button-history"><Clock3 size={17} /> Visitor history</button>
        </div>
        <div className="rail-footer">
          <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
            <span className="status-dot" aria-hidden="true" />
            <span style={{ fontSize: 12, fontWeight: 600 }}>Desk is online</span>
          </div>
          <p style={{ color: 'hsl(var(--sidebar-foreground) / .5)', fontSize: 11, lineHeight: 1.5, margin: '8px 0 0 16px' }}>Ready to welcome today’s guests.</p>
        </div>
      </aside>
      <nav className="mobile-nav" aria-label="Workspace navigation">
        <Link href="/" className="rail-link active" data-testid="mobile-link-register"><ClipboardList size={15} /> Register</Link>
        <button className="rail-link" onClick={() => document.getElementById('visitor-history')?.scrollIntoView({ behavior: 'smooth' })} data-testid="mobile-button-history"><Clock3 size={15} /> History</button>
      </nav>
    </>
  );
}

function Header() {
  const [location] = useLocation();
  const health = useHealthCheck({ query: { queryKey: getHealthCheckQueryKey(), refetchInterval: 60_000 } });
  const [offline, setOffline] = useState(!navigator.onLine);
  useEffect(() => { const on = () => setOffline(false); const off = () => setOffline(true); window.addEventListener('online', on); window.addEventListener('offline', off); return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off); }; }, []);
  const online = !offline && !health.isError && health.data?.status !== 'error';
  return (
    <header className="topbar">
      <div className="mobile-brand">
        <div className="brand-mark" aria-hidden="true"><LogIn size={16} strokeWidth={2.5} /></div>
        <div className="brand-name">Harbor</div>
      </div>
      <div className="topbar-meta" style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'hsl(var(--muted-foreground))', fontSize: 12 }}>
        <span style={{ width: 6, height: 6, borderRadius: 99, background: online ? 'hsl(143 48% 48%)' : 'hsl(var(--destructive))' }} />
        {online ? 'Connected to register' : 'Offline mode — saved on this device'}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
        <div style={{ width: 30, height: 30, display: 'grid', placeItems: 'center', borderRadius: 9, color: 'hsl(var(--primary))', background: 'hsl(var(--primary) / .1)' }}><ShieldCheck size={16} /></div>
        <div className="topbar-meta" style={{ color: 'hsl(var(--foreground))', fontSize: 12, fontWeight: 700 }}>Reception desk</div>
      </div>
      <span className="sr-only" data-testid="text-current-location">{location}</span>
    </header>
  );
}

function RegisterFormCard() {
  const queryClient = useQueryClient();
  const [successName, setSuccessName] = useState('');
  const [savedOffline, setSavedOffline] = useState(false);
  const successTimer = useRef<number | null>(null);
  const createVisitor = useCreateVisitor();
  const form = useForm<RegisterForm>({ defaultValues: { name: '', phone: '', personToMeet: '', purpose: '' } });
  const finishLocal = (name: string, offline = false) => {
    setSuccessName(name);
    setSavedOffline(offline);
    form.reset();
    void queryClient.invalidateQueries({ queryKey: getListVisitorsQueryKey() });
    void queryClient.invalidateQueries({ queryKey: getGetVisitorSummaryQueryKey() });
    if (successTimer.current !== null) window.clearTimeout(successTimer.current);
    successTimer.current = window.setTimeout(() => setSuccessName(''), 5000);
  };
  const onSubmit = (values: RegisterForm) => {
    if (!navigator.onLine) { addOfflineVisitor(values); finishLocal(values.name, true); return; }
    createVisitor.mutate({ data: values }, {
      onSuccess: () => finishLocal(values.name),
      onError: () => { addOfflineVisitor(values); finishLocal(values.name, true); },
    });
  };
  useEffect(() => () => {
    if (successTimer.current !== null) window.clearTimeout(successTimer.current);
  }, []);

  const errorMessage = createVisitor.isError ? 'We couldn’t save that arrival. Check the details and try again.' : '';
  return (
    <section className="surface form-surface" aria-labelledby="register-heading">
      <div className="surface-header">
        <div><h2 className="surface-title" id="register-heading">New arrival</h2><p className="surface-kicker">A few details, then they’re on their way.</p></div>
        <div style={{ color: 'hsl(var(--primary))' }}><UserRound size={19} /></div>
      </div>
      <form className="form-body" onSubmit={form.handleSubmit(onSubmit)} noValidate>
        <Field label="Visitor name" name="name" placeholder="e.g. Samira Patel" maxLength={120} icon={<UserRound size={16} />} register={form.register} error={form.formState.errors.name?.message} />
        <Field label="Phone number" name="phone" placeholder="e.g. 415 555 0148" maxLength={40} icon={<Phone size={16} />} register={form.register} error={form.formState.errors.phone?.message} type="tel" />
        <Field label="Person to meet" name="personToMeet" placeholder="Who are they here to see?" maxLength={120} icon={<Users size={16} />} register={form.register} error={form.formState.errors.personToMeet?.message} />
        <Field label="Purpose of visit" name="purpose" placeholder="e.g. Project review" maxLength={500} icon={<Mail size={16} />} register={form.register} error={form.formState.errors.purpose?.message} />
        <button className="submit-button" type="submit" disabled={createVisitor.isPending} data-testid="button-submit-visitor">
          {createVisitor.isPending ? <><RefreshCw size={16} className="animate-spin" /> Saving arrival</> : <><LogIn size={16} /> Check visitor in</>}
        </button>
        {errorMessage ? <div className="input-error" style={{ marginTop: 11 }} role="alert" data-testid="status-create-error">{errorMessage}</div> : null}
        {successName ? <div className="success-note" role="status" data-testid="status-create-success"><Check size={16} /> {successName} {savedOffline ? 'is saved on this device and will sync when online.' : 'is checked in.'}</div> : null}
      </form>
    </section>
  );
}

function SummaryBand() {
  const summary = useQuery({ queryKey: getGetVisitorSummaryQueryKey(), queryFn: async () => {
    try {
      const response = await fetch('/api/visitors/summary');
      if (!response.ok) throw new Error('summary unavailable');
      return await response.json() as { total: number; today: number; latestCheckIn: string | null };
    } catch { return getLocalSummary(); }
  } });
  if (summary.isLoading) {
    return <div className="surface summary-band" data-testid="loading-summary"><div className="metric metric-main"><div className="skeleton-line" style={{ width: 60, background: 'hsl(var(--sidebar-accent))' }} /></div><div className="metric"><div className="skeleton-line" /></div><div className="metric"><div className="skeleton-line" /></div></div>;
  }
  if (summary.isError || !summary.data) {
    return <div className="surface state-box" style={{ marginBottom: 18 }} data-testid="status-summary-error"><div className="state-title">Summary unavailable</div><p className="state-copy">The visitor list is still available below.</p><button className="retry-button" onClick={() => void summary.refetch()} data-testid="button-retry-summary">Try again</button></div>;
  }
  return (
    <section className="surface summary-band" aria-label="Visitor summary" data-testid="summary-band">
      <div className="metric metric-main"><div className="metric-label">All time arrivals</div><div className="metric-value" data-testid="text-total-visitors">{summary.data.total}</div><div className="metric-note">Every welcome, recorded</div></div>
      <div className="metric"><div className="metric-label">Today</div><div className="metric-value" data-testid="text-today-visitors">{summary.data.today}</div><div className="metric-note">On the register</div></div>
      <div className="metric"><div className="metric-label">Latest check-in</div><div className="metric-value" style={{ fontSize: 23, marginTop: 17 }} data-testid="text-latest-checkin">{formatTime(summary.data.latestCheckIn)}</div><div className="metric-note">Most recent arrival</div></div>
    </section>
  );
}

function VisitorDetail({ visitor, onClose }: { visitor: VisitorRecord; onClose: () => void }) {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKeyDown);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
    };
  }, [onClose]);

  return (
    <div
      className="detail-backdrop"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section className="detail-dialog" role="dialog" aria-modal="true" aria-labelledby="visitor-detail-heading">
        <div className="detail-dialog-header">
          <div>
            <div className="eyebrow">Visitor details</div>
            <h2 className="detail-dialog-title" id="visitor-detail-heading">{visitor.name}</h2>
          </div>
          <button className="detail-close" type="button" onClick={onClose} aria-label="Close visitor details" data-testid="button-close-visitor-details">
            <X size={18} />
          </button>
        </div>
        <div className="detail-identity">
          <div className="initials detail-initials" aria-hidden="true">{initials(visitor.name)}</div>
          <div>
            <div className="detail-identity-name">{visitor.name}</div>
            <a className="detail-phone" href={`tel:${visitor.phone}`}>{visitor.phone}</a>
          </div>
        </div>
        <dl className="detail-list">
          <div className="detail-row">
            <dt>Person to meet</dt>
            <dd>{visitor.personToMeet}</dd>
          </div>
          <div className="detail-row">
            <dt>Purpose of visit</dt>
            <dd>{visitor.purpose}</dd>
          </div>
          <div className="detail-row">
            <dt>Checked in</dt>
            <dd>{formatFullCheckIn(visitor.checkedInAt)}</dd>
          </div>
        </dl>
        <button className="detail-done" type="button" onClick={onClose}>Done</button>
      </section>
    </div>
  );
}

function DeleteVisitorDialog({
  visitor,
  isDeleting,
  hasError,
  onConfirm,
  onClose,
}: {
  visitor: VisitorRecord;
  isDeleting: boolean;
  hasError: boolean;
  onConfirm: () => void;
  onClose: () => void;
}) {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !isDeleting) onClose();
    };
    document.addEventListener('keydown', handleKeyDown);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
    };
  }, [isDeleting, onClose]);

  return (
    <div
      className="detail-backdrop"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !isDeleting) onClose();
      }}
    >
      <section className="detail-dialog delete-dialog" role="alertdialog" aria-modal="true" aria-labelledby="delete-visitor-heading" aria-describedby="delete-visitor-copy">
        <div className="delete-icon" aria-hidden="true"><Trash2 size={20} /></div>
        <h2 className="detail-dialog-title" id="delete-visitor-heading">Delete this record?</h2>
        <p className="delete-copy" id="delete-visitor-copy">
          This will permanently remove <strong>{visitor.name}</strong> from the visitor history.
        </p>
        {hasError ? <p className="delete-error" role="alert">We couldn’t delete this record. Please try again.</p> : null}
        <div className="delete-actions">
          <button className="detail-cancel" type="button" onClick={onClose} disabled={isDeleting}>Keep record</button>
          <button className="delete-confirm" type="button" onClick={onConfirm} disabled={isDeleting} data-testid={`button-confirm-delete-${visitor.id}`}>
            {isDeleting ? <><RefreshCw size={15} className="animate-spin" /> Deleting</> : <><Trash2 size={15} /> Delete record</>}
          </button>
        </div>
      </section>
    </div>
  );
}

function VisitorHistory() {
  const [search, setSearch] = useState('');
  const [selectedVisitor, setSelectedVisitor] = useState<VisitorRecord | null>(null);
  const [visitorToDelete, setVisitorToDelete] = useState<VisitorRecord | null>(null);
  const queryClient = useQueryClient();
  const deleteVisitor = useDeleteVisitor();
  const params = useMemo(() => ({ search: search.trim() || undefined }), [search]);
  const visitors = useQuery({ queryKey: getListVisitorsQueryKey(params), queryFn: () => fetchVisitorsOfflineSafe(params.search), staleTime: 5000 });
  const confirmDelete = () => {
    if (!visitorToDelete) return;
    if (visitorToDelete.id < 0 || !navigator.onLine) {
      deleteLocalVisitor(visitorToDelete.id);
      setVisitorToDelete(null);
      void queryClient.invalidateQueries({ queryKey: getListVisitorsQueryKey() });
      void queryClient.invalidateQueries({ queryKey: getGetVisitorSummaryQueryKey() });
      return;
    }
    deleteVisitor.mutate({ id: visitorToDelete.id }, {
      onSuccess: () => {
        deleteLocalVisitor(visitorToDelete.id);
        setVisitorToDelete(null);
        void queryClient.invalidateQueries({ queryKey: getListVisitorsQueryKey() });
        void queryClient.invalidateQueries({ queryKey: getGetVisitorSummaryQueryKey() });
      },
      onError: () => {
        deleteLocalVisitor(visitorToDelete.id);
        setVisitorToDelete(null);
        void queryClient.invalidateQueries({ queryKey: getListVisitorsQueryKey() });
        void queryClient.invalidateQueries({ queryKey: getGetVisitorSummaryQueryKey() });
      },
    });
  };
  return (
    <>
      <section className="surface log-surface" id="visitor-history" aria-labelledby="history-heading">
      <div className="surface-header">
        <div><h2 className="surface-title" id="history-heading">Visitor history</h2><p className="surface-kicker">{search ? `Results matching “${search}”` : 'The front desk, at a glance.'}</p></div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'hsl(var(--muted-foreground))', fontSize: 11 }}><Clock3 size={14} /> Newest first</div>
      </div>
      <div className="log-toolbar">
        <div className="search-wrap">
          <Search className="input-icon" size={16} />
          <label className="sr-only" htmlFor="visitor-search">Search visitors</label>
          <input id="visitor-search" className="input-control" type="search" maxLength={100} value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search by name, host, or purpose" data-testid="input-search-visitors" />
          {search ? <button className="clear-search" type="button" onClick={() => setSearch('')} aria-label="Clear search" data-testid="button-clear-search"><X size={15} /></button> : null}
        </div>
        <button className="refresh-button" type="button" onClick={() => void visitors.refetch()} aria-label="Refresh visitor history" data-testid="button-refresh-visitors"><RefreshCw size={15} className={visitors.isFetching ? 'animate-spin' : ''} /></button>
      </div>
      {visitors.isLoading ? <div className="loading-block" data-testid="loading-visitors"><div className="skeleton-line" /><div className="skeleton-line" /><div className="skeleton-line" /><div className="skeleton-line" /></div> : null}
      {visitors.isError ? <div className="state-box" role="alert" data-testid="status-visitors-error"><div className="state-icon"><RefreshCw size={19} /></div><div className="state-title">Couldn’t load the register</div><p className="state-copy">Give it another moment, then try refreshing the visitor history.</p><button className="retry-button" onClick={() => void visitors.refetch()} data-testid="button-retry-visitors">Try again</button></div> : null}
      {!visitors.isLoading && !visitors.isError && visitors.data?.length === 0 ? <div className="state-box" data-testid="status-visitors-empty"><div className="state-icon"><ClipboardList size={19} /></div><div className="state-title">{search ? 'No matching visitors' : 'Your register is clear'}</div><p className="state-copy">{search ? 'Try a different name, host, or purpose.' : 'Checked-in guests will appear here, newest first.'}</p>{search ? <button className="retry-button" onClick={() => setSearch('')} data-testid="button-reset-search">Show everyone</button> : null}</div> : null}
      {!visitors.isLoading && !visitors.isError && (visitors.data?.length ?? 0) > 0 ? (
        <div style={{ overflowX: 'auto' }}>
          <table className="visitor-table">
            <thead><tr><th>Visitor</th><th>Meeting with</th><th>Visit purpose</th><th style={{ textAlign: 'right' }}>Checked in</th><th className="actions-heading"><span className="sr-only">Actions</span></th></tr></thead>
            <tbody>
              {visitors.data?.map((visitor, index) => (
                <tr key={visitor.id} style={{ animationDelay: `${Math.min(index, 6) * 45}ms` }} data-testid={`row-visitor-${visitor.id}`}>
                  <td><div className="person-cell"><div className="initials" aria-hidden="true">{initials(visitor.name)}</div><div><button className="person-name visitor-name-button" type="button" onClick={() => setSelectedVisitor(visitor)} data-testid={`button-visitor-name-${visitor.id}`}>{visitor.name}</button><div className="person-phone">{visitor.phone}</div></div></div></td>
                  <td><div className="muted-cell" style={{ marginTop: 0 }}>{visitor.personToMeet}</div></td>
                  <td><span className="purpose-pill">{visitor.purpose}</span></td>
                  <td className="time-cell">{formatTime(visitor.checkedInAt)}</td>
                  <td className="action-cell"><button className="delete-button" type="button" onClick={() => setVisitorToDelete(visitor)} aria-label={`Delete ${visitor.name}`} data-testid={`button-delete-visitor-${visitor.id}`}><Trash2 size={15} /></button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
      </section>
      {selectedVisitor ? <VisitorDetail visitor={selectedVisitor} onClose={() => setSelectedVisitor(null)} /> : null}
      {visitorToDelete ? <DeleteVisitorDialog visitor={visitorToDelete} isDeleting={deleteVisitor.isPending} hasError={deleteVisitor.isError} onConfirm={confirmDelete} onClose={() => { if (!deleteVisitor.isPending) setVisitorToDelete(null); }} /> : null}
    </>
  );
}

function Home() {
  return (
    <div className="app-shell">
      <Navigation />
      <div className="main-area">
        <Header />
        <main className="content-wrap">
          <div className="welcome-row">
            <div><div className="eyebrow">Good morning, reception</div><h1 className="page-title" style={{ marginTop: 9 }}>Welcome them in.</h1><p className="page-subtitle" style={{ marginTop: 13 }}>A clear record of everyone who walks through the door.</p></div>
            <div className="date-stamp"><strong>{formatDate(new Date())}</strong>Harbor office · Desk 01</div>
          </div>
          <SummaryBand />
          <div className="dashboard-grid">
            <RegisterFormCard />
            <VisitorHistory />
          </div>
        </main>
      </div>
    </div>
  );
}

function Router() {
  return <ErrorBoundary resetKey={useLocation()[0]}><Switch><Route path="/" component={Home} /><Route component={NotFound} /></Switch></ErrorBoundary>;
}

function App() {
  useEffect(() => {
    void syncOfflineData();
    const onOnline = () => { void syncOfflineData().then(() => { void queryClient.invalidateQueries(); }); };
    window.addEventListener('online', onOnline);
    if ('serviceWorker' in navigator) void navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`).catch(() => undefined);
    return () => window.removeEventListener('online', onOnline);
  }, []);
  return <QueryClientProvider client={queryClient}><TooltipProvider><WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}><Router /></WouterRouter><Toaster /></TooltipProvider></QueryClientProvider>;
}

export default App;