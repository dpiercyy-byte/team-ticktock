import { useRef } from "react";
import { cn } from "@/lib/utils";

interface SwipeTabPanelProps<T> {
  tabKey: T;
  tabs: readonly T[];
  children: React.ReactNode;
  className?: string;
}

/**
 * Wrapper that replays a directional slide+fade animation whenever `tabKey`
 * changes. Direction is inferred from the index delta in `tabs`.
 */
export function SwipeTabPanel<T>({ tabKey, tabs, children, className }: SwipeTabPanelProps<T>) {
  const prevRef = useRef<T>(tabKey);
  const prevIdx = tabs.indexOf(prevRef.current);
  const currIdx = tabs.indexOf(tabKey);
  const forward = prevIdx === -1 || currIdx === -1 ? true : currIdx >= prevIdx;
  prevRef.current = tabKey;

  return (
    <div
      key={String(tabKey)}
      className={cn(
        "swipe-panel",
        forward ? "swipe-panel--forward" : "swipe-panel--back",
        className,
      )}
    >
      {children}
    </div>
  );
}
