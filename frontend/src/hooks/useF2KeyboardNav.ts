import { useCallback } from 'react';
import type { F2Product } from './useF2ProductSearch';

export function useF2KeyboardNav(options: {
  open: boolean;
  results: F2Product[];
  focusedIndex: number;
  navigateFocus: (delta: number) => void;
  onSelect: (product: F2Product) => void;
  onClose: () => void;
}) {
  const { open, results, focusedIndex, navigateFocus, onSelect, onClose } = options;

  return useCallback(
    (event: React.KeyboardEvent) => {
      if (!open) return;

      if (event.key === 'ArrowDown') {
        event.preventDefault();
        navigateFocus(1);
        return;
      }

      if (event.key === 'ArrowUp') {
        event.preventDefault();
        navigateFocus(-1);
        return;
      }

      if (event.key === 'PageDown') {
        event.preventDefault();
        navigateFocus(8);
        return;
      }

      if (event.key === 'PageUp') {
        event.preventDefault();
        navigateFocus(-8);
        return;
      }

      if (event.key === 'Enter') {
        event.preventDefault();
        const index =
          focusedIndex >= 0 ? focusedIndex : results.length === 1 ? 0 : -1;
        if (index >= 0 && results[index]) {
          onSelect(results[index]);
        }
        return;
      }

      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
      }
    },
    [open, results, focusedIndex, navigateFocus, onSelect, onClose]
  );
}
