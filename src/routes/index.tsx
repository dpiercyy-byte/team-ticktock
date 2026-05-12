import { createFileRoute } from "@tanstack/react-router";
import { WorkerApp } from "@/components/worker/WorkerApp";

export const Route = createFileRoute("/")({
  component: () => <WorkerApp />,
});
