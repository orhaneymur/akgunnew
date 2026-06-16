import { useEffect, useRef } from 'react';
import { formatMoney, formatUsd, roundPrice } from '../lib/api';
import type { F2Product } from '../hooks/useF2ProductSearch';

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
              <p className="text-[0.625rem] text-slate-500">{product.sku}</p>
              {hasPartyPrice && (
                <p className="text-[0.625rem] text-amber-700">
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
                  <p className="text-[0.625rem] text-slate-500">{formatMoney(product.priceTl)}</p>
                </>
              ) : (
                <>
                  <p className="text-xs font-bold text-slate-900 tabular-nums">
                    {formatMoney(product.priceTl)}
                  </p>
                  <p className="text-[0.625rem] text-slate-500">{formatUsd(product.priceUsd)}</p>
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
    return roundPrice(product.lastPartyPriceTl);
  }
  if (partySelected && product.lastSoldPrice != null) {
    return roundPrice(product.lastSoldPrice);
  }
  return roundPrice(product.priceTl);
}

export function resolveSalesUnitPriceUsd(
  product: F2Product,
  partySelected: boolean,
  exchangeRate: number
) {
  if (partySelected && product.lastPartyPriceUsd != null) {
    return roundPrice(product.lastPartyPriceUsd);
  }
  if (partySelected && product.lastPartyPriceTl != null) {
    const priceUsd = product.priceUsd;
    const partyTl = product.lastPartyPriceTl;
    const usd =
      partyTl > priceUsd * 4 ? partyTl / exchangeRate : partyTl;
    return roundPrice(usd);
  }
  if (partySelected && product.lastSoldPriceUsd != null) {
    return roundPrice(product.lastSoldPriceUsd);
  }
  return roundPrice(product.priceUsd);
}

export function resolvePurchaseUnitPriceTl(product: F2Product, partySelected: boolean) {
  if (partySelected && product.lastPartyPriceTl != null) {
    return roundPrice(product.lastPartyPriceTl);
  }
  if (partySelected && product.lastSoldPrice != null) {
    return roundPrice(product.lastSoldPrice);
  }
  return roundPrice(product.costPrice > 0 ? product.costPrice : product.priceTl);
}

export function resolvePurchaseUnitPriceUsd(
  product: F2Product,
  partySelected: boolean,
  exchangeRate: number
) {
  if (partySelected && product.lastPartyPriceUsd != null) {
    return roundPrice(product.lastPartyPriceUsd);
  }
  if (partySelected && product.lastSoldPriceUsd != null) {
    return roundPrice(product.lastSoldPriceUsd);
  }
  const costUsd =
    product.costUsd ??
    (product.costPrice > 0 && exchangeRate > 0
      ? product.costPrice / exchangeRate
      : 0);
  return roundPrice(costUsd > 0 ? costUsd : product.priceUsd);
}
