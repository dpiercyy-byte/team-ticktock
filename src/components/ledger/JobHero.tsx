import { MapPin } from "lucide-react";
import { heroClass, statusTone } from "./ledger-ui";

export function JobHero({
  projectType,
  status,
  name,
  client,
  address,
}: {
  projectType: string;
  status: string;
  name: string;
  client: string;
  address: string;
}) {
  return (
    <div className="pb-2 pt-4">
      <span className={statusTone(status) + " mb-4"}>{status}</span>
      <h1 className="l-hero-ink display text-[34px] leading-[1.02] md:text-5xl">{name}</h1>
      <p className="mt-2 text-[15px] font-medium l-hero-ink">{client}</p>
      <p className="mt-1 inline-flex items-center gap-1.5 text-[13px] l-hero-ink-soft">
        <MapPin className="h-3.5 w-3.5 shrink-0" />
        <span className="truncate">{address}</span>
      </p>
      <p className="mt-3 text-[11px] font-semibold uppercase tracking-[0.14em] l-hero-ink-soft">
        {projectType}
      </p>
    </div>
  );
}

export { heroClass };
