import type { Machine } from '@arcade/contracts';
import type { ReactNode } from 'react';

export function PageTitle({ eyebrow, title, action }: {
  eyebrow: string;
  title: string;
  action?: ReactNode;
}) {
  return (
    <header className="page-title">
      <div><span className="eyebrow">{eyebrow}</span><h1>{title}</h1></div>
      {action}
    </header>
  );
}

export function ResourceMessage({ kind, children }: {
  kind: 'loading' | 'error' | 'empty' | 'success';
  children: ReactNode;
}) {
  return <div className={`resource-message ${kind}`} role={kind === 'error' ? 'alert' : 'status'}>{children}</div>;
}

export function MachineCard({ machine }: { machine: Machine }) {
  return (
    <article className="machine">
      <div className="machine-art">{machine.name.slice(0, 2).toUpperCase()}</div>
      <div>
        <span>ARCADE MACHINE</span>
        <h3>{machine.name}</h3>
        <b className={machine.status.toLowerCase()}>{machine.status}</b>
      </div>
    </article>
  );
}
