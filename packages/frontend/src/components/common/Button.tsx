import React from 'react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger' | 'soft';
  size?: 'sm' | 'md' | 'lg';
  icon?: React.ReactNode;
  loading?: boolean;
}

export const Button: React.FC<ButtonProps> = ({
  children,
  variant = 'primary',
  size = 'md',
  icon,
  loading = false,
  className,
  disabled,
  ...props
}) => {
  const baseStyles = 'inline-flex items-center justify-center font-medium rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed';
  
  const sizeStyles = {
    sm: 'text-xs px-2.5 py-1.5 gap-1.5',
    md: 'text-sm px-3.5 py-2 gap-2',
    lg: 'text-base px-5 py-2.5 gap-2.5',
  };

  const variantStyles = {
    primary: 'bg-teal-600 text-white hover:bg-teal-700 active:bg-teal-800 focus:ring-2 focus:ring-teal-500 shadow-sm font-semibold transition-all active:scale-[0.98]',
    soft: 'bg-teal-50 text-teal-900 border border-teal-200 hover:bg-teal-100 active:bg-teal-200 focus:ring-2 focus:ring-teal-500 font-medium shadow-2xs',
    outline: 'border border-teal-300 text-teal-700 bg-white hover:bg-teal-50 hover:border-teal-400 active:bg-teal-100 focus:ring-2 focus:ring-teal-500 font-medium shadow-2xs',
    secondary: 'bg-slate-100 text-slate-800 hover:bg-slate-200 active:bg-slate-300 focus:ring-2 focus:ring-slate-400 font-medium shadow-2xs',
    ghost: 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 focus:ring-2 focus:ring-slate-300',
    danger: 'bg-rose-600 text-white hover:bg-rose-700 active:bg-rose-800 focus:ring-2 focus:ring-rose-500 shadow-sm font-semibold',
  };

  return (
    <button
      className={twMerge(clsx(baseStyles, sizeStyles[size], variantStyles[variant], className))}
      disabled={disabled || loading}
      {...props}
    >
      {loading ? (
        <svg className="animate-spin -ml-0.5 mr-2 h-4 w-4 text-current" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
      ) : icon ? (
        <span className="shrink-0">{icon}</span>
      ) : null}
      {children}
    </button>
  );
};
