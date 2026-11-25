import type { ReactNode } from 'react';
import { fieldClass, inputClass, panelClass, Select } from './ui';

type SelectOption = { value: string; label: string };

export function FilterBar({
  children,
}: {
  children?: ReactNode;
}) {
  return (
    <section className={`${panelClass} mb-5 grid gap-4 max-sm:grid-cols-1`}>
      {children}
    </section>
  );
}

export function FilterField({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <label className={fieldClass}>
      {label}
      {children}
    </label>
  );
}

export function FilterTextInput({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  return (
    <FilterField label={label}>
      <input
        className={inputClass}
        value={value}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
      />
    </FilterField>
  );
}

export function FilterSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
}) {
  return (
    <FilterField label={label}>
      <Select value={value} onChange={(event) => onChange(event.target.value)}>
        {options.map((option) => (
          <option key={option.value} value={option.value}>{option.label}</option>
        ))}
      </Select>
    </FilterField>
  );
}
