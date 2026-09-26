import React from 'react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

interface BadgeProps {
  children: React.ReactNode;
  variant?: 'primary' | 'slate' | 'teal' | 'emerald' | 'amber' | 'rose' | 'indigo' | 'purple' | 'success' | 'warning' | 'danger' | 'default';
  size?: 'sm' | 'md';
  className?: string;
}

export const Badge: React.FC<BadgeProps> = ({
  children,
  variant = 'slate',
  size = 'sm',
  className,
}) => {
  const variantStyles: Record<string, string> = {
    primary: 'bg-teal-50 text-teal-700 border-teal-200',
    teal: 'bg-teal-50 text-teal-700 border-teal-200',
    slate: 'bg-slate-100 text-slate-700 border-slate-200',
    default: 'bg-slate-100 text-slate-700 border-slate-200',
    emerald: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    success: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    amber: 'bg-amber-50 text-amber-800 border-amber-200',
    warning: 'bg-amber-50 text-amber-800 border-amber-200',
    rose: 'bg-rose-50 text-rose-700 border-rose-200',
    danger: 'bg-rose-50 text-rose-700 border-rose-200',
    indigo: 'bg-indigo-50 text-indigo-700 border-indigo-200',
    purple: 'bg-purple-50 text-purple-700 border-purple-200',
  };

  const sizeStyles = {
    sm: 'text-xs px-2 py-0.5 font-medium',
    md: 'text-sm px-2.5 py-1 font-medium',
  };

  return (
    <span
      className={twMerge(
        clsx(
          'inline-flex items-center rounded-md border',
          variantStyles[variant],
          sizeStyles[size],
          className
        )
      )}
    >
      {children}
    </span>
  );
};
