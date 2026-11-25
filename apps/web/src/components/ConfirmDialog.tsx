import { Modal } from './Modal';
import { dangerButtonClass, secondaryButtonClass } from './ui';

export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  loading,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  loading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <Modal
      open={open}
      title={title}
      onClose={onCancel}
      footer={(
        <>
          <button type="button" className={secondaryButtonClass()} onClick={onCancel} disabled={loading}>
            {cancelLabel}
          </button>
          <button type="button" className={dangerButtonClass()} onClick={onConfirm} disabled={loading}>
            {loading ? 'Working…' : confirmLabel}
          </button>
        </>
      )}
    >
      <p className="m-0 text-sm leading-6 text-mist">{message}</p>
    </Modal>
  );
}
