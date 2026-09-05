import React from 'react';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger' | 'ai';
  size?: 'sm' | 'md' | 'lg';
  icon?: React.ReactNode;
  iconPosition?: 'left' | 'right';
  isLoading?: boolean;
}

export const Button: React.FC<ButtonProps> = ({
  children,
  variant = 'primary',
  size = 'md',
  icon,
  iconPosition = 'left',
  isLoading = false,
  className = '',
  disabled,
  ...props
}) => {
  const baseStyles =
    'inline-flex items-center justify-center font-medium rounded-md transition-colors focus:outline-none focus:ring-2 focus:ring-offset-1 disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap select-none';

  const sizeStyles = {
    sm: 'text-xs h-7.5 px-2.5 gap-1.5',
    md: 'text-xs h-8.5 px-3.5 gap-1.5',
    lg: 'text-sm h-10 px-4 gap-2',
  };

  const variantStyles = {
    primary:
      'bg-[#714B67] hover:bg-[#62415A] active:bg-[#54374D] text-white focus:ring-[#714B67]/40 shadow-2xs',
    secondary:
      'bg-white hover:bg-[#F8F9FA] text-[#1F2937] focus:ring-slate-300 border border-[#D1D5DB] shadow-2xs',
    outline:
      'bg-transparent hover:bg-[#F8F9FA] text-[#374151] border border-[#D1D5DB] focus:ring-slate-300',
    ghost:
      'bg-transparent hover:bg-[#F3EDF2] hover:text-[#714B67] text-[#4B5563] focus:ring-[#714B67]/30',
    danger:
      'bg-[#DC2626] hover:bg-[#B91C1C] text-white focus:ring-red-400 shadow-2xs',
    ai:
      'bg-[#6D28D9] hover:bg-[#5B21B6] text-white focus:ring-purple-400 shadow-2xs',
  };

  return (
    <button
      className={`${baseStyles} ${sizeStyles[size]} ${variantStyles[variant]} ${className}`}
      disabled={disabled || isLoading}
      {...props}
    >
      {isLoading ? (
        <span className="w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin mr-1.5" />
      ) : icon && iconPosition === 'left' ? (
        <span className="shrink-0">{icon}</span>
      ) : null}
      <span>{children}</span>
      {!isLoading && icon && iconPosition === 'right' ? (
        <span className="shrink-0">{icon}</span>
      ) : null}
    </button>
  );
};

export interface IconButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  label: string;
}

export const IconButton: React.FC<IconButtonProps> = ({
  children,
  variant = 'ghost',
  size = 'md',
  label,
  className = '',
  ...props
}) => {
  const sizeStyles = {
    sm: 'w-7 h-7 text-xs',
    md: 'w-8 h-8 text-xs',
    lg: 'w-9.5 h-9.5 text-sm',
  };

  const variantStyles = {
    primary: 'bg-[#714B67] hover:bg-[#62415A] text-white shadow-2xs',
    secondary: 'bg-white hover:bg-[#F8F9FA] text-[#1F2937] border border-[#D1D5DB] shadow-2xs',
    outline: 'bg-transparent hover:bg-[#F8F9FA] text-[#374151] border border-[#D1D5DB]',
    ghost: 'bg-transparent hover:bg-[#F3EDF2] hover:text-[#714B67] text-[#4B5563]',
    danger: 'bg-[#DC2626] hover:bg-[#B91C1C] text-white shadow-2xs',
  };

  return (
    <button
      aria-label={label}
      title={label}
      className={`inline-flex items-center justify-center rounded-md transition-colors focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-slate-300 disabled:opacity-50 disabled:cursor-not-allowed ${sizeStyles[size]} ${variantStyles[variant]} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
};
