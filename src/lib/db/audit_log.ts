import { supabase } from '../supabaseClient';
import { useAuthStore } from '../../store/authStore';

// Helper to log detailed, production-grade diagnostic information for permission/authorization errors
const logPermissionError = (actionName: string, error: any, context?: any) => {
  const isPermissionError = error?.code === 'PGRST301' || error?.message?.includes('permission') || error?.message?.includes('policy') || error?.message?.includes('denied');
  if (isPermissionError) {
    const { firebaseUser, appUser, permissions } = useAuthStore.getState();
    console.error(`[AUTHORIZATION ERROR] Action: ${actionName} failed with permission-denied.`, {
      errorMessage: error.message,
      errorCode: error.code,
      currentUserUid: firebaseUser?.uid ?? 'not-authenticated',
      currentUserRole: appUser?.roleId ?? 'no-role-assigned',
      userPermissions: permissions,
      context,
    });
  } else {
    console.warn(`[API ERROR] Action: ${actionName} failed.`, error, context);
  }
};

// ─── Audit Log ────────────────────────────────────────────────────────────────
// Audit logging now lives in `src/lib/auditLog.ts` (`logAudit` / `fetchAuditLogs`),
// which writes the canonical schema shared with the mobile app and satisfies the
// `actorId == auth.uid` Firestore rule. The old helpers were removed.
