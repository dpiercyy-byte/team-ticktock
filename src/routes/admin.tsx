import { createFileRoute } from "@tanstack/react-router";
import { AdminApp } from "@/components/admin/AdminApp";

export const Route = createFileRoute("/admin")({
  head: () => ({
    meta: [
      { title: "Admin — Clockwise" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: () => (
    <div className="cw-scope">
      <AdminApp />
    </div>
  ),
});
