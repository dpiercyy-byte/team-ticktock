import { createFileRoute } from "@tanstack/react-router";
import { Bell } from "lucide-react";

export const Route = createFileRoute("/ledger/notifications")({
  head: () => ({
    meta: [{ title: "Notifications — Clockwise OS" }, { name: "robots", content: "noindex" }],
  }),
  component: () => (
    <div className="mt-24 text-center">
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-900 text-white">
        <Bell className="h-6 w-6" />
      </div>
      <h1
        className="mt-5 text-2xl font-semibold text-slate-900"
        style={{ fontFamily: '"Bricolage Grotesque", serif', letterSpacing: "-0.03em" }}
      >
        All caught up
      </h1>
      <p className="mt-2 text-sm text-slate-500">Job alerts land here in a later phase.</p>
    </div>
  ),
});
