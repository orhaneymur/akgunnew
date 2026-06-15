import { useCallback } from 'react';

const NAV_KEYS = new Set([
  'ArrowDown',
  'ArrowUp',
  'PageDown',
  'PageUp',
  'Enter',
  'Escape',
]);

export function useF2KeyboardNav<T>(options: {
  open: boolean;
  results: T[];
  focusedIndex: number;
  navigateFocus: (delta: number) => void;
  onSelect: (item: T) => void;
  onClose: () => void;
}) {
  const { open, results, focusedIndex, navigateFocus, onSelect, onClose } = options;

  return useCallback(
    (event: React.KeyboardEvent) => {
      if (!open || !NAV_KEYS.has(event.key)) return;

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
        event.stopPropagation();
        onClose();
      }
    },
    [open, results, focusedIndex, navigateFocus, onSelect, onClose]
  );
}
