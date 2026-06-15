import { Fragment, useCallback, useEffect, useRef, useState } from 'react';
import axios from 'axios';
import {
  ChevronDown,
  ChevronRight,
  Layers,
  Package,
  Pencil,
  Search,
  X,
} from 'lucide-react';
import PaginationBar from '../components/PaginationBar';
import ExcelActions from '../components/ExcelActions';
import {
  API_BASE,
  ensureArray,
  formatMoney,
  getTotalPages,
  LIST_PAGE_SIZE,
  type PaginatedListResponse,
  type Product,
} from '../lib/api';
import { depotLabel } from '../lib/depots';

type StockListProps = {
  onNotify?: (type: 'success' | 'error', message: string) => void;
};

export default function StockList({ onNotify }: StockListProps = {}) {
  const [products, setProducts] = useState<Product[]>([]);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [editing, setEditing] = useState<Product | null>(null);
  const [form, setForm] = useState({
    sku: '',
    name: '',
    barcode: '',
    costPrice: '',
    priceTl: '',
    priceUsd: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const notify = useCallback(
    (type: 'success' | 'error', message: string) => onNotify?.(type, message),
    [onNotify]
  );

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

  const productStocks = (product: Product) => ensureArray(product.stocks);

  const totalStock = (product: Product) =>
    productStocks(product).reduce((sum, s) => sum + s.quantity, 0);

  const totalPages = getTotalPages(totalCount, LIST_PAGE_SIZE);

  const openEdit = (product: Product, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditing(product);
    setForm({
      sku: product.sku,
      name: product.name,
      barcode: product.barcode ?? '',
      costPrice: String(product.costPrice),
      priceTl: String(product.priceTl),
      priceUsd: String(product.priceUsd),
    });
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editing) return;
    setSubmitting(true);
    try {
      await axios.put(`${API_BASE}/api/products/${editing.id}`, {
        sku: form.sku.trim(),
        name: form.name.trim(),
        barcode: form.barcode.trim() || null,
        costPrice: Number(form.costPrice),
        priceTl: Number(form.priceTl),
        priceUsd: Number(form.priceUsd),
      });
      notify('success', 'Ürün güncellendi.');
      setEditing(null);
      await loadProducts(search, page);
    } catch (error) {
      const message =
        axios.isAxiosError(error) && error.response?.data?.message
          ? String(error.response.data.message)
          : 'Güncelleme başarısız.';
      notify('error', message);
    } finally {
      setSubmitting(false);
    }
  };

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
              Düzenlenebilir stok kartları · {LIST_PAGE_SIZE} kayıt / sayfa
              {totalPages > 0 && ` · ${totalPages.toLocaleString('tr-TR')} sayfa`}
            </p>
          </div>
        </div>

        <div className="flex w-full flex-col gap-3 sm:w-auto sm:items-end">
          <ExcelActions
            exportPath="/api/products/export/excel"
            importPath="/api/products/import/excel"
            exportFilename="stoklar.xlsx"
            importTimeoutMs={600_000}
            onImported={() => loadProducts(search, page)}
            onNotify={notify}
            hint="Kategori yoksa otomatik oluşturulur. Büyük dosyalar birkaç dakika sürebilir."
          />
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
                <th className="px-4 py-3 w-12" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {loading && (
                <tr>
                  <td
                    colSpan={8}
                    className="px-4 py-12 text-center text-slate-400 text-sm"
                  >
                    Yükleniyor...
                  </td>
                </tr>
              )}

              {!loading &&
                products.map((product) => {
                  const isExpanded = expandedId === product.id;
                  const stocks = productStocks(product);
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
                          {stocks.length > 1 ? (
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
                            {stocks.length === 0 && (
                              <span className="text-xs text-slate-400">
                                Stok yok
                              </span>
                            )}
                            {stocks
                              .slice(0, isExpanded ? undefined : 2)
                              .map((stock) => (
                                <span
                                  key={stock.id}
                                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium bg-indigo-50 text-indigo-700 ring-1 ring-indigo-100"
                                >
                                  <Layers className="w-3 h-3" />
                                  {depotLabel(stock.branch.name)}: {stock.quantity} adet
                                </span>
                              ))}
                            {!isExpanded && stocks.length > 2 && (
                              <span className="text-xs text-slate-400">
                                +{stocks.length - 2} şube
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <button
                            type="button"
                            onClick={(e) => openEdit(product, e)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-indigo-50"
                            title="Düzenle"
                          >
                            <Pencil className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                      {isExpanded && stocks.length > 0 && (
                        <tr className="bg-slate-50/50">
                          <td colSpan={7} className="px-6 py-4">
                            <p className="text-xs font-semibold text-slate-500 uppercase mb-2">
                              Tüm Şube Stokları — {product.name}
                            </p>
                            <div className="flex flex-wrap gap-2">
                              {stocks.map((stock) => (
                                <span
                                  key={stock.id}
                                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm bg-white border border-slate-200 text-slate-700 shadow-sm"
                                >
                                  <span className="font-medium">
                                    {depotLabel(stock.branch.name)}
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
                    colSpan={8}
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

      {editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-slate-900/60" onClick={() => setEditing(null)} />
          <form
            onSubmit={handleSave}
            className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl"
          >
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
              <h3 className="font-semibold text-slate-900">Ürün Düzenle</h3>
              <button type="button" onClick={() => setEditing(null)}>
                <X className="w-5 h-5 text-slate-400" />
              </button>
            </div>
            <div className="p-5 space-y-3">
              <div>
                <label className="text-xs font-medium text-slate-600">SKU</label>
                <input
                  required
                  value={form.sku}
                  onChange={(e) => setForm((f) => ({ ...f, sku: e.target.value }))}
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-slate-600">Ürün Adı</label>
                <input
                  required
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-slate-600">Barkod</label>
                <input
                  value={form.barcode}
                  onChange={(e) => setForm((f) => ({ ...f, barcode: e.target.value }))}
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                />
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="text-xs font-medium text-slate-600">Maliyet</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={form.costPrice}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, costPrice: e.target.value }))
                    }
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-600">Satış TL</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={form.priceTl}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, priceTl: e.target.value }))
                    }
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-600">Satış USD</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={form.priceUsd}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, priceUsd: e.target.value }))
                    }
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  />
                </div>
              </div>
              <p className="text-xs text-slate-400">
                Stok miktarı depo transferi ve satış/alış/iade ile değişir.
              </p>
            </div>
            <div className="border-t border-slate-100 bg-slate-50 px-5 py-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setEditing(null)}
                className="rounded-lg px-4 py-2 text-sm text-slate-600"
              >
                İptal
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
              >
                {submitting ? 'Kaydediliyor...' : 'Kaydet'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
