import type { ReactNode, RefObject } from 'react';
import { X } from 'lucide-react';

type ProductSearchPopoverProps = {
  open: boolean;
  onClose: () => void;
  title?: string;
  hint?: string;
  headerClassName?: string;
  searchQuery: string;
  onSearchChange: (value: string) => void;
  searchInputRef: RefObject<HTMLInputElement | null>;
  onKeyDown: (event: React.KeyboardEvent) => void;
  searchLoading?: boolean;
  children: ReactNode;
  emptyHint?: string;
  showEmpty?: boolean;
};

/** F2 / hızlı ürün arama — sayfayı kapatmaz, sağ üstte kompakt panel */
export default function ProductSearchPopover({
  open,
  onClose,
  title = 'Hızlı Stok Arama',
  hint = '↑↓ · Enter · Esc',
  headerClassName = 'bg-indigo-600',
  searchQuery,
  onSearchChange,
  searchInputRef,
  onKeyDown,
  searchLoading = false,
  children,
  emptyHint = 'Aramaya başlayın veya barkod okutun.',
  showEmpty = true,
}: ProductSearchPopoverProps) {
  if (!open) return null;

  return (
    <div
      className="fixed top-[4.25rem] left-3 right-3 sm:left-auto sm:right-5 z-50 w-auto sm:w-[22rem] md:w-[26rem] rounded-xl border border-slate-200/90 bg-white shadow-xl shadow-slate-900/15 ring-1 ring-slate-900/5 overflow-hidden"
      onKeyDown={onKeyDown}
      role="dialog"
      aria-label={title}
    >
      <div className={`${headerClassName} px-3 py-2 text-white flex items-center justify-between gap-2`}>
        <div className="min-w-0">
          <h3 className="text-sm font-semibold truncate">{title}</h3>
          <p className="text-[10px] opacity-80">{hint} · sayfa açık kalır</p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="shrink-0 p-1 rounded hover:bg-white/15"
          aria-label="Kapat"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="p-2.5 border-b border-slate-100 bg-slate-50/50">
        <input
          ref={searchInputRef}
          type="text"
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="SKU, barkod veya ürün adı..."
          autoComplete="off"
          className="w-full rounded-lg border border-slate-300 bg-white text-sm px-3 py-2 focus:border-indigo-500 focus:ring-indigo-500"
        />
      </div>

      <div className="max-h-[min(40vh,14rem)] overflow-y-auto">
        {searchLoading && (
          <p className="px-3 py-6 text-center text-slate-400 text-xs">Aranıyor...</p>
        )}
        {!searchLoading && children}
        {!searchLoading && showEmpty && !searchQuery && (
          <p className="px-3 py-6 text-center text-slate-400 text-xs">{emptyHint}</p>
        )}
      </div>
    </div>
  );
}
