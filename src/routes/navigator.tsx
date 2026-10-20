import { createFileRoute } from "@tanstack/react-router";
import { Navigator } from "@/components/navigator";

export const Route = createFileRoute("/navigator")({
  head: () => ({ meta: [{ title: "Navigator — VitaNusa AI" }] }),
  component: Navigator,
});
