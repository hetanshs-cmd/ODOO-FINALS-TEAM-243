import React, { forwardRef } from 'react';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helperText?: string;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, helperText, leftIcon, rightIcon, className = '', id, ...props }, ref) => {
    const inputId = id || (label ? label.toLowerCase().replace(/\s+/g, '-') : undefined);

    return (
      <div className="flex flex-col gap-1 w-full">
        {label && (
          <label htmlFor={inputId} className="text-xs font-medium text-[#374151] select-none">
            {label}
            {props.required && <span className="text-[#DC2626] ml-0.5">*</span>}
          </label>
        )}
        <div className="relative flex items-center">
          {leftIcon && (
            <div className="absolute left-2.5 flex items-center pointer-events-none text-[#9CA3AF]">
              {leftIcon}
            </div>
          )}
          <input
            id={inputId}
            ref={ref}
            className={`w-full bg-white text-[#1F2937] border rounded-md text-xs px-2.5 py-1.5 h-8.5 transition-colors placeholder:text-[#9CA3AF] focus:outline-none focus:ring-2 ${
              leftIcon ? 'pl-8' : ''
            } ${rightIcon ? 'pr-8' : ''} ${
              error
                ? 'border-[#F87171] focus:border-[#DC2626] focus:ring-[#DC2626]/20'
                : 'border-[#D1D5DB] focus:border-[#714B67] focus:ring-[#714B67]/20'
            } disabled:bg-[#F3F4F6] disabled:text-[#9CA3AF] disabled:cursor-not-allowed ${className}`}
            {...props}
          />
          {rightIcon && (
            <div className="absolute right-2.5 flex items-center pointer-events-none text-[#9CA3AF]">
              {rightIcon}
            </div>
          )}
        </div>
        {error ? (
          <span className="text-[11px] text-[#DC2626] mt-0.5">{error}</span>
        ) : helperText ? (
          <span className="text-[11px] text-[#6B7280] mt-0.5">{helperText}</span>
        ) : null}
      </div>
    );
  }
);

Input.displayName = 'Input';

export interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

export interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  options: SelectOption[];
  helperText?: string;
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ label, error, options, helperText, className = '', id, ...props }, ref) => {
    const selectId = id || (label ? label.toLowerCase().replace(/\s+/g, '-') : undefined);

    return (
      <div className="flex flex-col gap-1 w-full">
        {label && (
          <label htmlFor={selectId} className="text-xs font-medium text-[#374151] select-none">
            {label}
            {props.required && <span className="text-[#DC2626] ml-0.5">*</span>}
          </label>
        )}
        <select
          id={selectId}
          ref={ref}
          className={`w-full bg-white text-[#1F2937] border rounded-md text-xs px-2.5 py-1.5 h-8.5 transition-colors focus:outline-none focus:ring-2 cursor-pointer ${
            error
              ? 'border-[#F87171] focus:border-[#DC2626] focus:ring-[#DC2626]/20'
              : 'border-[#D1D5DB] focus:border-[#714B67] focus:ring-[#714B67]/20'
          } disabled:bg-[#F3F4F6] disabled:text-[#9CA3AF] disabled:cursor-not-allowed ${className}`}
          {...props}
        >
          {options.map((opt) => (
            <option key={opt.value} value={opt.value} disabled={opt.disabled}>
              {opt.label}
            </option>
          ))}
        </select>
        {error ? (
          <span className="text-[11px] text-[#DC2626] mt-0.5">{error}</span>
        ) : helperText ? (
          <span className="text-[11px] text-[#6B7280] mt-0.5">{helperText}</span>
        ) : null}
      </div>
    );
  }
);

Select.displayName = 'Select';

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
  helperText?: string;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ label, error, helperText, className = '', id, ...props }, ref) => {
    const textareaId = id || (label ? label.toLowerCase().replace(/\s+/g, '-') : undefined);

    return (
      <div className="flex flex-col gap-1 w-full">
        {label && (
          <label htmlFor={textareaId} className="text-xs font-medium text-[#374151] select-none">
            {label}
            {props.required && <span className="text-[#DC2626] ml-0.5">*</span>}
          </label>
        )}
        <textarea
          id={textareaId}
          ref={ref}
          className={`w-full bg-white text-[#1F2937] border rounded-md text-xs p-2.5 transition-colors placeholder:text-[#9CA3AF] focus:outline-none focus:ring-2 ${
            error
              ? 'border-[#F87171] focus:border-[#DC2626] focus:ring-[#DC2626]/20'
              : 'border-[#D1D5DB] focus:border-[#714B67] focus:ring-[#714B67]/20'
          } disabled:bg-[#F3F4F6] disabled:text-[#9CA3AF] disabled:cursor-not-allowed ${className}`}
          {...props}
        />
        {error ? (
          <span className="text-[11px] text-[#DC2626] mt-0.5">{error}</span>
        ) : helperText ? (
          <span className="text-[11px] text-[#6B7280] mt-0.5">{helperText}</span>
        ) : null}
      </div>
    );
  }
);

Textarea.displayName = 'Textarea';

export interface CheckboxProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string;
}

export const Checkbox: React.FC<CheckboxProps> = ({ label, className = '', id, ...props }) => {
  const checkboxId = id || label.toLowerCase().replace(/\s+/g, '-');
  return (
    <label htmlFor={checkboxId} className="inline-flex items-center gap-2 cursor-pointer select-none">
      <input
        type="checkbox"
        id={checkboxId}
        className={`w-3.5 h-3.5 text-[#714B67] border-[#D1D5DB] rounded focus:ring-[#714B67]/30 ${className}`}
        {...props}
      />
      <span className="text-xs text-[#374151]">{label}</span>
    </label>
  );
};

export interface SwitchProps {
  label?: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
}

export const Switch: React.FC<SwitchProps> = ({ label, checked, onChange, disabled }) => {
  return (
    <label className={`inline-flex items-center gap-2 select-none ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => !disabled && onChange(!checked)}
        className={`w-8 h-4.5 flex items-center rounded-full p-0.5 transition-colors focus:outline-none focus:ring-2 focus:ring-[#714B67]/30 ${
          checked ? 'bg-[#714B67]' : 'bg-[#D1D5DB]'
        }`}
      >
        <span
          className={`bg-white w-3.5 h-3.5 rounded-full shadow-xs transform transition-transform ${
            checked ? 'translate-x-3.5' : 'translate-x-0'
          }`}
        />
      </button>
      {label && <span className="text-xs text-[#374151]">{label}</span>}
    </label>
  );
};
