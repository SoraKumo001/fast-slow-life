interface TabOption<T extends string> {
  id: T;
  label: string;
}

interface FilterTabsProps<T extends string> {
  activeTab: T;
  onChange: (tab: T) => void;
  tabs: TabOption<T>[];
  className?: string;
}

export const FilterTabs = <T extends string>({
  activeTab,
  onChange,
  tabs,
  className = "",
}: FilterTabsProps<T>) => {
  return (
    <div
      className={`flex border-b border-slate-900 pb-2 mb-3 gap-1 overflow-x-auto no-scrollbar ${className}`}
    >
      {tabs.map((tab) => (
        <button
          key={tab.id}
          onClick={() => onChange(tab.id)}
          className={`px-3 py-1 rounded-lg text-xs font-semibold transition cursor-pointer shrink-0 ${
            activeTab === tab.id
              ? "bg-sky-600/20 text-sky-400 border border-sky-500/30"
              : "text-slate-400 hover:text-slate-200 border border-transparent"
          }`}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
};
