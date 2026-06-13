import {
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
} from 'lucide-react';
import {
  buildVisiblePages,
  getTotalPages,
} from '../lib/api';

type PaginationBarProps = {
  page: number;
  totalCount: number;
  limit: number;
  loading?: boolean;
  onPageChange: (page: number) => void;
  accent?: 'indigo' | 'sky';
};

export default function PaginationBar({
  page,
  totalCount,
  limit,
  loading = false,
  onPageChange,
  accent = 'indigo',
}: PaginationBarProps) {
  const totalPages = getTotalPages(totalCount, limit);
  const rangeStart = totalCount === 0 ? 0 : (page - 1) * limit + 1;
  const rangeEnd = Math.min(page * limit, totalCount);
  const visiblePages = buildVisiblePages(page, totalPages);

  const activeClass =
    accent === 'sky'
      ? 'bg-sky-600 text-white border-sky-600 shadow-md shadow-sky-600/30'
      : 'bg-indigo-600 text-white border-indigo-600 shadow-md shadow-indigo-600/30';

  const btnClass =
    'inline-flex items-center justify-center min-w-[2rem] h-8 px-2 rounded-lg text-xs font-medium border transition-all disabled:opacity-40 disabled:cursor-not-allowed';

  const navBtnClass = `${btnClass} border-slate-200 bg-white text-slate-600 hover:bg-slate-50 hover:border-slate-300`;

  const pageBtnClass = (active: boolean) =>
    active
      ? `${btnClass} ${activeClass} scale-105`
      : `${btnClass} border-slate-200 bg-white text-slate-700 hover:bg-indigo-50 hover:border-indigo-200 hover:text-indigo-700`;

  const goToPage = (target: number) => {
    if (loading || target < 1 || target > totalPages || target === page) return;
    onPageChange(target);
  };

  if (totalCount === 0 && !loading) {
    return (
      <div className="px-5 py-3 border-t border-slate-100 bg-slate-50/50 text-xs text-slate-400 text-center">
        Kayıt bulunamadı.
      </div>
    );
  }

  return (
    <div className="px-4 sm:px-5 py-3 border-t border-slate-100 bg-gradient-to-r from-slate-50/80 via-white to-slate-50/80 flex flex-col sm:flex-row items-center justify-between gap-3">
      <p className="text-xs text-slate-500 order-2 sm:order-1 text-center sm:text-left">
        Toplam{' '}
        <span className="font-semibold text-slate-700">
          {totalCount.toLocaleString('tr-TR')}
        </span>{' '}
        kayıttan{' '}
        <span className="font-semibold text-slate-700">
          {rangeStart.toLocaleString('tr-TR')}–{rangeEnd.toLocaleString('tr-TR')}
        </span>{' '}
        arası gösteriliyor{' '}
        <span className="text-slate-400">
          (Sayfa {page} / {totalPages || 1})
        </span>
      </p>

      <nav
        className="flex items-center gap-1 order-1 sm:order-2"
        aria-label="Sayfa navigasyonu"
      >
        <button
          type="button"
          title="İlk sayfa"
          disabled={page <= 1 || loading}
          onClick={() => goToPage(1)}
          className={navBtnClass}
        >
          <ChevronsLeft className="w-4 h-4" />
        </button>
        <button
          type="button"
          title="Önceki sayfa"
          disabled={page <= 1 || loading}
          onClick={() => goToPage(page - 1)}
          className={navBtnClass}
        >
          <ChevronLeft className="w-4 h-4" />
        </button>

        <div className="flex items-center gap-1 mx-1">
          {visiblePages.map((item, index) =>
            item === 'ellipsis' ? (
              <span
                key={`ellipsis-${index}`}
                className="px-1 text-slate-400 text-xs select-none"
              >
                …
              </span>
            ) : (
              <button
                key={item}
                type="button"
                disabled={loading}
                onClick={() => goToPage(item)}
                className={pageBtnClass(item === page)}
              >
                {item}
              </button>
            )
          )}
        </div>

        <button
          type="button"
          title="Sonraki sayfa"
          disabled={page >= totalPages || loading}
          onClick={() => goToPage(page + 1)}
          className={navBtnClass}
        >
          <ChevronRight className="w-4 h-4" />
        </button>
        <button
          type="button"
          title="Son sayfa"
          disabled={page >= totalPages || loading}
          onClick={() => goToPage(totalPages)}
          className={navBtnClass}
        >
          <ChevronsRight className="w-4 h-4" />
        </button>
      </nav>
    </div>
  );
}
