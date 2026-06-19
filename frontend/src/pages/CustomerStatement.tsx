import { useCallback, useEffect, useRef, useState } from 'react';
import axios from 'axios';
import { Download, FileText, Search } from 'lucide-react';
import CustomerNameLink from '../components/CustomerNameLink';
import {
  API_BASE,
  balanceStyles,
  ensureArray,
  formatDate,
  formatMoney,
  type Customer,
  type PaginatedListResponse,
} from '../lib/api';

type StatementLine = {
  date: string;
  kind: 'invoice' | 'payment';
  description: string;
  debit: number;
  credit: number;
};

function pickCustomerFromSearch(query: string, results: Customer[]): Customer | null {
  const trimmed = query.trim();
  if (!trimmed) return null;

  const codePart = trimmed.split(/[—\-]/)[0].trim().toLocaleLowerCase('tr-TR');
  const exactByCode = results.find(
    (customer) => customer.code.toLocaleLowerCase('tr-TR') === codePart
  );
  if (exactByCode) return exactByCode;

  const lower = trimmed.toLocaleLowerCase('tr-TR');
  return (
    results.find((customer) => customer.name.toLocaleLowerCase('tr-TR') === lower) ?? null
  );
}

export default function CustomerStatement({
  initialCustomerId,
}: {
  initialCustomerId?: number;
} = {}) {
  const [customerId, setCustomerId] = useState<number | ''>(
    initialCustomerId && initialCustomerId > 0 ? initialCustomerId : ''
  );
  const [customerSearch, setCustomerSearch] = useState('');
  const [customerResults, setCustomerResults] = useState<Customer[]>([]);
  const [customerDropdownOpen, setCustomerDropdownOpen] = useState(false);
  const [customerSearchLoading, setCustomerSearchLoading] = useState(false);
  const [focusedIndex, setFocusedIndex] = useState(-1);
  const [lines, setLines] = useState<StatementLine[]>([]);
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [loading, setLoading] = useState(false);

  const customerDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const customerSearchRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  const selectCustomer = useCallback((picked: Customer) => {
    setCustomerId(picked.id);
    setCustomerSearch(`${picked.code} — ${picked.name}`);
    setCustomerDropdownOpen(false);
    setFocusedIndex(-1);
  }, []);

  useEffect(() => {
    if (!initialCustomerId || initialCustomerId <= 0) return;

    let cancelled = false;
    const loadInitial = async () => {
      try {
        const response = await axios.get<{ success: boolean; data: Customer }>(
          `${API_BASE}/api/customers/${initialCustomerId}`
        );
        if (!cancelled && response.data.success) {
          const picked = response.data.data;
          setCustomerId(picked.id);
          setCustomerSearch(`${picked.code} — ${picked.name}`);
        }
      } catch {
        /* müşteri yüklenemedi */
      }
    };

    void loadInitial();
    return () => {
      cancelled = true;
    };
  }, [initialCustomerId]);

  useEffect(() => {
    const query = customerSearch.trim();
    if (!customerDropdownOpen || query.length < 1) {
      setCustomerResults([]);
      setFocusedIndex(-1);
      return;
    }

    if (customerDebounceRef.current) clearTimeout(customerDebounceRef.current);

    customerDebounceRef.current = setTimeout(async () => {
      setCustomerSearchLoading(true);
      try {
        const response = await axios.get<PaginatedListResponse<Customer>>(
          `${API_BASE}/api/customers`,
          { params: { search: query, limit: 25, page: 1 } }
        );
        if (response.data.success) {
          const batch = ensureArray(response.data.data);
          setCustomerResults(batch);
          setFocusedIndex(batch.length > 0 ? 0 : -1);
        }
      } catch {
        setCustomerResults([]);
        setFocusedIndex(-1);
      } finally {
        setCustomerSearchLoading(false);
      }
    }, 250);

    return () => {
      if (customerDebounceRef.current) clearTimeout(customerDebounceRef.current);
    };
  }, [customerSearch, customerDropdownOpen]);

  useEffect(() => {
    if (focusedIndex < 0 || !listRef.current) return;
    const item = listRef.current.children[focusedIndex] as HTMLElement | undefined;
    item?.scrollIntoView({ block: 'nearest' });
  }, [focusedIndex]);

  useEffect(() => {
    if (customerId === '') {
      setCustomer(null);
      setLines([]);
      return;
    }

    setLoading(true);
    axios
      .get<{
        success: boolean;
        data: { customer: Customer; lines: StatementLine[] };
      }>(`${API_BASE}/api/reports/customer-statement`, {
        params: { customerId },
      })
      .then((res) => {
        if (res.data.success) {
          setCustomer(res.data.data.customer);
          setLines(res.data.data.lines);
        }
      })
      .finally(() => setLoading(false));
  }, [customerId]);

  const handleSearchKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      if (!customerDropdownOpen) setCustomerDropdownOpen(true);
      setFocusedIndex((prev) =>
        customerResults.length === 0 ? -1 : Math.min(prev + 1, customerResults.length - 1)
      );
      return;
    }

    if (event.key === 'ArrowUp') {
      event.preventDefault();
      setFocusedIndex((prev) => (prev <= 0 ? 0 : prev - 1));
      return;
    }

    if (event.key === 'Escape') {
      setCustomerDropdownOpen(false);
      setFocusedIndex(-1);
      return;
    }

    if (event.key === 'Enter') {
      event.preventDefault();
      if (focusedIndex >= 0 && customerResults[focusedIndex]) {
        selectCustomer(customerResults[focusedIndex]);
        return;
      }
      const picked = pickCustomerFromSearch(customerSearch, customerResults);
      if (picked) selectCustomer(picked);
    }
  };

  const downloadCsv = () => {
    if (customerId === '') return;
    fetch(`${API_BASE}/api/reports/customer-statement?customerId=${customerId}`, {
      headers: { Accept: 'text/csv' },
    })
      .then((r) => r.blob())
      .then((blob) => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `ekstre-${customer?.code ?? customerId}.csv`;
        a.click();
        URL.revokeObjectURL(url);
      });
  };

  const showDropdown =
    customerDropdownOpen && (customerSearch.trim().length > 0 || customerResults.length > 0);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="rounded-xl bg-blue-600 p-2.5 text-white">
            <FileText className="h-5 w-5" />
          </div>
          <div>
            <h1 className="page-title">Müşteri Ekstre</h1>
            <p className="text-sm text-slate-500">
              Kod veya isim yazarak müşteri bulun · ↑↓ Enter ile seçin
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={downloadCsv}
          disabled={customerId === ''}
          className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium hover:bg-slate-50 disabled:opacity-50"
        >
          <Download className="h-4 w-4" />
          CSV İndir
        </button>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <label className="mb-1 block text-sm font-medium text-slate-700">Müşteri Ara</label>
        <div className="relative max-w-xl">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            ref={customerSearchRef}
            type="text"
            value={customerSearch}
            onChange={(e) => {
              setCustomerSearch(e.target.value);
              setCustomerDropdownOpen(true);
              if (!e.target.value.trim()) {
                setCustomerId('');
              }
            }}
            onFocus={() => setCustomerDropdownOpen(true)}
            onBlur={() => {
              window.setTimeout(() => setCustomerDropdownOpen(false), 150);
            }}
            onKeyDown={handleSearchKeyDown}
            placeholder="Müşteri kodu veya adı yazın..."
            className="w-full rounded-lg border border-slate-300 py-2.5 pl-10 pr-3 text-sm focus:border-blue-500 focus:ring-blue-500"
            autoComplete="off"
            autoFocus
          />
          {showDropdown && (
            <ul
              ref={listRef}
              className="absolute z-20 left-0 right-0 mt-1 max-h-60 overflow-y-auto rounded-lg border border-slate-200 bg-white shadow-lg divide-y divide-slate-100"
            >
              {customerSearchLoading && (
                <li className="px-3 py-2 text-sm text-slate-400">Aranıyor...</li>
              )}
              {!customerSearchLoading &&
                customerResults.map((item, index) => (
                  <li
                    key={item.id}
                    onMouseDown={() => selectCustomer(item)}
                    className={`flex cursor-pointer items-center justify-between gap-2 px-3 py-2.5 text-sm ${
                      index === focusedIndex ? 'bg-blue-50' : 'hover:bg-blue-50/70'
                    }`}
                  >
                    <span>
                      <span className="font-medium text-slate-900">{item.code}</span>
                      <span className="text-slate-500"> — {item.name}</span>
                    </span>
                    <span
                      className={`shrink-0 text-xs font-semibold ${balanceStyles(item.balance).text}`}
                    >
                      {formatMoney(item.balance)}
                    </span>
                  </li>
                ))}
              {!customerSearchLoading && customerSearch.trim() && customerResults.length === 0 && (
                <li className="px-3 py-2 text-sm text-slate-400">Sonuç bulunamadı</li>
              )}
            </ul>
          )}
        </div>
        {customer && (
          <p className="mt-3 text-sm text-slate-600">
            Güncel bakiye:{' '}
            <strong className={balanceStyles(customer.balance).text}>
              {formatMoney(customer.balance)}
            </strong>
            {' · '}
            <CustomerNameLink customerId={customer.id} className="text-sm">
              Müşteri kartını aç
            </CustomerNameLink>
          </p>
        )}
        {!customer && customerId === '' && (
          <p className="mt-2 text-xs text-slate-400">
            Ekstre görmek için listeden bir müşteri seçin.
          </p>
        )}
      </div>

      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        {loading ? (
          <p className="py-12 text-center text-slate-400">Yükleniyor...</p>
        ) : customerId === '' ? (
          <p className="py-12 text-center text-sm text-slate-400">
            Müşteri seçilmedi.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-slate-500">
                    Tarih
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-slate-500">
                    Açıklama
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase text-slate-500">
                    Borç
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase text-slate-500">
                    Alacak
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {lines.map((line, idx) => (
                  <tr key={`${line.date}-${idx}`} className="hover:bg-slate-50/60">
                    <td className="px-4 py-3 text-sm text-slate-600">
                      {formatDate(line.date)}
                    </td>
                    <td className="px-4 py-3 text-sm">{line.description}</td>
                    <td className="px-4 py-3 text-right text-sm text-red-600">
                      {line.debit > 0 ? formatMoney(line.debit) : '—'}
                    </td>
                    <td className="px-4 py-3 text-right text-sm text-emerald-700">
                      {line.credit > 0 ? formatMoney(line.credit) : '—'}
                    </td>
                  </tr>
                ))}
                {lines.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-4 py-10 text-center text-sm text-slate-400">
                      Hareket yok.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
