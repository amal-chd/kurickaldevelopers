import React from 'react';
import { cn } from '../../lib/utils';

interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}

const EmptyState: React.FC<EmptyStateProps> = ({ icon, title, description, action, className }) => {
  return (
    <div className={cn('flex flex-col items-center justify-center py-16 text-center px-4 animate-fade-in', className)}>
      {icon && (
        <div className="mb-4 w-16 h-16 rounded-2xl bg-gradient-to-b from-slate-50 to-slate-100/70 border border-slate-100 ring-1 ring-white/60 flex items-center justify-center text-slate-300 shadow-xs">
          {icon}
        </div>
      )}
      <h3 className="text-[15px] font-semibold text-slate-800 tracking-tight">{title}</h3>
      {description && <p className="mt-1.5 text-sm text-slate-400 max-w-xs leading-relaxed">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
};

export default EmptyState;
