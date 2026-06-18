import { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { Package, PlusCircle, Save } from 'lucide-react';
import { API_BASE, ensureArray, formatUsd, roundPrice } from '../lib/api';
import { useExchangeRates } from '../hooks/useExchangeRates';

type Category = {
  id: number;
  name: string;
};

const APPEARANCE_OPTIONS = [
  { value: 'CITALI', label: 'Çıtalı' },
  { value: 'CITASIZ', label: 'Çıtasız' },
] as const;

const QUALITY_OPTIONS = [
  { value: 'A_KALITE', label: 'A Kalite' },
  { value: 'A_PLUS', label: 'A Plus' },
  { value: 'ORJINAL', label: 'Orjinal' },
  { value: 'REVIZYON_ORJINAL', label: 'Revizyon Orjinal' },
  { value: 'SERVIS_ORJINAL', label: 'Servis Orjinal' },
  { value: 'OLED', label: 'OLED' },
] as const;

type ProductCreateProps = {
  onNotify?: (type: 'success' | 'error', message: string) => void;
};

export default function ProductCreate({ onNotify }: ProductCreateProps) {
  const { rates } = useExchangeRates();
  const [categories, setCategories] = useState<Category[]>([]);
  const [name, setName] = useState('');
  const [categoryId, setCategoryId] = useState<number | ''>('');
  const [brand, setBrand] = useState('');
  const [model, setModel] = useState('');
  const [appearance, setAppearance] = useState('');
  const [quality, setQuality] = useState('');
  const [rbmPrice, setRbmPrice] = useState('');
  const [costPriceUsd, setCostPriceUsd] = useState('');
  const [priceUsd, setPriceUsd] = useState('');
  const [description, setDescription] = useState('');
  const [barcode, setBarcode] = useState('');
  const [initialQuantity, setInitialQuantity] = useState('0');
  const [submitting, setSubmitting] = useState(false);

  const notify = (type: 'success' | 'error', message: string) => {
    onNotify?.(type, message);
  };

  useEffect(() => {
    void axios
      .get<{ success: boolean; data: Category[] }>(`${API_BASE}/api/settings/categories`)
      .then((res) => {
        if (res.data.success) setCategories(ensureArray(res.data.data));
      })
      .catch(() => {
        /* kategoriler opsiyonel */
      });
  }, []);

  const parsedCost = Number(costPriceUsd) || 0;
  const parsedSale = Number(priceUsd) || 0;
  const parsedRbm = Number(rbmPrice) || 0;
  const margin =
    parsedSale > 0 ? ((parsedSale - parsedCost) / parsedSale) * 100 : 0;

  const generatedPreview = useMemo(() => {
    const parts = [brand.trim(), model.trim(), name.trim()].filter(Boolean);
    return parts.join(' ') || name.trim();
  }, [brand, model, name]);

  const resetForm = () => {
    setName('');
    setCategoryId('');
    setBrand('');
    setModel('');
    setAppearance('');
    setQuality('');
    setRbmPrice('');
    setCostPriceUsd('');
    setPriceUsd('');
    setDescription('');
    setBarcode('');
    setInitialQuantity('0');
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!name.trim()) {
      notify('error', 'Stok adı zorunludur.');
      return;
    }

    if (!costPriceUsd || Number.isNaN(parsedCost) || parsedCost < 0) {
      notify('error', 'Geçerli bir alış fiyatı (USD) girin.');
      return;
    }

    if (!priceUsd || Number.isNaN(parsedSale) || parsedSale < 0) {
      notify('error', 'Geçerli bir satış fiyatı (USD) girin.');
      return;
    }

    setSubmitting(true);
    try {
      const response = await axios.post(`${API_BASE}/api/products`, {
        name: generatedPreview || name.trim(),
        costPrice: parsedCost,
        priceUsd: parsedSale,
        priceTl: roundPrice(parsedSale * rates.usd),
        barcode: barcode.trim() || undefined,
        initialQuantity: Number(initialQuantity) || 0,
        categoryId: categoryId !== '' ? Number(categoryId) : undefined,
        brand: brand.trim() || undefined,
        model: model.trim() || undefined,
        appearance: appearance || undefined,
        quality: quality || undefined,
        rbmPrice: parsedRbm,
        description: description.trim() || undefined,
      });

      if (response.data.success) {
        notify(
          'success',
          `Stok kartı oluşturuldu: ${response.data.data?.sku ?? generatedPreview}`
        );
        resetForm();
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

  const fieldClass = 'field-input';
  const labelClass = 'field-label';

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="flex items-center gap-3">
        <div className="rounded-xl bg-indigo-600 p-2.5 text-white">
          <PlusCircle className="h-5 w-5" />
        </div>
        <div>
          <h1 className="page-title">Stok Kartı Oluştur</h1>
          <p className="page-subtitle">
            Ürün tanımı — MERKEZ_DEPO stok kaydı otomatik açılır · SKU otomatik üretilir
          </p>
        </div>
      </div>

      <form
        onSubmit={handleSubmit}
        className="card-section overflow-hidden"
      >
        <div className="grid grid-cols-1 gap-0 lg:grid-cols-2">
          <div className="space-y-4 border-b border-slate-100 p-5 lg:border-b-0 lg:border-r">
            <h2 className="text-sm font-bold uppercase tracking-wide text-indigo-700">
              Ürün Bilgileri
            </h2>

            <div>
              <label className={labelClass}>Stok Adı *</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                className={fieldClass}
                placeholder="iPhone 12 Ekran"
              />
            </div>

            <div>
              <label className={labelClass}>Kategori</label>
              <select
                value={categoryId}
                onChange={(e) =>
                  setCategoryId(e.target.value ? Number(e.target.value) : '')
                }
                className={fieldClass}
              >
                <option value="">Seçin...</option>
                {categories.map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    {cat.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className={labelClass}>Marka</label>
                <input
                  type="text"
                  value={brand}
                  onChange={(e) => setBrand(e.target.value)}
                  className={fieldClass}
                  placeholder="Apple"
                />
              </div>
              <div>
                <label className={labelClass}>Model</label>
                <input
                  type="text"
                  value={model}
                  onChange={(e) => setModel(e.target.value)}
                  className={fieldClass}
                  placeholder="iPhone 12"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className={labelClass}>Görünüm</label>
                <select
                  value={appearance}
                  onChange={(e) => setAppearance(e.target.value)}
                  className={fieldClass}
                >
                  <option value="">Seçin...</option>
                  {APPEARANCE_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className={labelClass}>Kalite</label>
                <select
                  value={quality}
                  onChange={(e) => setQuality(e.target.value)}
                  className={fieldClass}
                >
                  <option value="">Seçin...</option>
                  {QUALITY_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className={labelClass}>Barkod</label>
              <input
                type="text"
                value={barcode}
                onChange={(e) => setBarcode(e.target.value)}
                className={fieldClass}
                placeholder="8690000000000"
              />
            </div>

            <div>
              <label className={labelClass}>Başlangıç Stoğu (MERKEZ_DEPO)</label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={initialQuantity}
                onChange={(e) => setInitialQuantity(e.target.value)}
                className={`${fieldClass} sm:max-w-[10rem]`}
              />
            </div>
          </div>

          <div className="space-y-4 bg-slate-50/60 p-5">
            <h2 className="text-sm font-bold uppercase tracking-wide text-emerald-700">
              Fiyat & Açıklama
            </h2>

            <div>
              <label className={labelClass}>RBM Fiyatı (USD)</label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={rbmPrice}
                onChange={(e) => setRbmPrice(e.target.value)}
                className={fieldClass}
                placeholder="0.00"
              />
            </div>

            <div>
              <label className={labelClass}>Alış Fiyatı (USD) *</label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={costPriceUsd}
                onChange={(e) => setCostPriceUsd(e.target.value)}
                required
                className={fieldClass}
                placeholder="0.00"
              />
            </div>

            <div>
              <label className={labelClass}>Satış Fiyatı (USD) *</label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={priceUsd}
                onChange={(e) => setPriceUsd(e.target.value)}
                required
                className={fieldClass}
                placeholder="0.00"
              />
            </div>

            {parsedCost > 0 && parsedSale > 0 && (
              <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-600">
                <Package className="h-4 w-4 shrink-0 text-indigo-500" />
                <span>
                  Kâr: {formatUsd(parsedSale - parsedCost)} · Marj: {margin.toFixed(1)}%
                </span>
              </div>
            )}

            <div>
              <label className={labelClass}>Açıklama</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={4}
                className={`${fieldClass} resize-none`}
                placeholder="Ürün notları, uyumluluk, tedarikçi bilgisi..."
              />
            </div>

            {generatedPreview && (
              <p className="text-caption text-slate-500">
                Kayıt adı: <span className="font-medium text-slate-700">{generatedPreview}</span>
              </p>
            )}
          </div>
        </div>

        <div className="border-t border-slate-100 bg-white px-5 py-4">
          <button
            type="submit"
            disabled={submitting}
            className="btn btn-secondary"
          >
            <Save className="h-5 w-5" />
            {submitting ? 'Kaydediliyor...' : 'Stok Kartını Kaydet'}
          </button>
        </div>
      </form>
    </div>
  );
}
