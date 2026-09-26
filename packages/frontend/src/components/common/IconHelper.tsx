import React from 'react';
import * as LucideIcons from 'lucide-react';

interface IconHelperProps {
  name: string;
  className?: string;
  size?: number;
}

export const IconHelper: React.FC<IconHelperProps> = ({ name, className = 'w-4 h-4', size }) => {
  const IconComponent = (LucideIcons as any)[name] || LucideIcons.FileText;
  return <IconComponent className={className} size={size} />;
};
