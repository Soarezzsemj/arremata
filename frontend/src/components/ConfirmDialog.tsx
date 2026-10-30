import { useEffect, useId, useRef, type ReactNode } from 'react';
import { buttonClass, secondaryButtonClass } from '../lib/ui';
import { Square } from './Square';

export function ConfirmDialog({
  open,
  title,
  children,
  confirmLabel,
  cancelLabel = 'Voltar',
  pendingLabel = 'Aguarde...',
  pending = false,
  onConfirm,
  onClose,
}: {
  open: boolean;
  title: string;
  children: ReactNode;
  confirmLabel: string;
  cancelLabel?: string;
  pendingLabel?: string;
  pending?: boolean;
  onConfirm: () => void;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const descId = useId();

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    else if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      aria-describedby={descId}
      onClose={onClose}
      onCancel={(e) => {
        if (pending) e.preventDefault();
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget && !pending) e.currentTarget.close();
      }}
      className="m-auto w-[calc(100%-2rem)] max-w-md border border-ink bg-paper p-6 text-ink backdrop:bg-night/60 md:p-8"
    >
      <h2 id={titleId} className="ui-label flex items-center gap-2">
        <Square />
        {title}
      </h2>
      <div id={descId} className="mt-4 text-sm leading-relaxed">
        {children}
      </div>
      <div className="mt-8 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
        <button type="button" autoFocus disabled={pending} onClick={() => ref.current?.close()} className={secondaryButtonClass}>
          {cancelLabel}
        </button>
        <button type="button" disabled={pending} onClick={onConfirm} className={buttonClass}>
          {pending ? pendingLabel : confirmLabel}
        </button>
      </div>
    </dialog>
  );
}
