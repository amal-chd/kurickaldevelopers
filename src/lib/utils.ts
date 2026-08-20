import { format, formatDistanceToNow, isToday, isYesterday } from 'date-fns';
import { Timestamp } from 'firebase/firestore';
import { TaskStatus, TaskPriority, ProjectStatus } from '../types';

export function cn(...classes: (string | undefined | null | false)[]): string {
  return classes.filter(Boolean).join(' ');
}

export function toDate(ts: any): Date | null {
  if (!ts) return null;
  let d: Date | null = null;
  if (ts instanceof Date) d = ts;
  else if (typeof ts === 'string') d = new Date(ts);
  else if (ts && typeof ts.toDate === 'function') d = ts.toDate();
  else if (ts && ts._seconds !== undefined) d = new Date(ts._seconds * 1000);
  else if (typeof ts === 'number') d = new Date(ts);
  
  if (d && !isNaN(d.getTime())) return d;
  return null;
}

export function formatDate(ts: Timestamp | Date | string | undefined | null, fmt = 'MMM d, yyyy'): string {
  const d = toDate(ts);
  if (!d) return '—';
  return format(d, fmt);
}

export function formatDateTime(ts: Timestamp | Date | string | undefined | null): string {
  const d = toDate(ts);
  if (!d) return '—';
  return format(d, 'MMM d, yyyy h:mm a');
}

export function formatRelative(ts: Timestamp | Date | string | undefined | null): string {
  const d = toDate(ts);
  if (!d) return '—';
  if (isToday(d)) return format(d, 'h:mm a');
  if (isYesterday(d)) return 'Yesterday';
  return format(d, 'MMM d');
}

export function formatTimeAgo(ts: Timestamp | Date | string | undefined | null): string {
  const d = toDate(ts);
  if (!d) return '—';
  return formatDistanceToNow(d, { addSuffix: true });
}

export function formatTime(ts: Timestamp | Date | undefined | null): string {
  const d = toDate(ts);
  if (!d) return '—';
  return format(d, 'h:mm a');
}

export function getDuration(start: Timestamp | null | undefined, end: Timestamp | null | undefined): string {
  if (!start) return '—';
  const startDate = toDate(start)!;
  const endDate = end ? toDate(end)! : new Date();
  const diffMs = endDate.getTime() - startDate.getTime();
  const hours = Math.floor(diffMs / 3600000);
  const minutes = Math.floor((diffMs % 3600000) / 60000);
  return `${hours}h ${minutes}m`;
}

export function taskStatusLabel(status: TaskStatus): string {
  const map: Record<TaskStatus, string> = {
    in_progress: 'In Progress',
    under_review: 'Under Review',
    done: 'Done',
  };
  return map[status] ?? status;
}

export function taskStatusColor(status: TaskStatus): string {
  const map: Record<TaskStatus, string> = {
    in_progress: 'bg-blue-100 text-blue-700',
    under_review: 'bg-purple-100 text-purple-700',
    done: 'bg-green-100 text-green-700',
  };
  return map[status] ?? 'bg-gray-100 text-gray-700';
}

export function priorityLabel(priority: TaskPriority): string {
  const map: Record<TaskPriority, string> = {
    low: 'Low',
    medium: 'Medium',
    high: 'High',
    critical: 'Critical',
  };
  return map[priority] ?? priority;
}

export function priorityColor(priority: TaskPriority): string {
  const map: Record<TaskPriority, string> = {
    low: 'bg-gray-100 text-gray-600',
    medium: 'bg-blue-100 text-blue-700',
    high: 'bg-orange-100 text-orange-700',
    critical: 'bg-red-100 text-red-700',
  };
  return map[priority] ?? 'bg-gray-100 text-gray-700';
}

export function projectStatusLabel(status: ProjectStatus): string {
  const map: Record<ProjectStatus, string> = {
    active: 'Active',
    on_hold: 'On Hold',
    completed: 'Completed',
  };
  return map[status] ?? status;
}

