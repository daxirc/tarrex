import { SelectHTMLAttributes, ReactNode } from 'react';

interface SelectOption {
  value: string;
  label: string;
}

interface SelectFieldProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label: string;
  options: SelectOption[];
  error?: string;
  icon?: ReactNode;
  hint?: string;
}

export default function SelectField({ 
  label, 
  options,
  error, 
  icon,
  hint,
  className = '', 
  ...props 
}: SelectFieldProps) {
  return (
    <div className="space-y-1">
      <label className="block text-sm font-medium text-slate-700">
        {label}
        {props.required && <span className="text-red-500 ml-1">*</span>}
      </label>
      
      <div className="relative rounded-lg shadow-sm">
        {icon && (
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
            {icon}
          </div>
        )}
        <select
          className={`
            block w-full rounded-lg shadow-sm
            ${icon ? 'pl-10' : 'pl-4'}
            pr-4 py-2.5
            border-slate-200 bg-white
            text-slate-900 placeholder-slate-400
            focus:border-purple-500 focus:ring-purple-500 
            disabled:bg-slate-50 disabled:text-slate-500
            text-sm transition-colors
            ${error ? 'border-red-300 focus:border-red-500 focus:ring-red-500' : 'border-slate-200'}
            ${className}
          `}
          {...props}
        >
          <option value="">Select an option</option>
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>
      
      {hint && !error && (
        <p className="text-sm text-slate-500">{hint}</p>
      )}
      
      {error && (
        <p className="text-sm text-red-600 flex items-center">
          <span className="mr-1">⚠</span> {error}
        </p>
      )}
    </div>
  );
}