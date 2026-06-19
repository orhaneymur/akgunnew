import type { F2ProductContext } from '../hooks/useF2ProductSearch';

const STORAGE_KEY = 'akgun-f2-last-product';

function storageKey(context: F2ProductContext, partyId?: number | null): string {
  return `${context}:${partyId ?? 0}`;
}

function readStore(): Record<string, number> {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== 'object') return {};
    return parsed as Record<string, number>;
  } catch {
    return {};
  }
}

function writeStore(store: Record<string, number>) {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  } catch {
    /* ignore quota */
  }
}

export function recordF2ProductSelection(
  context: F2ProductContext,
  productId: number,
  partyId?: number | null
) {
  if (!productId) return;
  const store = readStore();
  store[storageKey(context, partyId)] = productId;
  writeStore(store);
}

export function getLastF2ProductId(
  context: F2ProductContext,
  partyId?: number | null
): number | null {
  const id = readStore()[storageKey(context, partyId)];
  return typeof id === 'number' && id > 0 ? id : null;
}
