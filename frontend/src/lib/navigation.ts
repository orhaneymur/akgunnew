import type { LucideIcon } from 'lucide-react';
import {
  ArrowLeftRight,
  BarChart3,
  Barcode,
  Building2,
  ClipboardList,
  Coins,
  FileInput,
  FileOutput,
  FileText,
  Home,
  Layers,
  Package,
  RotateCcw,
  Settings,
  ShoppingCart,
  Truck,
  UserCog,
  Users,
  Wallet,
  Warehouse,
} from 'lucide-react';

export type PageId =
  | 'dashboard'
  | 'sales'
  | 'sales-list'
  | 'sales-return'
  | 'quotes'
  | 'stock-list'
  | 'stock-movements'
  | 'stock-count'
  | 'barcode-label'
  | 'customer-list'
  | 'customer-statement'
  | 'customer-payments'
  | 'customer-balance'
  | 'report-sales'
  | 'report-stock'
  | 'report-cash'
  | 'report-staff'
  | 'reports'
  | 'def-products'
  | 'def-branches'
  | 'def-safes'
  | 'def-users'
  | 'def-rates'
  | 'invoices'
  | 'invoice-purchase'
  | 'invoice-sales'
  | 'invoice-return'
  | 'warehouse-list'
  | 'warehouse-transfer'
  | 'warehouse-stock'
  | 'product-create'
  | 'purchase-list';

export type MenuCategoryId =
  | 'sales'
  | 'stock'
  | 'customer'
  | 'reports'
  | 'definitions'
  | 'invoices'
  | 'warehouse';

export type MenuItem = {
  id: PageId;
  label: string;
  badge?: string;
};

export type MenuCategory = {
  id: MenuCategoryId;
  label: string;
  icon: LucideIcon;
  items: MenuItem[];
};

export type PageShellConfig = {
  title: string;
  description: string;
  icon: LucideIcon;
  accent: 'indigo' | 'emerald' | 'sky' | 'violet' | 'amber' | 'rose' | 'slate';
  columns: string[];
};

export const menuCategories: MenuCategory[] = [
  {
    id: 'sales',
    label: 'Satış İşlemleri',
    icon: ShoppingCart,
    items: [
      { id: 'sales', label: 'Satış Yap', badge: 'F2' },
      { id: 'sales-list', label: 'Satış Listesi' },
      { id: 'sales-return', label: 'Satış İade' },
      { id: 'quotes', label: 'Teklifler' },
    ],
  },
  {
    id: 'stock',
    label: 'Stok İşlemleri',
    icon: Layers,
    items: [
      { id: 'stock-list', label: 'Stok Listesi' },
      { id: 'stock-movements', label: 'Stok Hareketleri' },
      { id: 'stock-count', label: 'Stok Sayım' },
      { id: 'barcode-label', label: 'Barkod Etiket' },
    ],
  },
  {
    id: 'customer',
    label: 'Müşteri İşlemleri',
    icon: Users,
    items: [
      { id: 'customer-list', label: 'Müşteri Listesi' },
      { id: 'customer-statement', label: 'Cari Ekstre' },
      { id: 'customer-payments', label: 'Tahsilat / Ödeme' },
      { id: 'customer-balance', label: 'Müşteri Bakiye' },
    ],
  },
  {
    id: 'reports',
    label: 'Raporlar',
    icon: BarChart3,
    items: [
      { id: 'report-sales', label: 'Satış Raporu' },
      { id: 'report-stock', label: 'Stok Raporu' },
      { id: 'report-cash', label: 'Kasa Raporu' },
      { id: 'report-staff', label: 'Personel Ciro' },
      { id: 'reports', label: 'Genel Raporlar' },
    ],
  },
  {
    id: 'definitions',
    label: 'Tanımlama İşlemleri',
    icon: Settings,
    items: [
      { id: 'def-products', label: 'Ürün Tanımları' },
      { id: 'def-branches', label: 'Şube Tanımları' },
      { id: 'def-safes', label: 'Kasa Tanımları' },
      { id: 'def-users', label: 'Personel Tanımları' },
      { id: 'def-rates', label: 'Döviz Kurları' },
    ],
  },
  {
    id: 'invoices',
    label: 'Fatura İşlemleri',
    icon: FileText,
    items: [
      { id: 'invoices', label: 'Fatura Listesi' },
      { id: 'invoice-purchase', label: 'Alış Faturası' },
      { id: 'invoice-sales', label: 'Satış Faturası' },
      { id: 'invoice-return', label: 'İade Faturası' },
    ],
  },
  {
    id: 'warehouse',
    label: 'Depo İşlemleri',
    icon: Warehouse,
    items: [
      { id: 'warehouse-list', label: 'Depo Listesi' },
      { id: 'warehouse-transfer', label: 'Depo Transfer' },
      { id: 'warehouse-stock', label: 'Şube Stok Durumu' },
    ],
  },
];

