import { useEffect, useRef } from 'react';
import { formatMoney } from '../lib/api';
import type { F2Product } from '../hooks/useF2ProductSearch';

function formatUsd(value: number) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

type F2ProductListProps = {
  products: F2Product[];
  focusedIndex: number;
  onFocusIndex: (index: number) => void;
  onSelect: (product: F2Product) => void;
  partySelected: boolean;
  priceMode: 'usd' | 'tl';
  accentClass?: string;
};

export default function F2ProductList({
  products,
  focusedIndex,
  onFocusIndex,
  onSelect,
  partySelected,
  priceMode,
  accentClass = 'indigo',
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
        const partyUsd = product.lastPartyPriceUsd ?? product.lastSoldPriceUsd;
        const partyTl = product.lastPartyPriceTl ?? product.lastSoldPrice;
        const hasPartyPrice = partySelected && partyTl != null;

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
              <p className="text-xs font-medium text-slate-900 truncate">{product.name}</p>
              <p className="text-[10px] text-slate-500">{product.sku}</p>
              {hasPartyPrice && (
                <p className="text-[10px] text-amber-700">
                  Son fiyat:{' '}
                  {priceMode === 'usd' && partyUsd != null
                    ? formatUsd(partyUsd)
                    : formatMoney(partyTl!)}
                </p>
              )}
            </div>
            <div className="text-right shrink-0">
              {priceMode === 'usd' ? (
                <>
                  <p className="text-xs font-bold text-slate-900 tabular-nums">
                    {formatUsd(product.priceUsd)}
                  </p>
                  <p className="text-[10px] text-slate-500">{formatMoney(product.priceTl)}</p>
                </>
              ) : (
                <>
                  <p className="text-xs font-bold text-slate-900 tabular-nums">
                    {formatMoney(product.priceTl)}
                  </p>
                  <p className="text-[10px] text-slate-500">{formatUsd(product.priceUsd)}</p>
                </>
              )}
            </div>
          </li>
        );
      })}
    </ul>
  );
}

export function resolveSalesUnitPriceTl(product: F2Product, partySelected: boolean) {
  if (partySelected && product.lastPartyPriceTl != null) {
    return product.lastPartyPriceTl;
  }
  if (partySelected && product.lastSoldPrice != null) {
    return product.lastSoldPrice;
  }
  return product.priceTl;
}

export function resolveSalesUnitPriceUsd(
  product: F2Product,
  partySelected: boolean,
  exchangeRate: number
) {
  if (partySelected && product.lastPartyPriceUsd != null) {
    return product.lastPartyPriceUsd;
  }
  if (partySelected && product.lastPartyPriceTl != null) {
    const priceUsd = product.priceUsd;
    const partyTl = product.lastPartyPriceTl;
    return partyTl > priceUsd * 4 ? partyTl / exchangeRate : partyTl;
  }
  if (partySelected && product.lastSoldPriceUsd != null) {
    return product.lastSoldPriceUsd;
  }
  return product.priceUsd;
}

export function resolvePurchaseUnitPriceTl(product: F2Product, partySelected: boolean) {
  if (partySelected && product.lastPartyPriceTl != null) {
    return product.lastPartyPriceTl;
  }
  if (partySelected && product.lastSoldPrice != null) {
    return product.lastSoldPrice;
  }
  return product.costPrice > 0 ? product.costPrice : product.priceTl;
}