export function projectStatusColor(status: ProjectStatus): string {
  const map: Record<ProjectStatus, string> = {
    active: 'bg-green-100 text-green-700',
    on_hold: 'bg-amber-100 text-amber-700',
    completed: 'bg-blue-100 text-blue-700',
  };
  return map[status] ?? 'bg-gray-100 text-gray-700';
}

export function getInitials(name: string): string {
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

export function getDmChannelId(uid1: string, uid2: string): string {
  const sorted = [uid1, uid2].sort();
  return `dm_${sorted[0]}_${sorted[1]}`;
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function getMimeIcon(mimeType?: string | null): string {
  if (!mimeType) return '📎';
  if (mimeType.startsWith('image/')) return '🖼️';
  if (mimeType === 'application/pdf') return '📄';
  if (mimeType.includes('word') || mimeType.includes('document')) return '📝';
  if (mimeType.includes('sheet') || mimeType.includes('excel')) return '📊';
  if (mimeType.includes('presentation') || mimeType.includes('powerpoint')) return '📋';
  return '📎';
}

export interface CompletionDetails {
  completionStatus: 'completed' | 'completed_on_time' | 'completed_late';
  delaySeconds: number;
}

export function calculateCompletionDetails(
  completedAtDate: Date,
  dueDateVal: Date | Timestamp | string | null | undefined
): CompletionDetails {
  const due = toDate(dueDateVal);
  if (!due) {
    return { completionStatus: 'completed', delaySeconds: 0 };
  }

  const compTime = completedAtDate.getTime();
  const dueTime = due.getTime();

  const compDayStr = completedAtDate.toDateString();
  const dueDayStr = due.toDateString();
  const isSameDay = compDayStr === dueDayStr;

  const isMidnight = due.getHours() === 0 && due.getMinutes() === 0 && due.getSeconds() === 0;

  if (isMidnight) {
    const compStartOfDay = new Date(completedAtDate.getFullYear(), completedAtDate.getMonth(), completedAtDate.getDate()).getTime();
    const dueStartOfDay = new Date(due.getFullYear(), due.getMonth(), due.getDate()).getTime();

    if (compStartOfDay < dueStartOfDay) {
      return { completionStatus: 'completed', delaySeconds: 0 };
    } else if (compStartOfDay === dueStartOfDay) {
      return { completionStatus: 'completed_on_time', delaySeconds: 0 };
    } else {
      const delayMs = compTime - (dueTime + 24 * 3600 * 1000 - 1000);
      return {
        completionStatus: 'completed_late',
        delaySeconds: Math.max(0, Math.floor(delayMs / 1000)),
      };
    }
  } else {
    if (compTime > dueTime) {
      return {
        completionStatus: 'completed_late',
        delaySeconds: Math.floor((compTime - dueTime) / 1000),
      };
    } else {
      if (isSameDay) {
        return { completionStatus: 'completed_on_time', delaySeconds: 0 };
      } else {
        return { completionStatus: 'completed', delaySeconds: 0 };
      }
    }
  }
}

export function formatDelay(delaySeconds: number | undefined | null): string {
  if (!delaySeconds || delaySeconds <= 0) return '';
  const hours = Math.ceil(delaySeconds / 3600);
  if (hours < 24) {
    return `${hours} hour${hours === 1 ? '' : 's'} late`;
  }
  const days = Math.ceil(delaySeconds / (24 * 3600));
  return `${days} day${days === 1 ? '' : 's'} late`;
}

/**
 * Calculate overtime minutes beyond 8 hours (480 minutes).
 */
export function getOvertimeMinutes(checkInTime: Date, checkOutTime: Date, overrideMinutes?: number): number {
  if (overrideMinutes !== undefined && overrideMinutes !== null) return overrideMinutes;
  const totalMinutes = Math.floor((checkOutTime.getTime() - checkInTime.getTime()) / 60000);
  const standardMinutes = 480; // 8 hours
  return totalMinutes > standardMinutes ? totalMinutes - standardMinutes : 0;
}

/**
 * Format overtime minutes into a readable string like '1h 30m'.
 */
export function formatOvertime(minutes: number): string {
  if (minutes <= 0) return '';
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}
