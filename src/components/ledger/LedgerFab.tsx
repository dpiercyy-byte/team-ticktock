import type { ReactNode } from "react";

export function LedgerFab({
  onClick,
  label,
  children,
}: {
  onClick: () => void;
  label: string;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className="l-fab fixed bottom-28 right-5 z-40 grid h-14 w-14 place-items-center rounded-full"
    >
      {children}
    </button>
  );
}
