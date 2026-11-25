import type { Machine } from '@arcade/contracts';
import { useId, type ReactNode, type SelectHTMLAttributes } from 'react';

export function cx(...parts: Array<string | false | undefined>) {
  return parts.filter(Boolean).join(' ');
}

export const fieldClass = 'grid gap-2 text-xs text-mist';
export const inputClass = 'w-full rounded border border-line bg-input px-3.5 py-3 text-sm text-white outline-none transition focus:border-mint';

function ChevronDownIcon({ className }: { className?: string }) {
  return (
    <svg className={cx('size-4 shrink-0', className)} viewBox="0 0 20 20" fill="none" aria-hidden>
      <path
        d="M5 8l5 5 5-5"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/**
 * Native select with a visible chevron (browser default arrow is often hidden in dark themes).
 */
export function Select({
  className,
  wrapperClassName,
  children,
  ...props
}: SelectHTMLAttributes<HTMLSelectElement> & { wrapperClassName?: string }) {
  return (
    <div className={cx('relative min-w-0', wrapperClassName ?? 'w-full')}>
      <select
        className={cx(
          inputClass,
          'cursor-pointer appearance-none pr-10',
          className,
        )}
        {...props}
      >
        {children}
      </select>
      <span
        className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-muted"
        aria-hidden
      >
        <ChevronDownIcon />
      </span>
    </div>
  );
}
export const panelClass = 'rounded-lg border border-line bg-linear-to-br from-[#1b1d32e6] to-[#0e101ee6] p-5';
export const tableWrapClass = `${panelClass} overflow-x-auto p-0`;
export const tableClass = 'w-full border-collapse text-left';
export const thClass = 'border-b border-line px-4 py-4 text-[10px] font-semibold uppercase tracking-[0.12em] text-faint';
export const tdClass = 'border-b border-line px-4 py-4 text-[13px]';
export const noticeClass = 'rounded px-3 py-2.5 text-xs text-warn bg-warn/10';
export const errorClass = 'rounded px-3 py-2.5 text-xs text-danger bg-danger-strong/10';
export const textButtonClass = 'border-0 bg-transparent p-0 px-1 text-mint underline';
export const noteClass = 'm-0 text-xs leading-6 text-muted';
export const statusPillClass = 'font-display text-[10px] uppercase tracking-wide text-mint';

export function primaryButtonClass(extra?: string) {
  return cx(
    'w-full rounded border border-mint bg-mint px-4 py-2.5 font-semibold text-mint-ink transition enabled:hover:brightness-110 disabled:cursor-wait disabled:opacity-55',
    extra,
  );
}

/** Header/toolbar primary action — never full width. */
export function toolbarPrimaryButtonClass(extra?: string) {
  return primaryButtonClass(cx('!w-auto shrink-0 whitespace-nowrap', extra));
}

export function secondaryButtonClass(extra?: string) {
  return cx(
    'rounded border border-line bg-input px-4 py-2.5 text-sm text-white transition enabled:hover:border-mint disabled:cursor-wait disabled:opacity-55',
    extra,
  );
}

export function dangerButtonClass(extra?: string) {
  return cx(
    'rounded border border-danger-strong/60 bg-danger-strong/15 px-4 py-2.5 text-sm text-danger transition enabled:hover:bg-danger-strong/25 disabled:cursor-wait disabled:opacity-55',
    extra,
  );
}

function CheckIcon() {
  return (
    <svg className="size-3.5" viewBox="0 0 16 16" fill="none" aria-hidden>
      <path
        d="M3.5 8.5 6.5 11.5 12.5 4.5"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function AppCheckbox({
  checked,
  disabled,
  onChange,
  id,
  'aria-label': ariaLabel,
}: {
  checked: boolean;
  disabled?: boolean;
  onChange?: (checked: boolean) => void;
  id?: string;
  'aria-label'?: string;
}) {
  return (
    <button
      id={id}
      type="button"
      role="checkbox"
      aria-checked={checked}
      aria-label={ariaLabel}
      disabled={disabled}
      onClick={() => {
        if (!disabled) onChange?.(!checked);
      }}
      className={cx(
        'flex size-5 shrink-0 items-center justify-center rounded border-2 transition',
        checked
          ? 'border-mint bg-mint text-mint-ink shadow-[0_0_0_1px_rgba(92,255,200,0.35)]'
          : 'border-mint/60 bg-input text-transparent hover:border-mint',
        disabled ? 'cursor-not-allowed opacity-45' : 'cursor-pointer',
      )}
    >
      <span className={checked ? 'opacity-100' : 'opacity-0'}>
        <CheckIcon />
      </span>
    </button>
  );
}

export function CheckboxField({
  label,
  checked,
  onChange,
  disabled,
  hint,
}: {
  label: string;
  checked: boolean;
  onChange?: (checked: boolean) => void;
  disabled?: boolean;
  hint?: string;
}) {
  const inputId = useId();
  return (
    <div className="grid gap-1">
      <div className="flex items-start gap-3">
        <AppCheckbox
          id={inputId}
          checked={checked}
          disabled={disabled}
          onChange={onChange}
          aria-label={label}
        />
        <label
          htmlFor={inputId}
          className={cx(
            'cursor-pointer select-none pt-px text-sm text-white',
            disabled && 'cursor-not-allowed opacity-50',
          )}
        >
          {label}
        </label>
      </div>
      {hint && <p className="m-0 pl-8 text-xs text-muted">{hint}</p>}
    </div>
  );
}

/** Read-only table cell — not an input (use CheckboxField in edit dialogs). */
export function BooleanCell({
  value,
  trueLabel = 'Yes',
  falseLabel = 'No',
}: {
  value: boolean;
  trueLabel?: string;
  falseLabel?: string;
}) {
  return (
    <span className={value ? 'text-mint' : 'text-muted'} aria-label={value ? trueLabel : falseLabel}>
      {value ? trueLabel : falseLabel}
    </span>
  );
}

export function ActiveStatusCell({ active }: { active: boolean }) {
  return (
    <BooleanCell value={active} trueLabel="Active" falseLabel="Inactive" />
  );
}

export function PageTitle({ eyebrow, title, action }: {
  eyebrow: string;
  title: string;
  action?: ReactNode;
}) {
  return (
    <header className="mb-8 flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0 flex-1">
        <span className="font-display text-[11px] tracking-[0.22em] text-mint">{eyebrow}</span>
        <h1 className="mt-1.5 mb-0 text-[clamp(28px,4vw,44px)] uppercase tracking-[-0.03em]">{title}</h1>
      </div>
      {action ? <div className="shrink-0 self-end">{action}</div> : null}
    </header>
  );
}

const messageTone: Record<'loading' | 'error' | 'empty' | 'success', string> = {
  loading: 'border-violet/50',
  error: 'border-danger-strong/50 text-danger',
  empty: 'border-dashed',
  success: 'border-mint/40',
};

export function ResourceMessage({ kind, children }: {
  kind: 'loading' | 'error' | 'empty' | 'success';
  children: ReactNode;
}) {
  return (
    <div
      className={cx('my-4 rounded-md border border-line bg-panel px-4 py-4 text-mist', messageTone[kind])}
      role={kind === 'error' ? 'alert' : 'status'}
    >
      {children}
    </div>
  );
}

const machineStatusClass: Record<string, string> = {
  active: 'text-mint',
  maintenance: 'text-danger-strong',
  retired: 'text-muted',
};

export function MachineCard({ machine }: { machine: Machine }) {
  return (
    <article className="flex gap-4 rounded-md border border-[#2b2e45] bg-[#101322] p-3.5">
      <div className="grid min-h-[82px] w-[76px] place-items-center border border-[#634ee0] bg-[radial-gradient(circle,#663fd844,#101225)] font-display text-[23px] font-bold text-mint">
        {machine.name.slice(0, 2).toUpperCase()}
      </div>
      <div>
        <span className="text-[11px] text-muted">ARCADE MACHINE</span>
        <h3 className="my-1">{machine.name}</h3>
        <b className={cx('text-[10px]', machineStatusClass[machine.status.toLowerCase()] ?? 'text-mint')}>
          {machine.status}
        </b>
      </div>
    </article>
  );
}

export function BrandMark({ label, compactOnNarrow = false }: { label: string; compactOnNarrow?: boolean }) {
  return (
    <div className={cx(
      'flex items-center gap-2.5 font-display font-bold tracking-[0.06em]',
      compactOnNarrow && 'max-lg:justify-center max-lg:text-[0px]',
    )}>
      <span className="brand-mark grid size-9 place-items-center bg-mint text-void-deep">NA</span>
      {label}
    </div>
  );
}
