import React from 'react';
import { cn, getInitials } from '../../lib/utils';

interface AvatarProps {
  name: string;
  src?: string;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
  online?: boolean;
}

const Avatar: React.FC<AvatarProps> = ({ name, src, size = 'md', className, online }) => {
  const safeName = name || '?';

  const sizes = {
    xs: 'w-6 h-6 text-xs',
    sm: 'w-8 h-8 text-xs',
    md: 'w-10 h-10 text-sm',
    lg: 'w-12 h-12 text-base',
    xl: 'w-16 h-16 text-lg',
  };

  const colors = [
    'bg-blue-500', 'bg-purple-500', 'bg-green-500', 'bg-amber-500',
    'bg-red-500', 'bg-pink-500', 'bg-indigo-500', 'bg-teal-500',
  ];

  const colorIndex = safeName.charCodeAt(0) % colors.length;
  const bgColor = colors[colorIndex];

  return (
    <div className={cn('relative inline-flex flex-shrink-0', className)}>
      {src ? (
        <img
          src={src}
          alt={safeName}
          className={cn('rounded-full object-cover', sizes[size])}
          onError={(e) => {
            (e.target as HTMLImageElement).style.display = 'none';
          }}
        />
      ) : (
        <div
          className={cn(
            'rounded-full flex items-center justify-center font-semibold text-white',
            sizes[size],
            bgColor
          )}
        >
          {getInitials(safeName)}
        </div>
      )}
      {online !== undefined && (
        <span
          className={cn(
            'absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full border-2 border-white',
            online ? 'bg-green-500' : 'bg-slate-400'
          )}
        />
      )}
    </div>
  );
};

export default Avatar;
