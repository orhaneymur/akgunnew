import { useCallback, useEffect, useRef, useState } from 'react';
import axios from 'axios';
import { Search, Users } from 'lucide-react';
import PaginationBar from '../components/PaginationBar';
import {
  API_BASE,
  balanceStyles,
  formatMoney,
  getTotalPages,
  LIST_PAGE_SIZE,
  type Customer,
  type PaginatedListResponse,
} from '../lib/api';

export default function CustomerList() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const loadCustomers = useCallback(async (query: string, pageNumber: number) => {
    setLoading(true);
    try {
      const params: Record<string, string | number> = {
        page: pageNumber,
        limit: LIST_PAGE_SIZE,
      };
      if (query.trim()) {
        params.search = query.trim();
      }

      const response = await axios.get<PaginatedListResponse<Customer>>(
        `${API_BASE}/api/customers`,
        { params }
      );

      if (response.data.success) {
        setCustomers(response.data.data);
        setTotalCount(response.data.totalCount);
        setPage(response.data.page);
      }
    } catch {
      setCustomers([]);
      setTotalCount(0);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    setPage(1);
  }, [search]);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);

    debounceRef.current = setTimeout(() => {
      loadCustomers(search, page);
    }, 300);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [search, page, loadCustomers]);

  const totalPages = getTotalPages(totalCount, LIST_PAGE_SIZE);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-sky-600 text-white">
            <Users className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900">Müşteri Listesi</h1>
            <p className="text-sm text-slate-500">
              Gelişmiş sayfalama — {LIST_PAGE_SIZE} kayıt / sayfa
              {totalPages > 0 && ` · ${totalPages.toLocaleString('tr-TR')} sayfa`}
            </p>
          </div>
        </div>

        <div className="relative w-full sm:w-80">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="İsim veya kod ile ara..."
            className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 bg-white text-sm focus:border-sky-500 focus:ring-sky-500 shadow-sm"
          />
        </div>
      </div>

      <section className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
          <h2 className="font-semibold text-slate-800">Kayıtlı Müşteriler</h2>
          <span className="text-xs text-slate-400">
            {loading ? 'Yükleniyor...' : `${totalCount.toLocaleString('tr-TR')} kayıt`}
          </span>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-100">
            <thead className="bg-slate-50/80">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase">
                  Kod
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase">
                  Ünvan
                </th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-slate-500 uppercase">
                  Kredi Limiti
                </th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-slate-500 uppercase">
                  Bakiye
                </th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-slate-500 uppercase">
                  Durum
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {loading && (
                <tr>
                  <td
                    colSpan={5}
                    className="px-4 py-12 text-center text-slate-400 text-sm"
                  >
                    Yükleniyor...
                  </td>
                </tr>
              )}
              {!loading &&
                customers.map((customer) => {
                  const styles = balanceStyles(customer.balance);
                  return (
                    <tr
                      key={customer.id}
                      className={`hover:bg-slate-50/60 ${
                        customer.balance > 0 ? 'bg-red-50/30' : ''
                      }`}
                    >
                      <td className="px-4 py-3 text-sm font-semibold text-slate-900">
                        {customer.code}
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-800">
                        {customer.name}
                      </td>
                      <td className="px-4 py-3 text-sm text-right text-slate-600">
                        {formatMoney(customer.creditLimit)}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span
                          className={`inline-flex px-2.5 py-1 rounded-lg text-sm font-semibold ring-1 ring-inset ${styles.bg} ${styles.text}`}
                        >
                          {formatMoney(customer.balance)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span
                          className={`inline-flex px-2 py-0.5 rounded-md text-xs font-medium ${styles.bg} ${styles.text}`}
                        >
                          {styles.label}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              {!loading && customers.length === 0 && (
                <tr>
                  <td
                    colSpan={5}
                    className="px-4 py-12 text-center text-slate-400 text-sm"
                  >
                    Aramanıza uygun müşteri bulunamadı.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <PaginationBar
          page={page}
          totalCount={totalCount}
          limit={LIST_PAGE_SIZE}
          loading={loading}
          onPageChange={setPage}
          accent="sky"
        />
      </section>
    </div>
  );
}
