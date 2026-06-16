import { useCallback, useRef, type KeyboardEvent } from 'react';

export type CartGridField = 'discountPercent' | 'quantity' | 'unitPriceUsd';

const FIELD_ORDER: CartGridField[] = ['discountPercent', 'quantity', 'unitPriceUsd'];

function fieldKey(rowId: string, field: CartGridField) {
  return `${rowId}:${field}`;
}

export function useCartGridKeyboardNav(getRowIds: () => string[]) {
  const inputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  const setRef = useCallback((rowId: string, field: CartGridField) => {
    return (el: HTMLInputElement | null) => {
      inputRefs.current[fieldKey(rowId, field)] = el;
    };
  }, []);

  const focusField = useCallback((rowId: string, field: CartGridField) => {
    const el = inputRefs.current[fieldKey(rowId, field)];
    if (el) {
      el.focus();
      el.select();
    }
  }, []);

  const onKeyDown = useCallback(
    (e: KeyboardEvent<HTMLInputElement>, rowId: string, field: CartGridField) => {
      const key = e.key;
      if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(key)) return;

      const rowIds = getRowIds();
      const rowIndex = rowIds.indexOf(rowId);
      const fieldIndex = FIELD_ORDER.indexOf(field);
      if (rowIndex < 0 || fieldIndex < 0) return;

      e.preventDefault();

      if (key === 'ArrowLeft') {
        if (fieldIndex > 0) {
          focusField(rowId, FIELD_ORDER[fieldIndex - 1]);
        } else if (rowIndex > 0) {
          focusField(rowIds[rowIndex - 1], FIELD_ORDER[FIELD_ORDER.length - 1]);
        }
        return;
      }

      if (key === 'ArrowRight') {
        if (fieldIndex < FIELD_ORDER.length - 1) {
          focusField(rowId, FIELD_ORDER[fieldIndex + 1]);
        } else if (rowIndex < rowIds.length - 1) {
          focusField(rowIds[rowIndex + 1], FIELD_ORDER[0]);
        }
        return;
      }

      if (key === 'ArrowUp' && rowIndex > 0) {
        focusField(rowIds[rowIndex - 1], field);
        return;
      }

      if (key === 'ArrowDown' && rowIndex < rowIds.length - 1) {
        focusField(rowIds[rowIndex + 1], field);
      }
    },
    [getRowIds, focusField]
  );

  return { setRef, focusField, onKeyDown };
}
