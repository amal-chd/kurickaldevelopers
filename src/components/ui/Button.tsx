import React from 'react';
import { cn } from '../../lib/utils';
import Spinner from './Spinner';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost' | 'outline';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = 'primary', size = 'md', loading, leftIcon, rightIcon, children, className, disabled, ...props }, ref) => {
    const base =
      'inline-flex items-center justify-center font-semibold rounded-xl transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-offset-2 active:scale-[0.98]';

    const variants = {
      primary:
        'bg-primary text-white hover:bg-primary-600 shadow-sm hover:shadow-md focus:ring-primary/40 disabled:opacity-60 disabled:shadow-none',
      secondary:
        'bg-accent text-white hover:bg-accent-600 shadow-sm hover:shadow-md focus:ring-accent/40 disabled:opacity-60',
      danger:
        'bg-red-500 text-white hover:bg-red-600 shadow-sm hover:shadow-red-200 focus:ring-red-400/50 disabled:opacity-60',
      ghost:
        'bg-transparent text-gray-700 hover:bg-gray-100 focus:ring-gray-300 disabled:opacity-60',
      outline:
        'border border-gray-200 bg-white text-gray-700 hover:bg-gray-50 hover:border-gray-300 focus:ring-gray-200 shadow-sm disabled:opacity-60',
    };

    const sizes = {
      sm: 'text-xs px-3 py-1.5 gap-1.5 h-8',
      md: 'text-sm px-4 py-2.5 gap-2 h-10',
      lg: 'text-sm px-6 py-3 gap-2 h-12',
    };

    return (
      <button
        ref={ref}
        className={cn(base, variants[variant], sizes[size], className)}
        disabled={disabled || loading}
        {...props}
      >
        {loading ? (
          <Spinner size="sm" color={variant === 'ghost' || variant === 'outline' ? 'dark' : 'white'} />
        ) : (
          leftIcon
        )}
        {children}
        {!loading && rightIcon}
      </button>
    );
  }
);

Button.displayName = 'Button';
export default Button;
