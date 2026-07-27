import { JOURNEY, JOURNEY_SHORT, journeyIndex } from "./ledger-ui";

/**
 * The seven-stage job journey rendered as a rail.
 * `compact` = thin segment bar for cards. Full = labelled current stage.
 */
export function JobJourney({
  status,
  compact = false,
  onLight = false,
}: {
  status: string;
  compact?: boolean;
  onLight?: boolean;
}) {
  const current = journeyIndex(status);

  const rail = (
    <div className="flex items-center gap-1" aria-hidden>
      {JOURNEY.map((s, i) => (
        <span
          key={s}
          className={
            "l-node " + (i < current ? "l-node--done" : i === current ? "l-node--current" : "")
          }
          style={onLight ? undefined : { opacity: i > current ? 0.35 : 1 }}
        />
      ))}
    </div>
  );

  if (compact) {
    return (
      <div className="w-full">
        {rail}
        <span className="sr-only">
          Stage {current + 1} of {JOURNEY.length}: {JOURNEY[current]}
        </span>
      </div>
    );
  }

  return (
    <div className="w-full">
      <div className="mb-2 grid grid-cols-[minmax(0,1fr)_auto] items-baseline gap-3">
        <p className="l-eyebrow truncate">Stage {current + 1} of {JOURNEY.length}</p>
        <p className="shrink-0 text-[12px] font-semibold">{JOURNEY_SHORT[current]}</p>
      </div>
      {rail}
      <div className="mt-2 flex items-center justify-between text-[10px] l-muted">
        <span>Lead</span>
        <span>Completed</span>
      </div>
    </div>
  );
}
