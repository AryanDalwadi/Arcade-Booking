import { useEffect, type ReactNode } from 'react';

const modalClosers: Array<() => void> = [];

export function Modal({
  open,
  title,
  subtitle,
  onClose,
  children,
  footer,
  wide = false,
  wider = false,
}: {
  open: boolean;
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  wide?: boolean;
  wider?: boolean;
}) {
  useEffect(() => {
    if (!open) return;
    const close = () => onClose();
    modalClosers.push(close);
    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== 'Escape' || modalClosers[modalClosers.length - 1] !== close) return;
      onClose();
    }
    window.addEventListener('keydown', onKeyDown);
    return () => {
      const index = modalClosers.indexOf(close);
      if (index >= 0) modalClosers.splice(index, 1);
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="presentation">
      <div
        className="absolute inset-0 bg-void-deep/75"
        aria-hidden
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
        className={`relative z-10 flex max-h-[calc(100vh-2rem)] w-full flex-col ${wider ? 'max-w-5xl' : wide ? 'max-w-3xl' : 'max-w-lg'} rounded-lg border border-line bg-panel p-5 shadow-xl`}
        onClick={(event) => event.stopPropagation()}
      >
        <header className="mb-4 shrink-0">
          <h2 id="modal-title" className="m-0 text-lg font-semibold text-white">{title}</h2>
          {subtitle && <p className="mt-1 mb-0 text-xs text-muted">{subtitle}</p>}
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto pr-1">{children}</div>
        {footer && <footer className="mt-5 flex shrink-0 flex-wrap justify-end gap-3">{footer}</footer>}
      </div>
    </div>
  );
}
