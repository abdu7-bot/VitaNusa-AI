import { createFileRoute } from "@tanstack/react-router";
import { NusaChat } from "@/components/nusa-chat";

export const Route = createFileRoute("/")({
  head: () => ({ meta: [{ title: "Nusa Chat — VitaNusa AI" }] }),
  component: NusaChat,
});
