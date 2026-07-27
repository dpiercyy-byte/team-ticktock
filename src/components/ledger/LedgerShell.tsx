import type { ReactNode } from "react";

export function LedgerShell({
  children,
  hero,
  heroClassName,
  heroImage,
}: {
  children: ReactNode;
  hero?: ReactNode;
  heroClassName?: string;
  heroImage?: string;
}) {
  if (!hero) {
    return (
      <main className="flex-1 pb-28">
        <div className="mx-auto w-full max-w-3xl px-5 pt-6 md:px-8 md:pt-10">{children}</div>
      </main>
    );
  }

  return (
    <main className="flex-1 pb-28">
      <div
        className={"px-0 pb-24 pt-6 " + (heroClassName ?? "")}
        style={heroImage ? { backgroundImage: `url(${heroImage})` } : undefined}
      >
        <div className="mx-auto w-full max-w-3xl px-5 md:px-8">{hero}</div>
      </div>
      <div className="relative z-10 -mt-16">
        <div className="mx-auto w-full max-w-3xl px-5 md:px-8">{children}</div>
      </div>
    </main>
  );
}

