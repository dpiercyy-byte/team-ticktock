import { createFileRoute } from "@tanstack/react-router";
import { WorkerApp } from "@/components/worker/WorkerApp";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Clockwise — Clock In & Track Your Hours" },
      {
        name: "description",
        content:
          "Clock in and out, see today's and this week's hours, and submit reimbursements with receipt photos.",
      },
      { property: "og:title", content: "Clockwise — Clock In & Track Your Hours" },
      {
        property: "og:description",
        content:
          "Clock in and out, see today's and this week's hours, and submit reimbursements with receipt photos.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: () => (
    <div className="cw-scope">
      <WorkerApp />
    </div>
  ),
});
