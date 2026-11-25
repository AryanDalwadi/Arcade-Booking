import { useEffect, useId, useRef, useState } from 'react';
import { secondaryButtonClass } from './ui';

export function RowActionsMenu({
  onView,
  onEdit,
  onDelete,
}: {
  onView?: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const menuId = useId();
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    }
    window.addEventListener('mousedown', onPointerDown);
    return () => window.removeEventListener('mousedown', onPointerDown);
  }, [open]);

  const items = [
    onView ? { label: 'View', action: onView } : null,
    onEdit ? { label: 'Edit', action: onEdit } : null,
    onDelete ? { label: 'Delete', action: onDelete } : null,
  ].filter(Boolean) as Array<{ label: string; action: () => void }>;

  if (items.length === 0) return null;

  return (
    <div className="relative inline-block" ref={rootRef}>
      <button
        type="button"
        className={secondaryButtonClass('px-2 py-1 text-lg leading-none')}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={menuId}
        onClick={() => setOpen((value) => !value)}
      >
        ⋮
      </button>
      {open && (
        <ul
          id={menuId}
          role="menu"
          className="absolute left-0 top-full z-20 mt-1 min-w-[120px] list-none rounded border border-line bg-input p-1 shadow-lg"
        >
          {items.map((item) => (
            <li key={item.label} role="none">
              <button
                type="button"
                role="menuitem"
                className="block w-full rounded px-3 py-2 text-left text-sm text-white hover:bg-white/10"
                onClick={() => {
                  setOpen(false);
                  item.action();
                }}
              >
                {item.label}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
