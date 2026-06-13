import type { LucideIcon } from 'lucide-react';
import { Construction } from 'lucide-react';

const accentMap = {
  indigo: {
    icon: 'bg-indigo-50 text-indigo-600',
    ring: 'ring-indigo-100',
    badge: 'bg-indigo-50 text-indigo-700',
  },
  emerald: {
    icon: 'bg-emerald-50 text-emerald-600',
    ring: 'ring-emerald-100',
    badge: 'bg-emerald-50 text-emerald-700',
  },
  sky: {
    icon: 'bg-sky-50 text-sky-600',
    ring: 'ring-sky-100',
    badge: 'bg-sky-50 text-sky-700',
  },
  violet: {
    icon: 'bg-violet-50 text-violet-600',
    ring: 'ring-violet-100',
    badge: 'bg-violet-50 text-violet-700',
  },
  amber: {
    icon: 'bg-amber-50 text-amber-600',
    ring: 'ring-amber-100',
    badge: 'bg-amber-50 text-amber-700',
  },
  rose: {
    icon: 'bg-rose-50 text-rose-600',
    ring: 'ring-rose-100',
    badge: 'bg-rose-50 text-rose-700',
  },
  slate: {
    icon: 'bg-slate-100 text-slate-600',
    ring: 'ring-slate-200',
    badge: 'bg-slate-100 text-slate-700',
  },
};

type PageShellProps = {
  title: string;
  description: string;
  icon: LucideIcon;
  accent?: keyof typeof accentMap;
  columns: string[];
};

export default function PageShell({
  title,
  description,
  icon: Icon,
  accent = 'indigo',
  columns,
}: PageShellProps) {
  const colors = accentMap[accent];

  return (
    <div className="space-y-6">
      <div className="flex items-start gap-4">
        <div className={`p-3 rounded-2xl ${colors.icon}`}>
          <Icon className="w-6 h-6" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-slate-900">{title}</h1>
          <p className="text-sm text-slate-500 mt-0.5">{description}</p>
        </div>
      </div>

      <div
        className={`flex items-center gap-3 rounded-xl border border-dashed ${colors.ring} bg-white px-4 py-3 text-sm text-slate-600`}
      >
        <Construction className="w-4 h-4 text-slate-400 shrink-0" />
        <span>
          Bu modül geliştirme aşamasında. Tablo yapısı hazır, veri bağlantısı
          yakında eklenecek.
        </span>
        <span
          className={`ml-auto shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium ${colors.badge}`}
        >
          Yakında
        </span>
      </div>

      <section className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
          <h2 className="font-semibold text-slate-800">Kayıt Listesi</h2>
          <span className="text-xs text-slate-400">0 kayıt</span>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-100">
            <thead className="bg-slate-50/80">
              <tr>
                {columns.map((col) => (
                  <th
                    key={col}
                    className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide"
                  >
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr>
                <td
                  colSpan={columns.length}
                  className="px-4 py-16 text-center text-slate-400 text-sm"
                >
                  Henüz kayıt bulunmuyor.
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
