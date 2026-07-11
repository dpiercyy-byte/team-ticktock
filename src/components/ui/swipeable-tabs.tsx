import { useCallback, useRef, useState } from "react";
import { useSwipeable } from "react-swipeable";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Legacy end-of-gesture swipe hook (kept for any callers that only need a
// coarse left/right notification without a live carousel).
// ---------------------------------------------------------------------------

interface UseSwipeableTabsOptions<T> {
  items: readonly T[];
  current: T;
  onChange: (item: T) => void;
}

function isInsideHorizontalScroller(target: HTMLElement): boolean {
  let el: HTMLElement | null = target;
  while (el && el !== document.body) {
    const style = window.getComputedStyle(el);
    if (style.overflowX === "auto" || style.overflowX === "scroll") return true;
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
      if (newIdx >= 0 && newIdx < items.length) onChange(items[newIdx]);
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
      if (isInsideHorizontalScroller(target)) ignoreSwipe.current = true;
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

// ---------------------------------------------------------------------------
// Finger-following carousel — the current tab, the previous, and the next
// tab are laid out side by side on a track that translates in real time.
// ---------------------------------------------------------------------------

interface SwipeCarouselProps<T extends string> {
  items: readonly T[];
  current: T;
  onChange: (next: T) => void;
  renderPanel: (key: T) => React.ReactNode;
  className?: string;
}

const COMMIT_DISTANCE_RATIO = 0.22;
const COMMIT_VELOCITY = 0.45; // px/ms
const AXIS_LOCK_PX = 6;
const RUBBER_BAND = 0.35;
const TRANSITION_MS = 260;
const EASING = "cubic-bezier(0.22, 1, 0.36, 1)";

export function SwipeCarousel<T extends string>({
  items,
  current,
  onChange,
  renderPanel,
  className,
}: SwipeCarouselProps<T>) {
  const containerRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const [dx, setDx] = useState(0);
  const [transitioning, setTransitioning] = useState(false);

  const idx = items.indexOf(current);
  const prevKey = idx > 0 ? items[idx - 1] : null;
  const nextKey = idx >= 0 && idx < items.length - 1 ? items[idx + 1] : null;

  const state = useRef({
    startX: 0,
    startY: 0,
    lastX: 0,
    lastT: 0,
    velocity: 0,
    width: 0,
    locked: false,
    active: false,
    pointerId: 0,
    ignored: false,
  });

  const finishTo = (targetDx: number, commitKey: T | null) => {
    const el = trackRef.current;
    setTransitioning(true);
    setDx(targetDx);
    let done = false;
    const finalize = () => {
      if (done) return;
      done = true;
      el?.removeEventListener("transitionend", finalize);
      if (commitKey) onChange(commitKey);
      setTransitioning(false);
      setDx(0);
    };
    el?.addEventListener("transitionend", finalize);
    // Safety net if transitionend never fires (e.g. reduced motion)
    window.setTimeout(finalize, TRANSITION_MS + 80);
  };

  const onPointerDown = (e: React.PointerEvent) => {
    if (transitioning) return;
    if (e.pointerType !== "touch" && e.pointerType !== "pen") return;
    const target = e.target as HTMLElement | null;
    const ignored = !!target?.closest("[data-swipe-ignore]");
    const s = state.current;
    s.startX = e.clientX;
    s.startY = e.clientY;
    s.lastX = e.clientX;
    s.lastT = performance.now();
    s.velocity = 0;
    s.width = containerRef.current?.clientWidth ?? 0;
    s.locked = false;
    s.active = true;
    s.pointerId = e.pointerId;
    s.ignored = ignored;
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const s = state.current;
    if (!s.active || s.ignored) return;
    const deltaX = e.clientX - s.startX;
    const deltaY = e.clientY - s.startY;
    if (!s.locked) {
      if (Math.abs(deltaX) < AXIS_LOCK_PX && Math.abs(deltaY) < AXIS_LOCK_PX) return;
      if (Math.abs(deltaX) > Math.abs(deltaY)) {
        s.locked = true;
        try {
          (e.currentTarget as HTMLElement).setPointerCapture(s.pointerId);
        } catch {
          /* no-op */
        }
      } else {
        s.active = false;
        return;
      }
    }
    let d = deltaX;
    if ((d > 0 && !prevKey) || (d < 0 && !nextKey)) d = d * RUBBER_BAND;
    const now = performance.now();
    const dt = now - s.lastT;
    if (dt > 0) s.velocity = (e.clientX - s.lastX) / dt;
    s.lastX = e.clientX;
    s.lastT = now;
    setDx(d);
  };

  const onPointerEnd = (e: React.PointerEvent) => {
    const s = state.current;
    if (!s.active) return;
    const wasLocked = s.locked;
    s.active = false;
    s.locked = false;
    try {
      (e.currentTarget as HTMLElement).releasePointerCapture(s.pointerId);
    } catch {
      /* no-op */
    }
    if (!wasLocked) {
      setDx(0);
      return;
    }
    const w = s.width || containerRef.current?.clientWidth || 1;
    const threshold = w * COMMIT_DISTANCE_RATIO;
    const v = s.velocity;
    const goingNext = (dx < -threshold || v < -COMMIT_VELOCITY) && nextKey;
    const goingPrev = (dx > threshold || v > COMMIT_VELOCITY) && prevKey;
    if (goingNext) finishTo(-w, nextKey);
    else if (goingPrev) finishTo(w, prevKey);
    else finishTo(0, null);
  };

  return (
    <div
      ref={containerRef}
      className={cn("relative overflow-hidden", className)}
      style={{ touchAction: "pan-y" }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerEnd}
      onPointerCancel={onPointerEnd}
    >
      <div
        ref={trackRef}
        className="flex w-full will-change-transform"
        style={{
          transform: `translate3d(calc(-33.3333% + ${dx}px), 0, 0)`,
          transition: transitioning ? `transform ${TRANSITION_MS}ms ${EASING}` : "none",
        }}
      >
        <div className="min-w-full shrink-0" aria-hidden={!prevKey || dx <= 0}>
          {prevKey ? renderPanel(prevKey) : null}
        </div>
        <div className="min-w-full shrink-0">{renderPanel(current)}</div>
        <div className="min-w-full shrink-0" aria-hidden={!nextKey || dx >= 0}>
          {nextKey ? renderPanel(nextKey) : null}
        </div>
      </div>
    </div>
  );
}
