import type { ReactNode } from "react";

export function LedgerShell({ children }: { children: ReactNode }) {
  return (
    <main className="flex-1 pb-28">
      <div className="mx-auto w-full max-w-3xl px-5 pt-6 md:px-8 md:pt-10">
        {children}
      </div>
    </main>
  );
}
