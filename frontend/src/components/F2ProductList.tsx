import { useEffect, useRef } from 'react';
import { formatUsd, roundPrice } from '../lib/api';
import type { F2Product } from '../hooks/useF2ProductSearch';

type F2ProductListProps = {
  products: F2Product[];
  focusedIndex: number;
  onFocusIndex: (index: number) => void;
  onSelect: (product: F2Product) => void;
  partySelected: boolean;
  accentClass?: string;
  showCost?: boolean;
};

export default function F2ProductList({
  products,
  focusedIndex,
  onFocusIndex,
  onSelect,
  partySelected,
  accentClass = 'indigo',
  showCost = false,
}: F2ProductListProps) {
  const itemRefs = useRef<Map<number, HTMLLIElement>>(new Map());

  useEffect(() => {
    if (focusedIndex < 0) return;
    itemRefs.current.get(focusedIndex)?.scrollIntoView({ block: 'nearest' });
  }, [focusedIndex]);

  const focusRing =
    accentClass === 'amber'
      ? 'bg-amber-50 border-amber-600'
      : accentClass === 'rose'
        ? 'bg-rose-50 border-rose-600'
        : 'bg-indigo-50 border-indigo-600';

  return (
    <ul className="divide-y divide-slate-100">
      {products.map((product, index) => {
        const partyUsd = resolvePartyPriceUsd(product, partySelected);

        return (
          <li
            key={product.id}
            ref={(element) => {
              if (element) itemRefs.current.set(index, element);
              else itemRefs.current.delete(index);
            }}
            onClick={() => onSelect(product)}
            onMouseEnter={() => onFocusIndex(index)}
            className={`px-3 py-2 cursor-pointer flex items-center justify-between gap-2 transition-colors border-l-2 ${
              focusedIndex === index ? focusRing : 'hover:bg-slate-50 border-transparent'
            }`}
          >
            <div className="min-w-0">
              <p className="text-[11px] font-medium leading-snug text-slate-900 break-words">{product.name}</p>
              <p className="text-caption text-slate-500">{product.sku}</p>
              {partySelected && partyUsd != null && (
                <p className="text-caption text-amber-700">
                  Son fiyat: {formatUsd(partyUsd)}
                </p>
              )}
              {showCost && (
                <p className="text-caption text-slate-500">
                  Maliyet:{' '}
                  {formatUsd(
                    product.costUsd != null && product.costUsd > 0
                      ? roundPrice(product.costUsd)
                      : roundPrice(product.priceUsd)
                  )}
                </p>
              )}
            </div>
            <div className="text-right shrink-0">
              <p className="text-xs font-bold text-slate-900 tabular-nums">
                {formatUsd(product.priceUsd)}
              </p>
            </div>
          </li>
        );
      })}
    </ul>
  );
}

function resolvePartyPriceUsd(product: F2Product, partySelected: boolean) {
  if (!partySelected) return null;
  if (product.lastPartyPriceUsd != null) {
    return roundPrice(product.lastPartyPriceUsd);
  }
  if (product.lastSoldPriceUsd != null) {
    return roundPrice(product.lastSoldPriceUsd);
  }
  if (product.lastPartyPriceTl != null) {
    return roundPrice(product.lastPartyPriceTl);
  }
  if (product.lastSoldPrice != null) {
    return roundPrice(product.lastSoldPrice);
  }
  return null;
}

export function resolveSalesUnitPriceUsd(product: F2Product, partySelected: boolean) {
  const partyUsd = resolvePartyPriceUsd(product, partySelected);
  if (partyUsd != null) return partyUsd;
  return roundPrice(product.priceUsd);
}

export function resolvePurchaseUnitPriceUsd(product: F2Product, partySelected: boolean) {
  if (partySelected && product.lastPartyPriceUsd != null) {
    return roundPrice(product.lastPartyPriceUsd);
  }
  if (partySelected && product.lastSoldPriceUsd != null) {
    return roundPrice(product.lastSoldPriceUsd);
  }
  const costUsd =
    product.costUsd ?? (product.costPrice > 0 ? roundPrice(product.costPrice) : 0);
  return roundPrice(costUsd > 0 ? costUsd : product.priceUsd);
}
