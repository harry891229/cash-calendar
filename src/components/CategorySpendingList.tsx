import { getCategoryIcon } from "@/lib/categories";
import { formatMoney } from "@/lib/money";
import { calculateCategorySpending, getFrequencyText } from "@/lib/recurrence";

type Props = {
  items: ReturnType<typeof calculateCategorySpending>;
  expandedCategory: string | null;
  onToggle: (category: string) => void;
};

export default function CategorySpendingList({ items, expandedCategory, onToggle }: Props) {
  return (
    <div className="space-y-3">
      {items.map((item) => {
        const isExpanded = expandedCategory === item.category;
        const panelId = `category-spending-${encodeURIComponent(item.category)}`;
        return (
          <div key={item.category} className="overflow-hidden rounded-3xl bg-white/5 ring-1 ring-white/10">
            <button type="button" className="flex min-h-16 w-full items-center justify-between gap-4 px-4 py-3 text-left" aria-expanded={isExpanded} aria-controls={panelId} aria-label={`${item.category}本月支出 ${formatMoney(item.total)}，${isExpanded ? "收合明細" : "展開明細"}`} onClick={() => onToggle(item.category)}>
              <span className="flex min-w-0 items-center gap-3">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-slate-800">{getCategoryIcon(item.category)}</span>
                <span>
                  <span className="block font-bold">{item.category}</span>
                  <span className="mt-0.5 block text-xs text-slate-400">{item.events.length} 筆</span>
                </span>
              </span>
              <span className="flex shrink-0 items-center gap-3">
                <span className="font-black text-rose-300">{formatMoney(item.total)}</span>
                <span aria-hidden="true" className="text-slate-400">{isExpanded ? "↑" : "↓"}</span>
              </span>
            </button>
            {isExpanded ? (
              <div id={panelId} className="border-t border-white/10 px-4 py-2">
                {item.events.map((event) => (
                  <div key={event.id} className="flex items-center justify-between gap-4 border-b border-white/5 py-3 last:border-b-0">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-bold">{event.title}</p>
                      <p className="mt-1 text-xs text-slate-400">{event.dateText}・{getFrequencyText(event.frequency)}</p>
                    </div>
                    <p className="shrink-0 text-sm font-bold text-rose-300">{formatMoney(event.amount)}</p>
                  </div>
                ))}
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