export const pageShellConfigs: Record<
  Exclude<PageId, 'dashboard' | 'sales' | 'invoices' | 'product-create' | 'sales-return' | 'sales-list' | 'purchase-list'>,
  PageShellConfig
> = {
  quotes: {
    title: 'Teklifler',
    description: 'Müşteri teklifleri ve proforma işlemleri',
    icon: ClipboardList,
    accent: 'sky',
    columns: ['Teklif No', 'Müşteri', 'Tutar', 'Geçerlilik', 'Durum'],
  },
  'stock-list': {
    title: 'Stok Listesi',
    description: 'Tüm ürün kartları, barkod ve stok miktarları',
    icon: Package,
    accent: 'indigo',
    columns: ['SKU', 'Ürün Adı', 'Şube', 'Miktar', 'Fiyat'],
  },
  'stock-movements': {
    title: 'Stok Hareketleri',
    description: 'Giriş, çıkış ve transfer hareketleri',
    icon: ArrowLeftRight,
    accent: 'violet',
    columns: ['Tarih', 'Ürün', 'Hareket', 'Miktar', 'Referans'],
  },
  'stock-count': {
    title: 'Stok Sayım',
    description: 'Depo sayım fişleri ve fark analizi',
    icon: Layers,
    accent: 'slate',
    columns: ['Sayım No', 'Şube', 'Ürün', 'Sistem', 'Sayım'],
  },
  'barcode-label': {
    title: 'Barkod Etiket',
    description: 'Barkod yazdırma ve etiket şablonları',
    icon: Barcode,
    accent: 'indigo',
    columns: ['SKU', 'Ürün', 'Barkod', 'Adet', 'Şablon'],
  },
  'customer-list': {
    title: 'Müşteri Listesi',
    description: 'Cari hesap kartları ve iletişim bilgileri',
    icon: Users,
    accent: 'sky',
    columns: ['Kod', 'Ünvan', 'Telefon', 'Limit', 'Bakiye'],
  },
  'customer-statement': {
    title: 'Cari Ekstre',
    description: 'Müşteri hesap hareketleri ve ekstre görünümü',
    icon: FileText,
    accent: 'indigo',
    columns: ['Tarih', 'Açıklama', 'Borç', 'Alacak', 'Bakiye'],
  },
  'customer-payments': {
    title: 'Tahsilat / Ödeme',
    description: 'Cari tahsilat ve ödeme kayıtları',
    icon: Wallet,
    accent: 'emerald',
    columns: ['Tarih', 'Müşteri', 'Kasa', 'Tutar', 'Tip'],
  },
  'customer-balance': {
    title: 'Müşteri Bakiye',
    description: 'Borçlu ve alacaklı müşteri özet tablosu',
    icon: Coins,
    accent: 'rose',
    columns: ['Kod', 'Müşteri', 'Borç', 'Alacak', 'Net'],
  },
  'report-sales': {
    title: 'Satış Raporu',
    description: 'Dönemsel satış analizi ve kırılımlar',
    icon: BarChart3,
    accent: 'emerald',
    columns: ['Dönem', 'Satış Adedi', 'Ciro', 'Ort. Sepet', 'Trend'],
  },
  'report-stock': {
    title: 'Stok Raporu',
    description: 'Stok değeri, kritik seviye ve hareket özeti',
    icon: Package,
    accent: 'violet',
    columns: ['Ürün', 'Miktar', 'Değer', 'Min. Stok', 'Durum'],
  },
  'report-cash': {
    title: 'Kasa Raporu',
    description: 'Kasa giriş-çıkış ve bakiye raporu',
    icon: Wallet,
    accent: 'sky',
    columns: ['Kasa', 'Giriş', 'Çıkış', 'Bakiye', 'Para Birimi'],
  },
  'report-staff': {
    title: 'Personel Ciro',
    description: 'Personel bazında günlük, aylık ve yıllık ciro',
    icon: UserCog,
    accent: 'indigo',
    columns: ['Personel', 'Günlük', 'Aylık', 'Yıllık', 'Pay'],
  },
  reports: {
    title: 'Genel Raporlar',
    description: 'Tüm rapor modüllerine merkezi erişim',
    icon: BarChart3,
    accent: 'slate',
    columns: ['Rapor', 'Kategori', 'Son Çalıştırma', 'Format', 'Durum'],
  },
  'def-products': {
    title: 'Ürün Tanımları',
    description: 'Stok kartı, fiyat ve barkod tanımları',
    icon: Package,
    accent: 'indigo',
    columns: ['SKU', 'Ürün Adı', 'Fiyat TL', 'Fiyat USD', 'Durum'],
  },
  'def-branches': {
    title: 'Şube Tanımları',
    description: 'Mağaza ve depo şube kayıtları',
    icon: Building2,
    accent: 'violet',
    columns: ['Kod', 'Şube Adı', 'Tip', 'Adres', 'Durum'],
  },
  'def-safes': {
    title: 'Kasa Tanımları',
    description: 'TL, USD ve EUR kasa hesapları',
    icon: Wallet,
    accent: 'emerald',
    columns: ['Kasa Adı', 'Şube', 'Para Birimi', 'Bakiye', 'Durum'],
  },
  'def-users': {
    title: 'Personel Tanımları',
    description: 'Kullanıcı hesapları ve yetki rolleri',
    icon: UserCog,
    accent: 'sky',
    columns: ['Ad Soyad', 'E-posta', 'Rol', 'Şube', 'Durum'],
  },
  'def-rates': {
    title: 'Döviz Kurları',
    description: 'Günlük kur tanımları ve geçmiş',
    icon: Coins,
    accent: 'amber',
    columns: ['Tarih', 'USD', 'EUR', 'Kaynak', 'Güncelleyen'],
  },
  'invoice-purchase': {
    title: 'Alış Faturası',
    description: 'Tedarikçiden alış faturası girişi',
    icon: FileInput,
    accent: 'rose',
    columns: ['Fatura No', 'Tedarikçi', 'Tutar', 'Vade', 'Durum'],
  },
  'invoice-sales': {
    title: 'Satış Faturası',
    description: 'Manuel satış faturası oluşturma',
    icon: FileOutput,
    accent: 'emerald',
    columns: ['Fatura No', 'Müşteri', 'Tutar', 'Ödeme', 'Durum'],
  },
  'invoice-return': {
    title: 'İade Faturası',
    description: 'Satış iade faturası işlemleri',
    icon: RotateCcw,
    accent: 'amber',
    columns: ['İade No', 'Referans', 'Müşteri', 'Tutar', 'Tarih'],
  },
  'warehouse-list': {
    title: 'Depo Listesi',
    description: 'Depo ve ambar tanımları',
    icon: Warehouse,
    accent: 'violet',
    columns: ['Depo Kodu', 'Depo Adı', 'Şube', 'Sorumlu', 'Durum'],
  },
  'warehouse-transfer': {
    title: 'Depo Transfer',
    description: 'Şubeler arası stok transfer fişleri',
    icon: Truck,
    accent: 'indigo',
    columns: ['Transfer No', 'Kaynak', 'Hedef', 'Ürün', 'Miktar'],
  },
  'warehouse-stock': {
    title: 'Şube Stok Durumu',
    description: 'Şube bazında anlık stok görünümü',
    icon: Layers,
    accent: 'sky',
    columns: ['Şube', 'Ürün', 'Miktar', 'Rezerve', 'Kullanılabilir'],
  },
};

export function getCategoryForPage(pageId: PageId): MenuCategoryId | null {
  for (const category of menuCategories) {
    if (category.items.some((item) => item.id === pageId)) {
      return category.id;
    }
  }
  return null;
}

export const dashboardItem = {
  id: 'dashboard' as const,
  label: 'Ana Sayfa',
  icon: Home,
};
