import { auth } from '../firebase/config';

// Calls the serverless push sender (api/send-push). The actual recipients and
// notification content are reconstructed server-side from Firestore — we only
// pass identifiers here. Fire-and-forget: push delivery must never block or
// break the user action that triggered it.

type PushPayload =
  | { event: 'chat'; channelId: string; messageId: string }
  | { event: 'task'; taskId: string; kind: 'assigned' | 'status' }
  | { event: 'broadcast'; title: string; body: string; targetRoleId?: string | null; userIds?: string[] };

export async function notifyPush(payload: PushPayload): Promise<void> {
  try {
    const user = auth.currentUser;
    if (!user) return;
    const token = await user.getIdToken();
    await fetch('https://ximaqbhnykyxxgiqbwoh.supabase.co/functions/v1/send-push', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(payload),
    });
  } catch (err) {
    // Swallow — a failed push notification should not surface to the user.
    console.warn('notifyPush failed:', err);
  }
}

export async function deleteUserAccount(targetUid: string): Promise<void> {
  const user = auth.currentUser;
  if (!user) throw new Error('Not authenticated');
  const token = await user.getIdToken();
  const res = await fetch('https://ximaqbhnykyxxgiqbwoh.supabase.co/functions/v1/send-push', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      event: 'delete_user',
      targetUid,
    }),
  });
  if (!res.ok) {
    const text = await res.text();
    try {
      const data = JSON.parse(text);
      throw new Error(data.error || 'Failed to delete user account');
    } catch {
      throw new Error(`Failed to delete user account (${res.status})`);
    }
  }
}

export async function resetUserPassword(targetUid: string, newPassword: string): Promise<void> {
  const user = auth.currentUser;
  if (!user) throw new Error('Not authenticated');
  const token = await user.getIdToken();
  const res = await fetch('https://ximaqbhnykyxxgiqbwoh.supabase.co/functions/v1/send-push', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      event: 'reset_password',
      targetUid,
      newPassword,
    }),
  });
  if (!res.ok) {
    const text = await res.text();
    try {
      const data = JSON.parse(text);
      throw new Error(data.error || 'Failed to reset password');
    } catch (e) {
      if (e instanceof Error && e.message !== 'Failed to reset password') throw e;
      throw new Error(`Failed to reset password (${res.status})`);
    }
  }
}
