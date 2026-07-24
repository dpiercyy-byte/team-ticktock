import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { User, LogOut } from "lucide-react";
import { clearAdminToken } from "@/lib/session";

export const Route = createFileRoute("/ledger/profile")({
  head: () => ({
    meta: [{ title: "Profile — Clockwise OS" }, { name: "robots", content: "noindex" }],
  }),
  component: ProfilePage,
});

function ProfilePage() {
  const navigate = useNavigate();
  return (
    <div className="mt-24 text-center">
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-900 text-white">
        <User className="h-6 w-6" />
      </div>
      <h1
        className="mt-5 text-2xl font-semibold text-slate-900"
        style={{ fontFamily: '"Bricolage Grotesque", serif', letterSpacing: "-0.03em" }}
      >
        Admin
      </h1>
      <p className="mt-2 text-sm text-slate-500">You're signed in as admin.</p>
      <button
        onClick={() => {
          clearAdminToken();
          navigate({ to: "/" });
        }}
        className="mx-auto mt-8 inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700"
      >
        <LogOut className="h-4 w-4" /> Sign out
      </button>
    </div>
  );
}
