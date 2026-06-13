import { Fragment, useCallback, useEffect, useRef, useState } from 'react';
import axios from 'axios';
import {
  ChevronDown,
  ChevronRight,
  Layers,
  Package,
  Search,
} from 'lucide-react';
import PaginationBar from '../components/PaginationBar';
import {
  API_BASE,
  formatMoney,
  getTotalPages,
  LIST_PAGE_SIZE,
  type PaginatedListResponse,
  type Product,
} from '../lib/api';

export default function StockList() {
  const [products, setProducts] = useState<Product[]>([]);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const loadProducts = useCallback(async (query: string, pageNumber: number) => {
    setLoading(true);
    try {
      const params: Record<string, string | number> = {
        page: pageNumber,
        limit: LIST_PAGE_SIZE,
      };
      if (query.trim()) {
        params.search = query.trim();
      }

      const response = await axios.get<PaginatedListResponse<Product>>(
        `${API_BASE}/api/products`,
        { params }
      );

      if (response.data.success) {
        setProducts(response.data.data);
        setTotalCount(response.data.totalCount);
        setPage(response.data.page);
      }
    } catch {
      setProducts([]);
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
      loadProducts(search, page);
    }, 300);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [search, page, loadProducts]);

  const totalStock = (product: Product) =>
    product.stocks.reduce((sum, s) => sum + s.quantity, 0);

  const totalPages = getTotalPages(totalCount, LIST_PAGE_SIZE);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-indigo-600 text-white">
            <Package className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900">Stok Listesi</h1>
            <p className="text-sm text-slate-500">
              Gelişmiş sayfalama — {LIST_PAGE_SIZE} kayıt / sayfa
              {totalPages > 0 && ` · ${totalPages.toLocaleString('tr-TR')} sayfa`}
            </p>
          </div>
        </div>

        <div className="relative w-full sm:w-96">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Ürün adı, SKU veya barkod..."
            className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 bg-white text-sm focus:border-indigo-500 focus:ring-indigo-500 shadow-sm"
          />
        </div>
      </div>

      <section className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
          <h2 className="font-semibold text-slate-800">Ürün Stokları</h2>
          <span className="text-xs text-slate-400">
            {loading ? 'Yükleniyor...' : `${totalCount.toLocaleString('tr-TR')} ürün`}
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-100">
            <thead className="bg-slate-50/80">
              <tr>
                <th className="w-10 px-3 py-3" />
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase">
                  SKU
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase">
                  Ürün Adı
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase">
                  Barkod
                </th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-slate-500 uppercase">
                  Fiyat
                </th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-slate-500 uppercase">
                  Toplam Stok
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase">
                  Şube / Depo
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {loading && (
                <tr>
                  <td
                    colSpan={7}
                    className="px-4 py-12 text-center text-slate-400 text-sm"
                  >
                    Yükleniyor...
                  </td>
                </tr>
              )}

              {!loading &&
                products.map((product) => {
                  const isExpanded = expandedId === product.id;
                  const stockTotal = totalStock(product);

                  return (
                    <Fragment key={product.id}>
                      <tr
                        className="hover:bg-slate-50/60 cursor-pointer"
                        onClick={() =>
                          setExpandedId(isExpanded ? null : product.id)
                        }
                      >
                        <td className="px-3 py-3 text-slate-400">
                          {product.stocks.length > 1 ? (
                            isExpanded ? (
                              <ChevronDown className="w-4 h-4" />
                            ) : (
                              <ChevronRight className="w-4 h-4" />
                            )
                          ) : null}
                        </td>
                        <td className="px-4 py-3 text-sm font-semibold text-slate-900">
                          {product.sku}
                        </td>
                        <td className="px-4 py-3 text-sm text-slate-800 max-w-[220px] truncate">
                          {product.name}
                        </td>
                        <td className="px-4 py-3 text-sm text-slate-500 font-mono">
                          {product.barcode ?? '—'}
                        </td>
                        <td className="px-4 py-3 text-sm text-right text-slate-700">
                          {formatMoney(product.priceTl)}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <span
                            className={`inline-flex px-2.5 py-1 rounded-lg text-sm font-semibold ring-1 ring-inset ${
                              stockTotal <= 10
                                ? 'bg-amber-50 text-amber-700 ring-amber-200'
                                : 'bg-emerald-50 text-emerald-700 ring-emerald-200'
                            }`}
                          >
                            {stockTotal} adet
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex flex-wrap gap-1.5">
                            {product.stocks.length === 0 && (
                              <span className="text-xs text-slate-400">
                                Stok yok
                              </span>
                            )}
                            {product.stocks
                              .slice(0, isExpanded ? undefined : 2)
                              .map((stock) => (
                                <span
                                  key={stock.id}
                                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium bg-indigo-50 text-indigo-700 ring-1 ring-indigo-100"
                                >
                                  <Layers className="w-3 h-3" />
                                  {stock.branch.name}: {stock.quantity} adet
                                </span>
                              ))}
                            {!isExpanded && product.stocks.length > 2 && (
                              <span className="text-xs text-slate-400">
                                +{product.stocks.length - 2} şube
                              </span>
                            )}
                          </div>
                        </td>
                      </tr>
                      {isExpanded && product.stocks.length > 0 && (
                        <tr className="bg-slate-50/50">
                          <td colSpan={7} className="px-6 py-4">
                            <p className="text-xs font-semibold text-slate-500 uppercase mb-2">
                              Tüm Şube Stokları — {product.name}
                            </p>
                            <div className="flex flex-wrap gap-2">
                              {product.stocks.map((stock) => (
                                <span
                                  key={stock.id}
                                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm bg-white border border-slate-200 text-slate-700 shadow-sm"
                                >
                                  <span className="font-medium">
                                    {stock.branch.name}
                                  </span>
                                  <span className="text-indigo-600 font-semibold">
                                    {stock.quantity} adet
                                  </span>
                                  <span className="text-[10px] text-slate-400 uppercase">
                                    {stock.branch.type}
                                  </span>
                                </span>
                              ))}
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}

              {!loading && products.length === 0 && (
                <tr>
                  <td
                    colSpan={7}
                    className="px-4 py-12 text-center text-slate-400 text-sm"
                  >
                    Aramanıza uygun ürün bulunamadı.
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
          accent="indigo"
        />
      </section>
    </div>
  );
}
