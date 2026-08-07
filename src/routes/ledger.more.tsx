import { createFileRoute, Link } from "@tanstack/react-router";
import { Bell, FileSpreadsheet, Plus, User, Users } from "lucide-react";
import { LedgerShell } from "@/components/ledger/LedgerShell";

export const Route = createFileRoute("/ledger/more")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "More — Ledger" },
      { name: "description", content: "Notifications, lead intake, job sheets and your profile." },
      { property: "og:title", content: "More — Ledger" },
      { property: "og:description", content: "Everything else in Ledger." },
    ],
  }),
  component: MoreScreen,
});

const LINKS = [
  { to: "/ledger/leads/new", label: "New lead", hint: "Capture an inquiry", icon: Plus },
  { to: "/ledger/jobs/new", label: "New job", hint: "Full project setup", icon: Users },
  
  {
    to: "/ledger/sheets",
    label: "Job sheets",
    hint: "Import ongoing Google Sheets",
    icon: FileSpreadsheet,
  },
  { to: "/ledger/notifications", label: "Notifications", hint: "Recent activity", icon: Bell },
  { to: "/ledger/profile", label: "Profile", hint: "Session and settings", icon: User },
] as const;

function MoreScreen() {
  return (
    <LedgerShell>
      <header className="mb-6">
        <h1 className="display text-[34px] leading-[1.05] md:text-[42px]">More</h1>
      </header>
      <ul className="grid gap-3">
        {LINKS.map((l) => {
          const Icon = l.icon;
          return (
            <li key={l.to}>
              <Link to={l.to} className="l-card flex items-center gap-3 px-4 py-4">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-muted">
                  <Icon className="h-[18px] w-[18px]" />
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-[15px] font-bold">{l.label}</span>
                  <span className="block truncate text-[12px] l-muted">{l.hint}</span>
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </LedgerShell>
  );
}
