import { useRef, useCallback } from "react";
import { useSwipeable } from "react-swipeable";
import { cn } from "@/lib/utils";

interface UseSwipeableTabsOptions<T> {
  items: readonly T[];
  current: T;
  onChange: (item: T) => void;
}

function isInsideHorizontalScroller(target: HTMLElement): boolean {
  let el: HTMLElement | null = target;
  while (el && el !== document.body) {
    const style = window.getComputedStyle(el);
    if (style.overflowX === "auto" || style.overflowX === "scroll") {
      return true;
    }
    el = el.parentElement;
  }
  return false;
}

export function useSwipeableTabs<T>({ items, current, onChange }: UseSwipeableTabsOptions<T>) {
  const ignoreSwipe = useRef(false);

  const switchItem = useCallback(
    (direction: 1 | -1) => {
      const idx = items.indexOf(current);
      if (idx === -1) return;
      const newIdx = idx + direction;
      if (newIdx >= 0 && newIdx < items.length) {
        onChange(items[newIdx]);
      }
    },
    [items, current, onChange],
  );

  return useSwipeable({
    onSwipeStart: (eventData) => {
      const target = eventData.event.target as HTMLElement | null;
      if (!target) return;
      if (target.closest("[data-swipe-ignore]")) {
        ignoreSwipe.current = true;
        return;
      }
      if (isInsideHorizontalScroller(target)) {
        ignoreSwipe.current = true;
      }
    },
    onSwiped: () => {
      ignoreSwipe.current = false;
    },
    onSwipedLeft: () => {
      if (!ignoreSwipe.current) switchItem(1);
    },
    onSwipedRight: () => {
      if (!ignoreSwipe.current) switchItem(-1);
    },
    trackMouse: false,
    delta: 60,
    preventScrollOnSwipe: false,
    swipeDuration: 500,
  });
}

interface SwipeableTabsProps {
  tabs: string[];
  value: string;
  onValueChange: (value: string) => void;
  children: React.ReactNode;
  className?: string;
}

export function SwipeableTabs({
  tabs,
  value,
  onValueChange,
  children,
  className,
}: SwipeableTabsProps) {
  const handlers = useSwipeableTabs({
    items: tabs,
    current: value,
    onChange: onValueChange,
  });

  return (
    <div {...handlers} className={cn("touch-pan-y", className)}>
      {children}
    </div>
  );
}

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
