import { ChevronDown, Keyboard, LogOut, Zap } from 'lucide-react';
import type { MenuCategoryId, PageId } from '../lib/navigation';
import { dashboardItem, menuCategories } from '../lib/navigation';

type SidebarProps = {
  activePage: PageId;
  openMenus: Record<MenuCategoryId, boolean>;
  onToggleMenu: (id: MenuCategoryId) => void;
  onNavigate: (page: PageId) => void;
  onLogout: () => void;
};

export default function Sidebar({
  activePage,
  openMenus,
  onToggleMenu,
  onNavigate,
  onLogout,
}: SidebarProps) {
  const DashboardIcon = dashboardItem.icon;

  const isItemActive = (pageId: PageId) => activePage === pageId;

  const isCategoryActive = (categoryId: MenuCategoryId) =>
    menuCategories
      .find((c) => c.id === categoryId)
      ?.items.some((item) => item.id === activePage) ?? false;

  return (
    <aside className="w-64 bg-slate-900 text-slate-200 flex flex-col shrink-0 shadow-xl">
      <div className="px-5 py-5 border-b border-slate-800/80">
        <div className="flex items-center gap-2.5">
          <div className="p-1.5 rounded-lg bg-indigo-500/90 text-white">
            <Zap className="w-5 h-5" />
          </div>
          <div>
            <h1 className="font-bold text-base tracking-wide text-white">
              Akgün Teknik
            </h1>
            <p className="text-[11px] text-slate-400">ERP Yönetim Paneli</p>
          </div>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto px-2 py-3 space-y-1 scrollbar-thin">
        <button
          type="button"
          onClick={() => onNavigate('dashboard')}
          className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all mb-2 ${
            isItemActive('dashboard')
              ? 'bg-indigo-500/20 text-indigo-200 ring-1 ring-indigo-400/30'
              : 'text-slate-300 hover:bg-slate-800/70 hover:text-white'
          }`}
        >
          <DashboardIcon className="w-4 h-4 shrink-0 text-indigo-300" />
          <span>{dashboardItem.label}</span>
        </button>

        {menuCategories.map((category) => {
          const CategoryIcon = category.icon;
          const isOpen = openMenus[category.id];
          const categoryActive = isCategoryActive(category.id);

          return (
            <div key={category.id} className="mb-0.5">
              <button
                type="button"
                onClick={() => onToggleMenu(category.id)}
                className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                  categoryActive
                    ? 'bg-slate-800/80 text-white'
                    : 'text-slate-400 hover:bg-slate-800/50 hover:text-slate-200'
                }`}
              >
                <CategoryIcon
                  className={`w-4 h-4 shrink-0 ${
                    categoryActive ? 'text-indigo-300' : 'text-slate-500'
                  }`}
                />
                <span className="flex-1 text-left text-[13px]">{category.label}</span>
                <ChevronDown
                  className={`w-4 h-4 shrink-0 text-slate-500 transition-transform duration-300 ${
                    isOpen ? 'rotate-180' : ''
                  }`}
                />
              </button>

              <div
                className={`grid transition-[grid-template-rows] duration-300 ease-in-out ${
                  isOpen ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'
                }`}
              >
                <div className="overflow-hidden">
                  <div className="pl-2 pr-1 py-1 space-y-0.5">
                    {category.items.map((item) => {
                      const active = isItemActive(item.id);
                      return (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => onNavigate(item.id)}
                          className={`w-full flex items-center gap-2 pl-7 pr-3 py-2 rounded-lg text-[13px] transition-all ${
                            active
                              ? 'bg-indigo-600/90 text-white font-medium shadow-sm'
                              : 'text-slate-400 hover:bg-slate-800/60 hover:text-slate-200'
                          }`}
                        >
                          <span className="flex-1 text-left">{item.label}</span>
                          {item.badge && (
                            <kbd
                              className={`text-[10px] px-1.5 py-0.5 rounded font-mono ${
                                active
                                  ? 'bg-indigo-500/50 text-indigo-100'
                                  : 'bg-slate-800 text-slate-500'
                              }`}
                            >
                              {item.badge}
                            </kbd>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </nav>

      <div className="px-3 py-4 border-t border-slate-800/80 space-y-3">
        <div className="flex items-center gap-2 px-2 text-xs text-slate-500">
          <Keyboard className="w-3.5 h-3.5" />
          <span>F2 — Satış Yap</span>
        </div>
        <button
          type="button"
          onClick={onLogout}
          className="w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl text-sm font-medium text-red-400 bg-red-500/10 border border-red-500/20 hover:bg-red-500/20 hover:text-red-300 transition-all"
        >
          <LogOut className="w-4 h-4" />
          Güvenli Çıkış
        </button>
      </div>
    </aside>
  );
}
