import React from 'react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

interface CardProps {
  children: React.ReactNode;
  className?: string;
  title?: string;
  description?: string;
  headerAction?: React.ReactNode;
  onClick?: () => void;
}

export const Card: React.FC<CardProps> = ({
  children,
  className,
  title,
  description,
  headerAction,
  onClick,
}) => {
  return (
    <div
      onClick={onClick}
      className={twMerge(clsx('bg-white border border-slate-200/80 rounded-xl shadow-xs overflow-hidden', className))}
    >
      {(title || headerAction) && (
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <div>
            {title && <h3 className="font-semibold text-slate-900 text-sm md:text-base">{title}</h3>}
            {description && <p className="text-xs text-slate-500 mt-0.5">{description}</p>}
          </div>
          {headerAction && <div>{headerAction}</div>}
        </div>
      )}
      <div className="p-6">{children}</div>
    </div>
  );
};
