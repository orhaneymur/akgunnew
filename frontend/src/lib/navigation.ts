import type { LucideIcon } from 'lucide-react';
import {
  BarChart3,
  FileInput,
  FileText,
  Home,
  Layers,
  Settings,
  ShoppingCart,
  Users,
} from 'lucide-react';
import type { InvoiceType } from './api';

/** Sidebar ve routing — yalnızca canlı ekranlar */
export type PageId =
  | 'dashboard'
  | 'sales'
  | 'sales-return'
  | 'invoice-purchase'
  | 'stock-list'
  | 'product-create'
  | 'barcode-label'
  | 'customer-list'
  | 'customer-payments'
  | 'customer-balance'
  | 'report-sales'
  | 'def-products'
  | 'def-safes'
  | 'def-users'
  | 'invoices';

export type InvoiceFilter = 'ALL' | InvoiceType;

export type NavigateOptions = {
  invoiceFilter?: InvoiceFilter;
};

export type NavigateFn = (page: PageId, options?: NavigateOptions) => void;

export type MenuCategoryId =
  | 'sales'
  | 'purchase'
  | 'stock'
  | 'customer'
  | 'reports'
  | 'definitions'
  | 'invoices';

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

export const menuCategories: MenuCategory[] = [
  {
    id: 'sales',
    label: 'Satış İşlemleri',
    icon: ShoppingCart,
    items: [
      { id: 'sales', label: 'Satış Yap', badge: 'F2' },
      { id: 'sales-return', label: 'Satış İade' },
    ],
  },
  {
    id: 'purchase',
    label: 'Alış İşlemleri',
    icon: FileInput,
    items: [{ id: 'invoice-purchase', label: 'Alış Faturası' }],
  },
  {
    id: 'stock',
    label: 'Stok İşlemleri',
    icon: Layers,
    items: [
      { id: 'stock-list', label: 'Stok Listesi' },
      { id: 'product-create', label: 'Stok Kartı Oluştur' },
      { id: 'barcode-label', label: 'Barkod Etiket' },
    ],
  },
  {
    id: 'customer',
    label: 'Müşteri İşlemleri',
    icon: Users,
    items: [
      { id: 'customer-list', label: 'Müşteri Listesi' },
      { id: 'customer-payments', label: 'Tahsilat / Ödeme' },
      { id: 'customer-balance', label: 'Müşteri Bakiye' },
    ],
  },
  {
    id: 'reports',
    label: 'Raporlar',
    icon: BarChart3,
    items: [{ id: 'report-sales', label: 'Kâr-Zarar Raporu' }],
  },
  {
    id: 'definitions',
    label: 'Tanımlar',
    icon: Settings,
    items: [
      { id: 'def-products', label: 'Ürün Tanımları' },
      { id: 'def-safes', label: 'Kasa Tanımları' },
      { id: 'def-users', label: 'Personel Tanımları' },
    ],
  },
  {
    id: 'invoices',
    label: 'Faturalar',
    icon: FileText,
    items: [{ id: 'invoices', label: 'Fatura Listesi' }],
  },
];

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
