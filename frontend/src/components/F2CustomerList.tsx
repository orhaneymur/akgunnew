import { useEffect, useRef } from 'react';
import { balanceStyles, formatMoney, type Customer } from '../lib/api';

type F2CustomerListProps = {
  customers: Customer[];
  focusedIndex: number;
  onFocusIndex: (index: number) => void;
  onSelect: (customer: Customer) => void;
  selectedId?: number;
  accentClass?: 'emerald' | 'blue';
};

export default function F2CustomerList({
  customers,
  focusedIndex,
  onFocusIndex,
  onSelect,
  selectedId,
  accentClass = 'emerald',
}: F2CustomerListProps) {
  const focusRing =
    accentClass === 'blue'
      ? 'bg-blue-50 border-blue-600'
      : 'bg-emerald-50 border-emerald-600';
  const selectedRing =
    accentClass === 'blue' ? 'bg-blue-50/60 border-blue-300' : 'bg-emerald-50/60 border-emerald-300';
  const itemRefs = useRef<Map<number, HTMLLIElement>>(new Map());

  useEffect(() => {
    if (focusedIndex < 0) return;
    itemRefs.current.get(focusedIndex)?.scrollIntoView({ block: 'nearest' });
  }, [focusedIndex]);

  return (
    <ul className="divide-y divide-slate-100">
      {customers.map((customer, index) => {
        const balanceClass = balanceStyles(customer.balance);
        return (
          <li
            key={customer.id}
            ref={(element) => {
              if (element) itemRefs.current.set(index, element);
              else itemRefs.current.delete(index);
            }}
            onClick={() => onSelect(customer)}
            onMouseEnter={() => onFocusIndex(index)}
            className={`px-3 py-2 cursor-pointer flex items-center justify-between gap-2 transition-colors border-l-2 ${
              focusedIndex === index
                ? focusRing
                : selectedId === customer.id
                  ? selectedRing
                  : 'hover:bg-slate-50 border-transparent'
            }`}
          >
            <div className="min-w-0">
              <p className="text-xs font-medium text-slate-900 truncate">{customer.name}</p>
              <p className="text-caption text-slate-500">{customer.code}</p>
            </div>
            <span className={`text-caption font-semibold shrink-0 ${balanceClass.text}`}>
              {formatMoney(customer.balance)}
            </span>
          </li>
        );
      })}
    </ul>
  );
}
