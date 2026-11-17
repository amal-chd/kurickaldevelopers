import React, { useEffect, useState } from 'react';
import { LifeBuoy, Loader2, Plus, ArrowLeft, Send } from 'lucide-react';
import toast from 'react-hot-toast';
import { saasApi } from '../../lib/saasApi';
import { useAuthStore } from '../../store/authStore';

export const TICKET_STATUS: Record<string, string> = {
  open: 'bg-blue-50 text-blue-700', pending: 'bg-amber-50 text-amber-800', resolved: 'bg-emerald-50 text-emerald-700', closed: 'bg-slate-100 text-slate-600',
};

export const TicketThread: React.FC<{ messages: any[] }> = ({ messages }) => (
  <ol className="space-y-3">
    {messages.map((m) => (
      <li key={m.id} className={`rounded-xl p-4 text-sm ${m.author_type === 'staff' ? 'bg-indigo-50 border border-indigo-100' : 'bg-white border border-slate-200'}`}>
        <p className="text-xs text-slate-500 mb-1.5"><span className="font-semibold text-slate-700">{m.author_name}</span>{m.author_type === 'staff' && ' · Task Pilot team'} · {new Date(m.created_at).toLocaleString()}</p>
        <p className="whitespace-pre-wrap">{m.body}</p>
      </li>
    ))}
  </ol>
);

const SupportPage: React.FC = () => {
  const { appUser } = useAuthStore();
  const [tickets, setTickets] = useState<any[] | null>(null);
  const [view, setView] = useState<'list' | 'new' | string>('list');
  const [thread, setThread] = useState<{ ticket: any; messages: any[] } | null>(null);
  const [form, setForm] = useState({ subject: '', category: 'general', body: '' });
  const [reply, setReply] = useState('');
  const [busy, setBusy] = useState(false);

  const loadList = () => saasApi<{ tickets: any[] }>('list_tickets').then((r) => setTickets(r.tickets)).catch((e) => { toast.error(e.message); setTickets([]); });
  useEffect(() => { loadList(); }, []);
  useEffect(() => {
    if (view === 'list' || view === 'new') return;
    setThread(null);
    saasApi<any>('get_ticket', { id: view }).then(setThread).catch((e) => toast.error(e.message));
  }, [view]);

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      const r = await saasApi<{ ticket: any }>('create_ticket', { ...form, name: appUser?.name });
      toast.success(`Ticket #${r.ticket.ticket_number} created`);
      setForm({ subject: '', category: 'general', body: '' });
      await loadList();
      setView(r.ticket.id);
    } catch (err: any) { toast.error(err.message); } finally { setBusy(false); }
  };
  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reply.trim() || !thread) return;
    setBusy(true);
    try {
      await saasApi('reply_ticket', { id: thread.ticket.id, body: reply, name: appUser?.name });
      setReply('');
      setThread(await saasApi<any>('get_ticket', { id: thread.ticket.id }));
    } catch (err: any) { toast.error(err.message); } finally { setBusy(false); }
  };

  return (
    <div className="p-4 sm:p-6 max-w-4xl space-y-5">
      {view === 'list' && (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3"><LifeBuoy className="w-6 h-6 text-slate-500" /><div><h2 className="text-lg font-bold">Support</h2><p className="text-sm text-slate-500">Questions, bugs, billing — we reply here and notify you in the app.</p></div></div>
            <button onClick={() => setView('new')} className="h-10 px-4 rounded-lg bg-slate-900 text-white text-sm font-semibold inline-flex items-center gap-2"><Plus className="w-4 h-4" />New ticket</button>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white divide-y divide-slate-100">
            {tickets === null ? <div className="p-6"><Loader2 className="w-5 h-5 animate-spin text-slate-400" /></div> : tickets.length === 0 ? <p className="p-6 text-sm text-slate-500">No tickets yet.</p> : tickets.map((t) => (
              <button key={t.id} onClick={() => setView(t.id)} className="w-full text-left p-4 hover:bg-slate-50 flex items-center gap-3">
                <span className="font-mono text-xs text-slate-400">#{t.ticket_number}</span>
                <span className="flex-1 min-w-0"><span className="block font-medium truncate">{t.subject}</span><span className="text-xs text-slate-500 capitalize">{t.category} · updated {new Date(t.last_reply_at).toLocaleDateString()}</span></span>
                <span className={`text-xs font-semibold px-2 py-0.5 rounded-full capitalize ${TICKET_STATUS[t.status]}`}>{t.status}</span>
              </button>
            ))}
          </div>
        </>
      )}
      {view === 'new' && (
        <form onSubmit={create} className="rounded-2xl border border-slate-200 bg-white p-6 space-y-4">
          <button type="button" onClick={() => setView('list')} className="text-sm text-slate-600 inline-flex items-center gap-1"><ArrowLeft className="w-4 h-4" />Back</button>
          <h2 className="text-lg font-bold">New support ticket</h2>
          <label className="block text-sm font-medium">Subject<input required maxLength={200} value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} className="w-full mt-1 h-10 px-3 rounded-lg border border-slate-300 text-sm outline-none focus:border-slate-900" /></label>
          <label className="block text-sm font-medium">Category
            <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} className="w-full mt-1 h-10 px-3 rounded-lg border border-slate-300 text-sm bg-white">
              {[['general', 'General question'], ['bug', 'Something is broken'], ['billing', 'Billing & invoices'], ['account', 'Account & access'], ['feature', 'Feature request']].map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </label>
          <label className="block text-sm font-medium">Message<textarea required rows={6} value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} className="w-full mt-1 px-3 py-2 rounded-lg border border-slate-300 text-sm outline-none focus:border-slate-900" /></label>
          <button disabled={busy} className="h-10 px-5 rounded-lg bg-slate-900 text-white text-sm font-semibold disabled:opacity-60">{busy ? 'Sending…' : 'Submit ticket'}</button>
        </form>
      )}
      {view !== 'list' && view !== 'new' && (
        <div className="space-y-4">
          <button onClick={() => { setView('list'); loadList(); }} className="text-sm text-slate-600 inline-flex items-center gap-1"><ArrowLeft className="w-4 h-4" />All tickets</button>
          {!thread ? <Loader2 className="w-5 h-5 animate-spin text-slate-400" /> : (
            <>
              <div className="flex flex-wrap items-center gap-3"><h2 className="text-lg font-bold">#{thread.ticket.ticket_number} {thread.ticket.subject}</h2><span className={`text-xs font-semibold px-2 py-0.5 rounded-full capitalize ${TICKET_STATUS[thread.ticket.status]}`}>{thread.ticket.status}</span></div>
              <TicketThread messages={thread.messages} />
              <form onSubmit={send} className="flex gap-2">
                <textarea value={reply} onChange={(e) => setReply(e.target.value)} rows={2} placeholder="Write a reply…" aria-label="Reply" className="flex-1 px-3 py-2 rounded-lg border border-slate-300 text-sm outline-none focus:border-slate-900" />
                <button disabled={busy || !reply.trim()} className="px-4 rounded-lg bg-slate-900 text-white disabled:opacity-50" aria-label="Send reply"><Send className="w-4 h-4" /></button>
              </form>
            </>
          )}
        </div>
      )}
    </div>
  );
};

export default SupportPage;
