import React from 'react';
import { cn } from '../../lib/utils';

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  className?: string;
  padding?: boolean;
  onClick?: () => void;
  hover?: boolean;
}

const Card: React.FC<CardProps> = ({ children, className, padding = true, onClick, hover, ...props }) => {
  return (
    <div
      {...props}
      className={cn(
        'bg-white rounded-xl border border-slate-200/60 shadow-sm',
        padding && 'p-4 sm:p-5',
        hover && 'hover:shadow-md hover:-translate-y-0.5 hover:border-slate-300 transition-all duration-200 cursor-pointer',
        className
      )}
      onClick={onClick}
    >
      {children}
    </div>
  );
};

export default Card;
