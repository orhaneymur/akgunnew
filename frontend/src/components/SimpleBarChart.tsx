type BarItem = {
  label: string;
  value: number;
  color?: string;
};

type SimpleBarChartProps = {
  items: BarItem[];
  valueFormatter?: (value: number) => string;
  emptyLabel?: string;
};

export default function SimpleBarChart({
  items,
  valueFormatter = (v) => String(Math.round(v)),
  emptyLabel = 'Veri yok',
}: SimpleBarChartProps) {
  if (items.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-slate-400">{emptyLabel}</p>
    );
  }

  const max = Math.max(...items.map((i) => i.value), 1);

  return (
    <div className="space-y-2">
      {items.map((item) => {
        const widthPct = Math.max((item.value / max) * 100, item.value > 0 ? 4 : 0);
        return (
          <div key={item.label} className="flex items-center gap-3">
            <span
              className="w-20 shrink-0 truncate text-xs text-slate-500 sm:w-24"
              title={item.label}
            >
              {item.label}
            </span>
            <div className="relative h-7 min-w-0 flex-1 rounded-lg bg-slate-100">
              <div
                className={`absolute inset-y-0 left-0 rounded-lg ${item.color ?? 'bg-indigo-500'}`}
                style={{ width: `${widthPct}%` }}
              />
              <span className="relative z-10 flex h-full items-center px-2 text-xs font-semibold text-slate-700">
                {valueFormatter(item.value)}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
