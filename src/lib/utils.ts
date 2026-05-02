import { format, formatDistanceToNow, isToday, isYesterday } from 'date-fns';
import { Timestamp } from 'firebase/firestore';
import { TaskStatus, TaskPriority, ProjectStatus } from '../types';

export function cn(...classes: (string | undefined | null | false)[]): string {
  return classes.filter(Boolean).join(' ');
}

export function toDate(ts: Timestamp | Date | string | undefined | null): Date | null {
  if (!ts) return null;
  if (ts instanceof Date) return ts;
  if (typeof ts === 'string') return new Date(ts);
  if (ts instanceof Timestamp) return ts.toDate();
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
    approved: 'Approved',
    done: 'Done',
  };
  return map[status] ?? status;
}

export function taskStatusColor(status: TaskStatus): string {
  const map: Record<TaskStatus, string> = {
    in_progress: 'bg-blue-100 text-blue-700',
    approved: 'bg-amber-100 text-amber-700',
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
    planning: 'Planning',
    active: 'Active',
    on_hold: 'On Hold',
    completed: 'Completed',
    cancelled: 'Cancelled',
  };
  return map[status] ?? status;
}

export function projectStatusColor(status: ProjectStatus): string {
  const map: Record<ProjectStatus, string> = {
    planning: 'bg-purple-100 text-purple-700',
    active: 'bg-green-100 text-green-700',
    on_hold: 'bg-amber-100 text-amber-700',
    completed: 'bg-blue-100 text-blue-700',
    cancelled: 'bg-red-100 text-red-700',
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

export function getMimeIcon(mimeType: string): string {
  if (mimeType.startsWith('image/')) return '🖼️';
  if (mimeType === 'application/pdf') return '📄';
  if (mimeType.includes('word') || mimeType.includes('document')) return '📝';
  if (mimeType.includes('sheet') || mimeType.includes('excel')) return '📊';
  if (mimeType.includes('presentation') || mimeType.includes('powerpoint')) return '📋';
  return '📎';
}
