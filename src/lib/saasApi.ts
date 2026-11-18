import { auth } from '../firebase/config';
import { SUPABASE_DEFAULTS } from './supabaseClient';

// Typed client for the `saas-api` edge function (tenant onboarding, billing,
// support and the platform console). Authorisation is enforced server-side
// from the verified Firebase ID token — the client never decides access.
const BASE = (import.meta.env.VITE_SUPABASE_URL as string | undefined)?.replace(/\/$/, '')
  ?? SUPABASE_DEFAULTS.url;
const ANON = (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined) || SUPABASE_DEFAULTS.anonKey;

export class SaasApiError extends Error {
  constructor(message: string, public status: number, public code?: string) { super(message); }
}

export async function saasApi<T = any>(action: string, params: Record<string, unknown> = {}, opts: { public?: boolean } = {}): Promise<T> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (ANON) headers.apikey = ANON;
  const user = auth.currentUser;
  if (user) headers.Authorization = `Bearer ${await user.getIdToken()}`;
  else if (!opts.public) throw new SaasApiError('Please sign in again', 401);
  else if (ANON) headers.Authorization = `Bearer ${ANON}`;

  let res: Response;
  try {
    res = await fetch(`${BASE}/functions/v1/saas-api`, { method: 'POST', headers, body: JSON.stringify({ action, ...params }) });
  } catch {
    throw new SaasApiError('Network error — check your connection and try again', 0);
  }
  const text = await res.text();
  let data: any = null;
  try { data = text ? JSON.parse(text) : null; } catch { /* non-JSON */ }
  if (!res.ok) throw new SaasApiError(data?.error ?? `Request failed (${res.status})`, res.status, data?.code);
  return data as T;
}

// ─── Razorpay Checkout loader ────────────────────────────────────────────────
let rzpLoading: Promise<void> | null = null;
export function loadRazorpay(): Promise<void> {
  if ((window as any).Razorpay) return Promise.resolve();
  if (rzpLoading) return rzpLoading;
  rzpLoading = new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = 'https://checkout.razorpay.com/v1/checkout.js';
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => { rzpLoading = null; reject(new Error('Could not load the payment window')); };
    document.body.appendChild(s);
  });
  return rzpLoading;
}
