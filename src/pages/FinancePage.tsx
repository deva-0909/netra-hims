import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../lib/AuthContext';

const ACCOUNT_TYPES = ['asset', 'liability', 'equity', 'income', 'expense'];
const PAYMENT_METHODS = ['cash', 'bank_transfer', 'cheque', 'card', 'upi', 'other'];
const CASH_LIKE = new Set(['cash', 'other']);

const todayISO = () => new Date().toISOString().slice(0, 10);

// ---------------- Chart of Accounts ----------------

function AddAccountForm({ onDone }: { onDone: () => void }) {
  const qc = useQueryClient();
  const [form, setForm] = useState({ account_code: '', account_name: '', account_type: 'expense' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const set = (k: string, v: string) => setForm((prev) => ({ ...prev, [k]: v }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.account_code.trim() || !form.account_name.trim()) return;
    setSaving(true);
    setError(null);
    const { error: insertError } = await supabase.from('chart_of_accounts').insert(form);
    setSaving(false);
    if (insertError) { setError(insertError.message); return; }
    qc.invalidateQueries({ queryKey: ['chart-of-accounts'] });
    onDone();
  };

  return (
    <form onSubmit={submit} style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'flex-end', padding: 'var(--space-3)', background: 'var(--color-accent-100)', marginBottom: 'var(--space-3)', borderRadius: 'var(--radius-md)' }}>
      <div className="field"><label>Code</label><input className="input" style={{ width: 90 }} value={form.account_code} onChange={(e) => set('account_code', e.target.value)} required /></div>
      <div className="field" style={{ flex: '1 1 220px' }}><label>Name</label><input className="input" value={form.account_name} onChange={(e) => set('account_name', e.target.value)} required /></div>
      <div className="field">
        <label>Type</label>
        <select className="input" value={form.account_type} onChange={(e) => set('account_type', e.target.value)}>
          {ACCOUNT_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
      </div>
      <button className="btn btn-primary" type="submit" disabled={saving}>{saving ? 'Saving…' : 'Add account'}</button>
      <button className="btn btn-ghost" type="button" onClick={onDone}>Cancel</button>
      {error && <span style={{ color: '#b64545', fontSize: 12 }}>{error}</span>}
    </form>
  );
}

function ChartOfAccountsTab({ isAccountant }: { isAccountant: boolean }) {
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const { data: accounts, isLoading } = useQuery({
    queryKey: ['chart-of-accounts'],
    queryFn: async () => {
      const { data, error } = await supabase.from('chart_of_accounts').select('*').order('account_code');
      if (error) throw error;
      return data;
    },
  });

  const toggleActive = async (a: any) => {
    await supabase.from('chart_of_accounts').update({ active: !a.active }).eq('id', a.id);
    qc.invalidateQueries({ queryKey: ['chart-of-accounts'] });
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
        <p className="text-muted" style={{ fontSize: 13, margin: 0 }}>The account list every journal entry and expense posts against.</p>
        {isAccountant && !showForm && <button className="btn btn-primary" onClick={() => setShowForm(true)}>+ Add account</button>}
      </div>
      {showForm && <AddAccountForm onDone={() => setShowForm(false)} />}
      {isLoading ? <p className="text-muted">Loading…</p> : (
        ACCOUNT_TYPES.map((type) => {
          const rows = (accounts ?? []).filter((a: any) => a.account_type === type);
          if (rows.length === 0) return null;
          return (
            <div key={type} style={{ marginBottom: 'var(--space-4)' }}>
              <h4 style={{ textTransform: 'capitalize', marginBottom: 6 }}>{type}</h4>
              <table className="table">
                <tbody>
                  {rows.map((a: any) => (
                    <tr key={a.id} style={a.active ? undefined : { opacity: 0.6 }}>
                      <td style={{ width: 80 }}>{a.account_code}</td>
                      <td>{a.account_name} {a.is_system && <span className="text-muted" style={{ fontSize: 11 }}>(system)</span>}</td>
                      {isAccountant && !a.is_system && <td><button className="btn btn-ghost" onClick={() => toggleActive(a)}>{a.active ? 'Deactivate' : 'Reactivate'}</button></td>}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          );
        })
      )}
    </div>
  );
}

// ---------------- Journal ----------------

interface JELine { account_id: string; debit: string; credit: string; description: string }
const emptyLine = (): JELine => ({ account_id: '', debit: '', credit: '', description: '' });

function NewJournalEntryForm({ accounts, onDone }: { accounts: any[]; onDone: () => void }) {
  const { profile } = useAuth();
  const qc = useQueryClient();
  const [entryDate, setEntryDate] = useState(todayISO());
  const [reference, setReference] = useState('');
  const [description, setDescription] = useState('');
  const [lines, setLines] = useState<JELine[]>([emptyLine(), emptyLine()]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const setLine = (i: number, k: keyof JELine, v: string) => setLines((prev) => prev.map((l, idx) => (idx === i ? { ...l, [k]: v } : l)));

  const totalDebit = lines.reduce((s, l) => s + (Number(l.debit) || 0), 0);
  const totalCredit = lines.reduce((s, l) => s + (Number(l.credit) || 0), 0);
  const balanced = totalDebit > 0 && totalDebit === totalCredit;

  const submit = async (post: boolean) => {
    const validLines = lines.filter((l) => l.account_id && (Number(l.debit) > 0 || Number(l.credit) > 0));
    if (!description.trim() || validLines.length < 2) return;
    setSaving(true);
    setError(null);
    const { data: entry, error: entryError } = await supabase.from('journal_entries').insert({
      entry_date: entryDate, reference: reference || null, description, created_by: profile?.id,
    }).select().single();
    if (entryError || !entry) { setSaving(false); setError(entryError?.message ?? 'Could not create entry.'); return; }
    const { error: linesError } = await supabase.from('journal_entry_lines').insert(
      validLines.map((l) => ({ journal_entry_id: entry.id, account_id: l.account_id, debit: Number(l.debit) || 0, credit: Number(l.credit) || 0, description: l.description || null })),
    );
    if (linesError) { setSaving(false); setError(linesError.message); return; }
    if (post) {
      const { error: postError } = await supabase.from('journal_entries').update({ posted: true }).eq('id', entry.id);
      if (postError) { setSaving(false); setError(postError.message); return; }
    }
    setSaving(false);
    qc.invalidateQueries({ queryKey: ['journal-entries'] });
    onDone();
  };

  return (
    <div className="card blueprint elev-md" style={{ padding: 'var(--space-4)', marginBottom: 'var(--space-5)' }}>
      <i className="corner tl" /><i className="corner tr" /><i className="corner bl" /><i className="corner br" />
      <h4 style={{ marginTop: 0 }}>New journal entry</h4>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-3)' }}>
        <div className="field" style={{ flex: '1 1 150px' }}><label>Date</label><input className="input" type="date" value={entryDate} onChange={(e) => setEntryDate(e.target.value)} /></div>
        <div className="field" style={{ flex: '1 1 160px' }}><label>Reference</label><input className="input" value={reference} onChange={(e) => setReference(e.target.value)} /></div>
        <div className="field" style={{ flex: '1 1 100%' }}><label>Description *</label><input className="input" value={description} onChange={(e) => setDescription(e.target.value)} required /></div>
      </div>

      <h5 style={{ marginTop: 14, marginBottom: 6 }}>Lines</h5>
      {lines.map((l, i) => (
        <div key={i} style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 6, alignItems: 'flex-end' }}>
          <div className="field" style={{ flex: '2 1 220px' }}>
            <label>Account</label>
            <select className="input" value={l.account_id} onChange={(e) => setLine(i, 'account_id', e.target.value)}>
              <option value="">Select…</option>
              {accounts.map((a: any) => <option key={a.id} value={a.id}>{a.account_code} — {a.account_name}</option>)}
            </select>
          </div>
          <div className="field" style={{ flex: '1 1 110px' }}><label>Debit</label><input className="input" type="number" value={l.debit} onChange={(e) => { setLine(i, 'debit', e.target.value); if (e.target.value) setLine(i, 'credit', ''); }} /></div>
          <div className="field" style={{ flex: '1 1 110px' }}><label>Credit</label><input className="input" type="number" value={l.credit} onChange={(e) => { setLine(i, 'credit', e.target.value); if (e.target.value) setLine(i, 'debit', ''); }} /></div>
          <div className="field" style={{ flex: '1 1 160px' }}><label>Line note</label><input className="input" value={l.description} onChange={(e) => setLine(i, 'description', e.target.value)} /></div>
          {lines.length > 2 && <button type="button" className="btn btn-ghost" style={{ paddingBottom: 8 }} onClick={() => setLines((prev) => prev.filter((_, idx) => idx !== i))}>Remove</button>}
        </div>
      ))}
      <button type="button" className="btn btn-ghost" onClick={() => setLines((prev) => [...prev, emptyLine()])}>+ Add line</button>

      <div style={{ marginTop: 8, fontSize: 13 }}>
        Debit: ₹{totalDebit.toFixed(2)} · Credit: ₹{totalCredit.toFixed(2)}{' '}
        {balanced ? <span style={{ color: '#2e6b49' }}>balanced</span> : <span style={{ color: '#8a2c2c' }}>not balanced</span>}
      </div>

      {error && <div style={{ color: '#b64545', fontSize: 13, marginTop: 6 }}>{error}</div>}
      <div style={{ marginTop: 10, display: 'flex', gap: 8 }}>
        <button className="btn btn-primary" onClick={() => submit(true)} disabled={saving || !balanced}>{saving ? 'Saving…' : 'Save & post'}</button>
        <button className="btn btn-secondary" onClick={() => submit(false)} disabled={saving}>Save as draft</button>
        <button className="btn btn-ghost" type="button" onClick={onDone}>Cancel</button>
      </div>
    </div>
  );
}

function JournalEntryRow({ entry }: { entry: any }) {
  const qc = useQueryClient();
  const [expanded, setExpanded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { data: lines } = useQuery({
    queryKey: ['journal-entry-lines', entry.id],
    enabled: expanded,
    queryFn: async () => {
      const { data, error } = await supabase.from('journal_entry_lines').select('*, chart_of_accounts(account_code, account_name)').eq('journal_entry_id', entry.id);
      if (error) throw error;
      return data;
    },
  });

  const total = (lines ?? []).reduce((s: number, l: any) => s + Number(l.debit), 0);

  const post = async () => {
    setError(null);
    const { error: err } = await supabase.from('journal_entries').update({ posted: true }).eq('id', entry.id);
    if (err) { setError(err.message); return; }
    qc.invalidateQueries({ queryKey: ['journal-entries'] });
  };

  return (
    <>
      <tr>
        <td><button className="btn btn-ghost" onClick={() => setExpanded((v) => !v)} style={{ padding: 0 }}>{expanded ? '▾' : '▸'} {entry.entry_date}</button></td>
        <td>{entry.description}</td>
        <td className="text-muted">{entry.reference ?? '—'}</td>
        <td className="text-muted">{entry.source_type}</td>
        <td><span className={`tag ${entry.posted ? 'tag-accent' : 'tag-outline'}`}>{entry.posted ? 'posted' : 'draft'}</span></td>
      </tr>
      {expanded && (
        <tr>
          <td colSpan={5} style={{ background: 'color-mix(in srgb, var(--color-text) 3%, transparent)' }}>
            <div style={{ padding: 'var(--space-3)' }}>
              <table className="table" style={{ marginBottom: 8 }}>
                <thead><tr><th>Account</th><th>Debit</th><th>Credit</th><th>Note</th></tr></thead>
                <tbody>
                  {lines?.map((l: any) => (
                    <tr key={l.id}>
                      <td>{l.chart_of_accounts?.account_code} — {l.chart_of_accounts?.account_name}</td>
                      <td>{Number(l.debit) > 0 ? `₹${Number(l.debit).toFixed(2)}` : ''}</td>
                      <td>{Number(l.credit) > 0 ? `₹${Number(l.credit).toFixed(2)}` : ''}</td>
                      <td className="text-muted">{l.description ?? ''}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot><tr><td style={{ fontWeight: 600 }}>Total</td><td colSpan={2} style={{ fontWeight: 600 }}>₹{total.toFixed(2)}</td><td /></tr></tfoot>
              </table>
              {!entry.posted && <button className="btn btn-primary" onClick={post}>Post entry</button>}
              {error && <div style={{ color: '#b64545', fontSize: 12 }}>{error}</div>}
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

function JournalTab({ isAccountant }: { isAccountant: boolean }) {
  const [showForm, setShowForm] = useState(false);
  const [statusFilter, setStatusFilter] = useState<'all' | 'draft' | 'posted'>('all');
  const { data: accounts } = useQuery({
    queryKey: ['chart-of-accounts-active'],
    queryFn: async () => {
      const { data, error } = await supabase.from('chart_of_accounts').select('*').eq('active', true).order('account_code');
      if (error) throw error;
      return data;
    },
  });
  const { data: entries, isLoading } = useQuery({
    queryKey: ['journal-entries'],
    queryFn: async () => {
      const { data, error } = await supabase.from('journal_entries').select('*').order('entry_date', { ascending: false }).limit(200);
      if (error) throw error;
      return data;
    },
  });

  const filtered = (entries ?? []).filter((e: any) => statusFilter === 'all' || (statusFilter === 'posted' ? e.posted : !e.posted));

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
        <p className="text-muted" style={{ fontSize: 13, margin: 0 }}>Double-entry journal — every posted entry must balance and becomes immutable.</p>
        {isAccountant && !showForm && <button className="btn btn-primary" onClick={() => setShowForm(true)}>+ New entry</button>}
      </div>
      {showForm && <NewJournalEntryForm accounts={accounts ?? []} onDone={() => setShowForm(false)} />}
      <div className="seg" style={{ maxWidth: 260, marginBottom: 12 }}>
        {(['all', 'draft', 'posted'] as const).map((f) => (
          <label key={f} className="seg-opt" style={{ flex: 1, justifyContent: 'center' }}>
            <input type="radio" checked={statusFilter === f} onChange={() => setStatusFilter(f)} /> {f}
          </label>
        ))}
      </div>
      {isLoading ? <p className="text-muted">Loading…</p> : (
        <table className="table">
          <thead><tr><th>Date</th><th>Description</th><th>Reference</th><th>Source</th><th>Status</th></tr></thead>
          <tbody>
            {filtered.map((e: any) => <JournalEntryRow key={e.id} entry={e} />)}
            {filtered.length === 0 && <tr><td colSpan={5} className="text-muted">No journal entries match.</td></tr>}
          </tbody>
        </table>
      )}
    </div>
  );
}

// ---------------- Expenses ----------------

function AddExpenseForm({ categories, onDone }: { categories: any[]; onDone: () => void }) {
  const { profile } = useAuth();
  const qc = useQueryClient();
  const [form, setForm] = useState({ category_id: '', vendor_id: '', amount: '', expense_date: todayISO(), description: '', payment_method: 'cash' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const set = (k: string, v: string) => setForm((prev) => ({ ...prev, [k]: v }));

  const { data: vendors } = useQuery({
    queryKey: ['vendors'],
    queryFn: async () => {
      const { data, error } = await supabase.from('vendors').select('id, name').eq('active', true).order('name');
      if (error) throw error;
      return data;
    },
  });

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const amount = Number(form.amount);
    if (!form.category_id || !amount || amount <= 0) return;
    setSaving(true);
    setError(null);

    const category = categories.find((c) => c.id === form.category_id);
    const cashOrBankAccountCode = CASH_LIKE.has(form.payment_method) ? '1000' : '1010';
    const { data: cashAccount } = await supabase.from('chart_of_accounts').select('id').eq('account_code', cashOrBankAccountCode).maybeSingle();

    if (!category?.default_account_id || !cashAccount) {
      setSaving(false);
      setError('This category has no mapped GL account, or the cash/bank account is missing — ask an accountant to fix the chart of accounts.');
      return;
    }

    const { data: entry, error: entryError } = await supabase.from('journal_entries').insert({
      entry_date: form.expense_date, description: `Expense: ${category.name}${form.description ? ' — ' + form.description : ''}`,
      source_type: 'expense', created_by: profile?.id,
    }).select().single();
    if (entryError || !entry) { setSaving(false); setError(entryError?.message ?? 'Could not create journal entry.'); return; }

    const { error: linesError } = await supabase.from('journal_entry_lines').insert([
      { journal_entry_id: entry.id, account_id: category.default_account_id, debit: amount },
      { journal_entry_id: entry.id, account_id: cashAccount.id, credit: amount },
    ]);
    if (linesError) { setSaving(false); setError(linesError.message); return; }

    const { error: postError } = await supabase.from('journal_entries').update({ posted: true, source_id: null }).eq('id', entry.id);
    if (postError) { setSaving(false); setError(postError.message); return; }

    const { error: expenseError } = await supabase.from('expenses').insert({
      category_id: form.category_id, vendor_id: form.vendor_id || null, amount, expense_date: form.expense_date,
      description: form.description || null, payment_method: form.payment_method, journal_entry_id: entry.id, created_by: profile?.id,
    });
    setSaving(false);
    if (expenseError) { setError(`Posted to the ledger, but the expense record failed to save: ${expenseError.message}`); return; }
    qc.invalidateQueries({ queryKey: ['expenses'] });
    qc.invalidateQueries({ queryKey: ['journal-entries'] });
    onDone();
  };

  return (
    <form onSubmit={submit} className="card blueprint elev-md" style={{ padding: 'var(--space-4)', marginBottom: 'var(--space-5)' }}>
      <i className="corner tl" /><i className="corner tr" /><i className="corner bl" /><i className="corner br" />
      <h4 style={{ marginTop: 0 }}>Record expense</h4>
      <p className="text-muted" style={{ fontSize: 12, marginTop: -6 }}>Posts a balanced journal entry automatically — debits the category's expense account, credits cash/bank.</p>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-3)' }}>
        <div className="field" style={{ flex: '1 1 180px' }}>
          <label>Category *</label>
          <select className="input" value={form.category_id} onChange={(e) => set('category_id', e.target.value)} required>
            <option value="">Select…</option>
            {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        <div className="field" style={{ flex: '1 1 180px' }}>
          <label>Vendor</label>
          <select className="input" value={form.vendor_id} onChange={(e) => set('vendor_id', e.target.value)}>
            <option value="">—</option>
            {vendors?.map((v: any) => <option key={v.id} value={v.id}>{v.name}</option>)}
          </select>
        </div>
        <div className="field" style={{ flex: '1 1 140px' }}><label>Amount (₹) *</label><input className="input" type="number" value={form.amount} onChange={(e) => set('amount', e.target.value)} required /></div>
        <div className="field" style={{ flex: '1 1 140px' }}><label>Date</label><input className="input" type="date" value={form.expense_date} onChange={(e) => set('expense_date', e.target.value)} /></div>
        <div className="field" style={{ flex: '1 1 160px' }}>
          <label>Payment method</label>
          <select className="input" value={form.payment_method} onChange={(e) => set('payment_method', e.target.value)}>
            {PAYMENT_METHODS.map((m) => <option key={m} value={m}>{m.replace(/_/g, ' ')}</option>)}
          </select>
        </div>
        <div className="field" style={{ flex: '1 1 100%' }}><label>Description</label><input className="input" value={form.description} onChange={(e) => set('description', e.target.value)} /></div>
      </div>
      {error && <div style={{ color: '#b64545', fontSize: 13, marginTop: 6 }}>{error}</div>}
      <div style={{ marginTop: 10, display: 'flex', gap: 8 }}>
        <button className="btn btn-primary" type="submit" disabled={saving}>{saving ? 'Recording…' : 'Record & post'}</button>
        <button className="btn btn-secondary" type="button" onClick={onDone}>Cancel</button>
      </div>
    </form>
  );
}

function ExpensesTab({ isAccountant }: { isAccountant: boolean }) {
  const [showForm, setShowForm] = useState(false);
  const [search, setSearch] = useState('');
  const { data: categories } = useQuery({
    queryKey: ['expense-categories'],
    queryFn: async () => {
      const { data, error } = await supabase.from('expense_categories').select('*').eq('active', true).order('name');
      if (error) throw error;
      return data;
    },
  });
  const { data: expenses, isLoading } = useQuery({
    queryKey: ['expenses'],
    queryFn: async () => {
      const { data, error } = await supabase.from('expenses').select('*, expense_categories(name), vendors(name)').order('expense_date', { ascending: false }).limit(200);
      if (error) throw error;
      return data;
    },
  });

  const term = search.trim().toLowerCase();
  const filtered = (expenses ?? []).filter((e: any) => !term || e.expense_categories?.name?.toLowerCase().includes(term) || e.vendors?.name?.toLowerCase().includes(term) || e.description?.toLowerCase().includes(term));

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
        <p className="text-muted" style={{ fontSize: 13, margin: 0 }}>Operating expenses — rent, salaries, utilities, supplies.</p>
        {isAccountant && !showForm && <button className="btn btn-primary" onClick={() => setShowForm(true)}>+ Record expense</button>}
      </div>
      {showForm && <AddExpenseForm categories={categories ?? []} onDone={() => setShowForm(false)} />}
      <div className="field" style={{ maxWidth: 300, marginBottom: 12 }}>
        <label>Search</label>
        <input className="input" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Category, vendor or description" />
      </div>
      {isLoading ? <p className="text-muted">Loading…</p> : (
        <table className="table">
          <thead><tr><th>Date</th><th>Category</th><th>Vendor</th><th>Description</th><th>Method</th><th>Amount</th></tr></thead>
          <tbody>
            {filtered.map((e: any) => (
              <tr key={e.id}>
                <td>{e.expense_date}</td>
                <td>{e.expense_categories?.name}</td>
                <td className="text-muted">{e.vendors?.name ?? '—'}</td>
                <td className="text-muted">{e.description ?? '—'}</td>
                <td>{e.payment_method.replace(/_/g, ' ')}</td>
                <td>₹{Number(e.amount).toLocaleString()}</td>
              </tr>
            ))}
            {filtered.length === 0 && <tr><td colSpan={6} className="text-muted">No expenses match.</td></tr>}
          </tbody>
        </table>
      )}
    </div>
  );
}

// ---------------- Reports ----------------

function ReportsTab() {
  const [from, setFrom] = useState(new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10));
  const [to, setTo] = useState(todayISO());
  const [asOf, setAsOf] = useState(todayISO());

  const { data: pnlLines } = useQuery({
    queryKey: ['pnl-report', from, to],
    queryFn: async () => {
      const { data, error } = await supabase.from('journal_entry_lines').select('debit, credit, chart_of_accounts!inner(account_code, account_name, account_type), journal_entries!inner(entry_date, posted)')
        .in('chart_of_accounts.account_type', ['income', 'expense']).eq('journal_entries.posted', true).gte('journal_entries.entry_date', from).lte('journal_entries.entry_date', to);
      if (error) throw error;
      return data;
    },
  });

  const { data: bsLines } = useQuery({
    queryKey: ['balance-sheet-report', asOf],
    queryFn: async () => {
      const { data, error } = await supabase.from('journal_entry_lines').select('debit, credit, chart_of_accounts!inner(account_code, account_name, account_type), journal_entries!inner(entry_date, posted)')
        .in('chart_of_accounts.account_type', ['asset', 'liability', 'equity']).eq('journal_entries.posted', true).lte('journal_entries.entry_date', asOf);
      if (error) throw error;
      return data;
    },
  });

  function groupByAccount(lines: any[] | undefined) {
    const map = new Map<string, { code: string; name: string; type: string; debit: number; credit: number }>();
    for (const l of lines ?? []) {
      const acc = l.chart_of_accounts;
      const key = acc.account_code;
      const existing = map.get(key) ?? { code: acc.account_code, name: acc.account_name, type: acc.account_type, debit: 0, credit: 0 };
      existing.debit += Number(l.debit);
      existing.credit += Number(l.credit);
      map.set(key, existing);
    }
    return [...map.values()].sort((a, b) => a.code.localeCompare(b.code));
  }

  const pnlAccounts = groupByAccount(pnlLines);
  const income = pnlAccounts.filter((a) => a.type === 'income');
  const expense = pnlAccounts.filter((a) => a.type === 'expense');
  const totalIncome = income.reduce((s, a) => s + (a.credit - a.debit), 0);
  const totalExpense = expense.reduce((s, a) => s + (a.debit - a.credit), 0);
  const netProfit = totalIncome - totalExpense;

  const bsAccounts = groupByAccount(bsLines);
  const assets = bsAccounts.filter((a) => a.type === 'asset');
  const liabilities = bsAccounts.filter((a) => a.type === 'liability');
  const equity = bsAccounts.filter((a) => a.type === 'equity');
  const totalAssets = assets.reduce((s, a) => s + (a.debit - a.credit), 0);
  const totalLiabilities = liabilities.reduce((s, a) => s + (a.credit - a.debit), 0);
  const totalEquity = equity.reduce((s, a) => s + (a.credit - a.debit), 0);

  return (
    <div>
      <div className="card" style={{ padding: 'var(--space-4)', marginBottom: 'var(--space-5)' }}>
        <h4 style={{ marginTop: 0 }}>Profit &amp; Loss</h4>
        <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
          <div className="field" style={{ marginBottom: 0 }}><label>From</label><input className="input" type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></div>
          <div className="field" style={{ marginBottom: 0 }}><label>To</label><input className="input" type="date" value={to} onChange={(e) => setTo(e.target.value)} /></div>
        </div>
        <table className="table">
          <thead><tr><th>Account</th><th>Amount</th></tr></thead>
          <tbody>
            <tr><td colSpan={2} style={{ fontWeight: 600 }}>Income</td></tr>
            {income.map((a) => <tr key={a.code}><td className="text-muted">{a.name}</td><td>₹{(a.credit - a.debit).toLocaleString()}</td></tr>)}
            <tr><td colSpan={2} style={{ fontWeight: 600, paddingTop: 10 }}>Expenses</td></tr>
            {expense.map((a) => <tr key={a.code}><td className="text-muted">{a.name}</td><td>₹{(a.debit - a.credit).toLocaleString()}</td></tr>)}
          </tbody>
          <tfoot>
            <tr><td style={{ fontWeight: 600 }}>Total income</td><td style={{ fontWeight: 600 }}>₹{totalIncome.toLocaleString()}</td></tr>
            <tr><td style={{ fontWeight: 600 }}>Total expenses</td><td style={{ fontWeight: 600 }}>₹{totalExpense.toLocaleString()}</td></tr>
            <tr><td style={{ fontWeight: 700 }}>Net profit</td><td style={{ fontWeight: 700, color: netProfit >= 0 ? '#2e6b49' : '#8a2c2c' }}>₹{netProfit.toLocaleString()}</td></tr>
          </tfoot>
        </table>
      </div>

      <div className="card" style={{ padding: 'var(--space-4)' }}>
        <h4 style={{ marginTop: 0 }}>Balance Sheet</h4>
        <div className="field" style={{ maxWidth: 200, marginBottom: 10 }}><label>As of</label><input className="input" type="date" value={asOf} onChange={(e) => setAsOf(e.target.value)} /></div>
        <table className="table">
          <thead><tr><th>Account</th><th>Balance</th></tr></thead>
          <tbody>
            <tr><td colSpan={2} style={{ fontWeight: 600 }}>Assets</td></tr>
            {assets.map((a) => <tr key={a.code}><td className="text-muted">{a.name}</td><td>₹{(a.debit - a.credit).toLocaleString()}</td></tr>)}
            <tr><td colSpan={2} style={{ fontWeight: 600, paddingTop: 10 }}>Liabilities</td></tr>
            {liabilities.map((a) => <tr key={a.code}><td className="text-muted">{a.name}</td><td>₹{(a.credit - a.debit).toLocaleString()}</td></tr>)}
            <tr><td colSpan={2} style={{ fontWeight: 600, paddingTop: 10 }}>Equity</td></tr>
            {equity.map((a) => <tr key={a.code}><td className="text-muted">{a.name}</td><td>₹{(a.credit - a.debit).toLocaleString()}</td></tr>)}
          </tbody>
          <tfoot>
            <tr><td style={{ fontWeight: 600 }}>Total assets</td><td style={{ fontWeight: 600 }}>₹{totalAssets.toLocaleString()}</td></tr>
            <tr><td style={{ fontWeight: 600 }}>Total liabilities + equity</td><td style={{ fontWeight: 600 }}>₹{(totalLiabilities + totalEquity).toLocaleString()}</td></tr>
          </tfoot>
        </table>
        <p className="text-muted" style={{ fontSize: 11, marginTop: 8 }}>Retained earnings/owner's equity are only as accurate as what's been journaled manually — this ledger doesn't auto-post from billing or vendor payments yet.</p>
      </div>
    </div>
  );
}

// ---------------- Page ----------------

export function FinancePage() {
  const { profile } = useAuth();
  const isAccountant = profile?.role === 'accountant' || profile?.role === 'admin';
  const [tab, setTab] = useState<'journal' | 'expenses' | 'accounts' | 'reports'>('journal');

  return (
    <div>
      <h2 style={{ marginBottom: 4 }}>Finance &amp; Accounting</h2>
      <p className="text-muted" style={{ fontSize: 13, marginTop: 0, marginBottom: 'var(--space-4)' }}>General ledger, expenses, chart of accounts and P&amp;L/balance sheet reporting.</p>

      <div style={{ display: 'flex', gap: 6, marginBottom: 'var(--space-4)', borderBottom: '1px solid var(--color-divider)' }}>
        {[{ key: 'journal', label: 'Journal' }, { key: 'expenses', label: 'Expenses' }, { key: 'accounts', label: 'Chart of Accounts' }, { key: 'reports', label: 'Reports' }].map((t) => (
          <button key={t.key} className={`btn ${tab === t.key ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setTab(t.key as typeof tab)} style={{ borderRadius: 0, borderBottom: tab === t.key ? '2px solid var(--color-accent)' : 'none' }}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'journal' && <JournalTab isAccountant={isAccountant} />}
      {tab === 'expenses' && <ExpensesTab isAccountant={isAccountant} />}
      {tab === 'accounts' && <ChartOfAccountsTab isAccountant={isAccountant} />}
      {tab === 'reports' && <ReportsTab />}
    </div>
  );
}
