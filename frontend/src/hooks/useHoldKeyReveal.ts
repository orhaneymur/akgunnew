import { useEffect, useState } from 'react';

/** Basılı tutulan tuş (varsayılan F8) — sadece keydown/keyup, ek yük yok */
export function useHoldKeyReveal(targetKey = 'F8') {
  const [held, setHeld] = useState(false);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === targetKey) setHeld(true);
    };
    const onKeyUp = (event: KeyboardEvent) => {
      if (event.key === targetKey) setHeld(false);
    };
    const onBlur = () => setHeld(false);

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', onBlur);

    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', onBlur);
    };
  }, [targetKey]);

  return held;
}
