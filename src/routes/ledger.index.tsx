import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/ledger/")({
  ssr: false,
  beforeLoad: () => {
    throw redirect({ to: "/ledger/jobs" });
  },
});
