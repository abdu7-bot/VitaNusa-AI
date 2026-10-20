import { createFileRoute } from "@tanstack/react-router";
import { VitaCheck } from "@/components/vita-check";

export const Route = createFileRoute("/vitacheck")({
  head: () => ({ meta: [{ title: "VitaCheck — VitaNusa AI" }] }),
  component: VitaCheck,
});
