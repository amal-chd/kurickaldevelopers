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
    await fetch('/api/send-push', {
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
