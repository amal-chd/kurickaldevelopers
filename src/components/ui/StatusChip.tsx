import React from 'react';
import { cn } from '../../lib/utils';
import { TaskStatus, TaskPriority } from '../../types';

interface StatusChipProps {
  status: TaskStatus;
  className?: string;
}

const STATUS_CONFIG: Record<TaskStatus, { label: string; classes: string; dot: string }> = {
  in_progress: {
    label: 'In Progress',
    classes: 'bg-blue-50 text-blue-700 border border-blue-100',
    dot: 'bg-blue-500',
  },
  approved: {
    label: 'Approved',
    classes: 'bg-emerald-50 text-emerald-700 border border-emerald-100',
    dot: 'bg-emerald-500',
  },
  done: {
    label: 'Done',
    classes: 'bg-gray-100 text-gray-600 border border-gray-200',
    dot: 'bg-gray-400',
  },
};

const PRIORITY_CONFIG: Record<TaskPriority, { label: string; classes: string }> = {
  low: { label: 'Low', classes: 'bg-slate-100 text-slate-600' },
  medium: { label: 'Medium', classes: 'bg-amber-50 text-amber-700' },
  high: { label: 'High', classes: 'bg-orange-50 text-orange-700' },
  critical: { label: 'Critical', classes: 'bg-red-50 text-red-700' },
};

export const TaskStatusChip: React.FC<StatusChipProps> = ({ status, className }) => {
  const config = STATUS_CONFIG[status] ?? STATUS_CONFIG.in_progress;
  return (
    <span className={cn('inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full', config.classes, className)}>
      <span className={cn('w-1.5 h-1.5 rounded-full', config.dot)} />
      {config.label}
    </span>
  );
};

interface PriorityChipProps {
  priority: TaskPriority;
  className?: string;
}

export const PriorityChip: React.FC<PriorityChipProps> = ({ priority, className }) => {
  const config = PRIORITY_CONFIG[priority] ?? PRIORITY_CONFIG.medium;
  return (
    <span className={cn('inline-flex items-center text-xs font-semibold px-2 py-0.5 rounded-md', config.classes, className)}>
      {config.label}
    </span>
  );
};

export const CompletionStatusChip: React.FC<{
  status: TaskStatus;
  completionStatus?: 'completed' | 'completed_on_time' | 'completed_late';
  dueDate?: any;
  className?: string;
}> = ({ status, completionStatus, dueDate, className }) => {
  if (status === 'done' || status === 'approved') {
    if (completionStatus === 'completed_on_time') {
      return (
        <span className={cn('inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-100', className)}>
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
          Completed On Time
        </span>
      );
    }
    if (completionStatus === 'completed_late') {
      return (
        <span className={cn('inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full bg-rose-50 text-rose-700 border border-rose-100', className)}>
          <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
          Completed Late
        </span>
      );
    }
    return (
      <span className={cn('inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-100', className)}>
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
        Completed
      </span>
    );
  }

  if (dueDate) {
    const dueTime = (dueDate.toDate ? dueDate.toDate() : new Date(dueDate)).getTime();
    const nowTime = new Date().getTime();
    const isSameDay = new Date(dueTime).toDateString() === new Date().toDateString();

    if (nowTime > dueTime && !isSameDay) {
      return (
        <span className={cn('inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full bg-rose-50 text-rose-700 border border-rose-100', className)}>
          <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse" />
          Late (Overdue)
        </span>
      );
    }
    if (isSameDay) {
      return (
        <span className={cn('inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full bg-orange-50 text-orange-700 border border-orange-100', className)}>
          <span className="w-1.5 h-1.5 rounded-full bg-orange-500" />
          Due Today
        </span>
      );
    }
  }

  return (
    <span className={cn('inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full bg-blue-50 text-blue-700 border border-blue-100', className)}>
      <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
      In Progress
    </span>
  );
};
