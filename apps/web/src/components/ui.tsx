import type { Machine } from '@arcade/contracts';
import type { ReactNode } from 'react';

export function cx(...parts: Array<string | false | undefined>) {
  return parts.filter(Boolean).join(' ');
}

export const fieldClass = 'grid gap-2 text-xs text-mist';
export const inputClass = 'w-full rounded border border-line bg-input px-3.5 py-3 text-sm text-white outline-none transition focus:border-mint';
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

export function PageTitle({ eyebrow, title, action }: {
  eyebrow: string;
  title: string;
  action?: ReactNode;
}) {
  return (
    <header className="mb-8 flex items-end justify-between gap-4 max-sm:items-start">
      <div>
        <span className="font-display text-[11px] tracking-[0.22em] text-mint">{eyebrow}</span>
        <h1 className="mt-1.5 mb-0 text-[clamp(28px,4vw,44px)] uppercase tracking-[-0.03em]">{title}</h1>
      </div>
      {action}
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
