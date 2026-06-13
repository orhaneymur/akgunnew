import { useState } from 'react';
import axios from 'axios';
import { Package, PlusCircle, Save } from 'lucide-react';
import { API_BASE, formatMoney } from '../lib/api';

type ProductCreateProps = {
  onNotify?: (type: 'success' | 'error', message: string) => void;
};

export default function ProductCreate({ onNotify }: ProductCreateProps) {
  const [sku, setSku] = useState('');
  const [name, setName] = useState('');
  const [barcode, setBarcode] = useState('');
  const [costPrice, setCostPrice] = useState('');
  const [priceTl, setPriceTl] = useState('');
  const [initialQuantity, setInitialQuantity] = useState('0');
  const [submitting, setSubmitting] = useState(false);

  const notify = (type: 'success' | 'error', message: string) => {
    onNotify?.(type, message);
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    const parsedCost = Number(costPrice);
    const parsedPrice = Number(priceTl);
    const parsedQty = Number(initialQuantity);

    if (!sku.trim() || !name.trim()) {
      notify('error', 'SKU ve ürün adı zorunludur.');
      return;
    }

    if (!costPrice || Number.isNaN(parsedCost) || parsedCost < 0) {
      notify('error', 'Geçerli bir alış maliyeti girin.');
      return;
    }

    if (!priceTl || Number.isNaN(parsedPrice) || parsedPrice < 0) {
      notify('error', 'Geçerli bir satış fiyatı girin.');
      return;
    }

    setSubmitting(true);
    try {
      const response = await axios.post(`${API_BASE}/api/products`, {
        sku: sku.trim(),
        name: name.trim(),
        barcode: barcode.trim() || undefined,
        costPrice: parsedCost,
        priceTl: parsedPrice,
        initialQuantity: Number.isNaN(parsedQty) ? 0 : parsedQty,
      });

      if (response.data.success) {
        notify('success', `Stok kartı oluşturuldu: ${response.data.data?.sku ?? sku}`);
        setSku('');
        setName('');
        setBarcode('');
        setCostPrice('');
        setPriceTl('');
        setInitialQuantity('0');
      }
    } catch (error) {
      const message =
        axios.isAxiosError(error) && error.response?.data?.message
          ? String(error.response.data.message)
          : 'Stok kartı oluşturulamadı.';
      notify('error', message);
    } finally {
      setSubmitting(false);
    }
  };

  const parsedCost = Number(costPrice) || 0;
  const parsedPrice = Number(priceTl) || 0;
  const margin =
    parsedPrice > 0 ? ((parsedPrice - parsedCost) / parsedPrice) * 100 : 0;

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="flex items-center gap-3">
        <div className="p-2.5 rounded-xl bg-indigo-600 text-white">
          <PlusCircle className="w-5 h-5" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-slate-900">Stok Kartı Oluştur</h1>
          <p className="text-sm text-slate-500">
            Yeni ürün tanımı — MERKEZ_DEPO stok kaydı otomatik açılır
          </p>
        </div>
      </div>

      <form
        onSubmit={handleSubmit}
        className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-5"
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Stok Kodu (SKU) <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={sku}
              onChange={(e) => setSku(e.target.value.toUpperCase())}
              required
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:ring-indigo-500"
              placeholder="IPH12-EKRAN"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Barkod
            </label>
            <input
              type="text"
              value={barcode}
              onChange={(e) => setBarcode(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:ring-indigo-500"
              placeholder="8690000000000"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            Ürün Adı <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:ring-indigo-500"
            placeholder="APPLE İPHONE 12 EKRAN"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Alış Maliyeti (TL) <span className="text-red-500">*</span>
            </label>
            <input
              type="number"
              min="0"
              step="0.01"
              value={costPrice}
              onChange={(e) => setCostPrice(e.target.value)}
              required
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:ring-indigo-500"
              placeholder="0.00"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Satış Fiyatı (TL) <span className="text-red-500">*</span>
            </label>
            <input
              type="number"
              min="0"
              step="0.01"
              value={priceTl}
              onChange={(e) => setPriceTl(e.target.value)}
              required
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:ring-indigo-500"
              placeholder="0.00"
            />
          </div>
        </div>

        {parsedCost > 0 && parsedPrice > 0 && (
          <div className="rounded-lg bg-slate-50 border border-slate-200 px-4 py-3 text-sm text-slate-600 flex items-center gap-2">
            <Package className="w-4 h-4 text-indigo-500" />
            <span>
              Birim kâr: {formatMoney(parsedPrice - parsedCost)} · Marj:{' '}
              {margin.toFixed(1)}%
            </span>
          </div>
        )}

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            Başlangıç Stoğu (MERKEZ_DEPO)
          </label>
          <input
            type="number"
            min="0"
            step="0.01"
            value={initialQuantity}
            onChange={(e) => setInitialQuantity(e.target.value)}
            className="w-full sm:w-48 rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:ring-indigo-500"
          />
        </div>

        <button
          type="submit"
          disabled={submitting}
          className="flex items-center justify-center gap-2 w-full sm:w-auto bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-400 text-white font-semibold px-6 py-3 rounded-xl transition-colors"
        >
          <Save className="w-5 h-5" />
          {submitting ? 'Kaydediliyor...' : 'Stok Kartını Kaydet'}
        </button>
      </form>
    </div>
  );
}
