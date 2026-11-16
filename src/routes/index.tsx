import { createFileRoute } from "@tanstack/react-router";
import { Dashboard } from "@/components/ledger/dashboard";

export const Route = createFileRoute("/")({
  component: Dashboard,
});
