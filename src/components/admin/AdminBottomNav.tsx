import { useState } from "react";
import { Link } from "@tanstack/react-router";
import {
  Clock,
  DollarSign,
  Receipt,
  Users,
  MapPin,
  MoreHorizontal,
  Settings as SettingsIcon,
  ShieldCheck,
  BookOpen,
  LogOut,
} from "lucide-react";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";

type Item = { value: string; label: string; icon: typeof Clock };

const MAIN: Item[] = [
  { value: "entries", label: "Entries", icon: Clock },
  { value: "payouts", label: "Payout", icon: DollarSign },
  { value: "receipts", label: "Receipts", icon: Receipt },
  { value: "sites", label: "Job Sites", icon: MapPin },
];

const MORE: Item[] = [
  { value: "workers", label: "Workers", icon: Users },
  { value: "audit", label: "Audit Log", icon: ShieldCheck },
  { value: "settings", label: "Settings", icon: SettingsIcon },
];

export function AdminBottomNav({
  value,
  onValueChange,
  onLogout,
}: {
  value: string;
  onValueChange: (v: string) => void;
  onLogout?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const moreActive = MORE.some((m) => m.value === value);

  const itemClass = (active: boolean) =>
    "flex min-w-[54px] flex-col items-center gap-1 rounded-full px-2 py-1 text-[10px] font-semibold transition-colors " +
    (active ? "c-nav-item--active" : "text-muted-foreground");

  return (
    <nav aria-label="Admin" className="c-nav fixed inset-x-0 bottom-0 z-40 px-2 pt-1.5 backdrop-blur-xl">
      <ul className="mx-auto flex max-w-3xl items-center justify-between gap-0.5 pb-1.5">
        {MAIN.map((item) => {
          const Icon = item.icon;
          const active = value === item.value;
          return (
            <li key={item.value}>
              <button
                type="button"
                onClick={() => onValueChange(item.value)}
                aria-current={active ? "page" : undefined}
                className={itemClass(active)}
              >
                <span className="c-nav-icon grid h-9 w-9 place-items-center rounded-full transition-colors">
                  <Icon className="h-[19px] w-[19px]" strokeWidth={2.1} />
                </span>
                <span className="tracking-tight">{item.label}</span>
              </button>
            </li>
          );
        })}
        <li>
          <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
              <button type="button" className={itemClass(moreActive)} aria-label="More tabs">
                <span className="c-nav-icon grid h-9 w-9 place-items-center rounded-full transition-colors">
                  <MoreHorizontal className="h-[19px] w-[19px]" strokeWidth={2.1} />
                </span>
                <span className="tracking-tight">More</span>
              </button>
            </PopoverTrigger>
            <PopoverContent align="end" side="top" className="w-48 p-1.5">
              {MORE.map((item) => {
                const Icon = item.icon;
                const active = value === item.value;
                return (
                  <button
                    key={item.value}
                    type="button"
                    onClick={() => {
                      onValueChange(item.value);
                      setOpen(false);
                    }}
                    className={
                      "flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-left text-sm font-medium transition-colors hover:bg-secondary " +
                      (active ? "text-primary" : "text-foreground")
                    }
                  >
                    <Icon className="h-4 w-4" />
                    {item.label}
                  </button>
                );
              })}
              <Link
                to="/ledger"
                onClick={() => setOpen(false)}
                className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-left text-sm font-medium text-foreground transition-colors hover:bg-secondary"
              >
                <BookOpen className="h-4 w-4" />
                Ledger
              </Link>
              {onLogout ? (
                <button
                  type="button"
                  onClick={() => {
                    setOpen(false);
                    onLogout();
                  }}
                  className="mt-1 flex w-full items-center gap-2.5 rounded-lg border-t border-border px-3 py-2.5 text-left text-sm font-medium text-muted-foreground transition-colors hover:bg-secondary"
                >
                  <LogOut className="h-4 w-4" />
                  Sign out
                </button>
              ) : null}
            </PopoverContent>
          </Popover>
        </li>
      </ul>
    </nav>
  );
}
