import { useEffect, useRef } from 'react';
import { balanceStyles, formatMoney, type Customer } from '../lib/api';

type F2CustomerListProps = {
  customers: Customer[];
  focusedIndex: number;
  onFocusIndex: (index: number) => void;
  onSelect: (customer: Customer) => void;
};

export default function F2CustomerList({
  customers,
  focusedIndex,
  onFocusIndex,
  onSelect,
}: F2CustomerListProps) {
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
                ? 'bg-emerald-50 border-emerald-600'
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
