import type { InputHTMLAttributes, ReactNode } from "react";
import clsx from "clsx";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  icon?: ReactNode;
}

export default function Input({ label, error, icon, className, id, ...rest }: InputProps) {
  return (
    <div className="w-full">
      {label && (
        <label htmlFor={id} className="block text-sm font-medium text-gray-700 mb-1.5">
          {label}
        </label>
      )}
      <div className="relative">
        {icon && <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">{icon}</span>}
        <input
          id={id}
          className={clsx(
            "w-full rounded-lg border text-sm px-3 py-2.5 bg-white text-gray-900 placeholder:text-gray-400 outline-none transition-colors",
            "focus:border-navy-500 focus:ring-2 focus:ring-navy-100",
            icon && "pl-9",
            error ? "border-red-400" : "border-gray-300",
            className
          )}
          {...rest}
        />
      </div>
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  );
}
