import { useLayoutEffect, useRef, type ChangeEvent, type ClipboardEvent, type KeyboardEvent, type MouseEvent } from 'react';
import { formatMoney } from '../lib/format';
import { fieldLabelClass, inputClass } from '../lib/ui';

type Props = {
  value: number;
  onChange: (cents: number) => void;
  id: string;
  label?: string;
  'aria-describedby'?: string;
  'aria-invalid'?: boolean;
  disabled?: boolean;
  maxCents?: number;
  className?: string;
};

// Só dígitos viram centavos: "R$ 1.234,56" -> 123456
function digitsToCents(text: string, maxCents: number): number {
  const digits = text.replace(/\D/g, '');
  const cents = digits ? parseInt(digits, 10) : 0;
  return Math.min(cents, maxCents);
}

// Máscara de banco: os dígitos entram pela direita, então o cursor fica sempre no fim
export function MoneyInput({
  value,
  onChange,
  id,
  label,
  'aria-describedby': describedBy,
  'aria-invalid': invalid,
  disabled,
  maxCents = 10_000_000,
  className = '',
}: Props) {
  const ref = useRef<HTMLInputElement>(null);
  const text = formatMoney(value);

  function caretToEnd() {
    const el = ref.current;
    if (el && document.activeElement === el) el.setSelectionRange(el.value.length, el.value.length);
  }

  // Depois de cada mudança, o React reescreve o texto; devolve o cursor ao fim
  useLayoutEffect(caretToEnd, [text]);

  function handleChange(e: ChangeEvent<HTMLInputElement>) {
    onChange(digitsToCents(e.target.value, maxCents));
  }

  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.ctrlKey || e.metaKey || e.altKey) return; // copiar, colar, selecionar tudo
    if (e.key === 'Backspace' || e.key === 'Delete') {
      e.preventDefault();
      const el = e.currentTarget;
      const allSelected = el.selectionStart === 0 && el.selectionEnd === el.value.length;
      onChange(allSelected ? 0 : Math.floor(value / 10));
      return;
    }
    // Bloqueia caracteres imprimíveis que não sejam dígitos; Tab, setas, Enter etc. passam.
    // Teclados virtuais do Android mandam "Unidentified": o handleChange filtra depois.
    if (e.key.length === 1 && !/\d/.test(e.key)) e.preventDefault();
  }

  // Colar substitui o valor inteiro em vez de juntar com os dígitos atuais
  function handlePaste(e: ClipboardEvent<HTMLInputElement>) {
    e.preventDefault();
    onChange(digitsToCents(e.clipboardData.getData('text'), maxCents));
  }

  function handleClick(e: MouseEvent<HTMLInputElement>) {
    const el = e.currentTarget;
    if (el.selectionStart === el.selectionEnd) caretToEnd();
  }

  return (
    <>
      {label && (
        <label htmlFor={id} className={fieldLabelClass}>
          {label}
        </label>
      )}
      <input
        ref={ref}
        id={id}
        type="text"
        inputMode="numeric"
        autoComplete="off"
        placeholder={formatMoney(0)}
        value={text}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        onPaste={handlePaste}
        onFocus={caretToEnd}
        onClick={handleClick}
        disabled={disabled}
        aria-invalid={invalid || undefined}
        aria-describedby={describedBy}
        className={`${inputClass} tabular-nums ${className}`}
      />
    </>
  );
}
