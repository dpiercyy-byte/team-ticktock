import { Link } from "@tanstack/react-router";
import { statusMeta } from "@/lib/os/constants";

type Props = {
  id: string;
  name: string;
  client_name?: string | null;
  address?: string | null;
  status: string;
  progress?: number;
  compact?: boolean;
};

export function JobCard({ id, name, client_name, address, status, progress = 0, compact }: Props) {
  const meta = statusMeta(status);
  return (
    <Link
      to="/ledger/jobs/$jobId"
      params={{ jobId: id }}
      className={`group block rounded-2xl border border-slate-200/80 bg-white p-4 transition-all hover:border-slate-300 hover:shadow-sm ${
        compact ? "min-w-[260px]" : ""
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-[15px] font-semibold text-slate-900" style={{ fontFamily: '"Bricolage Grotesque", serif', letterSpacing: "-0.02em" }}>
            {name}
          </h3>
          {client_name && <p className="mt-0.5 truncate text-xs text-slate-500">{client_name}</p>}
        </div>
        <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${meta.tone}`}>
          {meta.label}
        </span>
      </div>
      {address && <p className="mt-2 truncate text-xs text-slate-400">{address}</p>}
      {progress > 0 && (
        <div className="mt-3 h-1 w-full overflow-hidden rounded-full bg-slate-100">
          <div className="h-full rounded-full bg-slate-900 transition-all" style={{ width: `${progress}%` }} />
        </div>
      )}
    </Link>
  );
}
