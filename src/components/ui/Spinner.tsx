import React from 'react';
import { cn } from '../../lib/utils';

interface SpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  color?: 'white' | 'dark' | 'primary';
  className?: string;
}

const Spinner: React.FC<SpinnerProps> = ({ size = 'md', color = 'primary', className }) => {
  const sizes = { sm: 'w-4 h-4', md: 'w-6 h-6', lg: 'w-10 h-10' };
  const colors = {
    white: 'border-white/30 border-t-white',
    dark: 'border-gray-300 border-t-gray-800',
    primary: 'border-primary/20 border-t-primary',
  };

  return (
    <div
      className={cn('rounded-full border-2 animate-spin', sizes[size], colors[color], className)}
    />
  );
};

export default Spinner;
