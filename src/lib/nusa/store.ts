import { create } from "zustand";
import { persist } from "zustand/middleware";
import { useEffect, useState } from "react";
import type { CheckResult } from "@/lib/nusa/check";

export type ChatMessage = {
  id: string;
  role: "user" | "nusa";
  text: string;
  warnings?: string[];
  policy?: string;
};

type VitaState = {
  messages: ChatMessage[];
  lastCheck: CheckResult | null;
  pushMessage: (message: ChatMessage) => void;
  clearMessages: () => void;
  saveCheck: (result: CheckResult) => void;
};

export const useVita = create<VitaState>()(
  persist(
    (set) => ({
      messages: [],
      lastCheck: null,
      pushMessage: (message) =>
        set((state) => ({ messages: [...state.messages, message].slice(-40) })),
      clearMessages: () => set({ messages: [] }),
      saveCheck: (result) => set({ lastCheck: result }),
    }),
    { name: "vitanusa-v1", skipHydration: true },
  ),
);

export function useVitaReady() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const unsub = useVita.persist.onFinishHydration(() => setReady(true));
    if (useVita.persist.hasHydrated()) setReady(true);
    else void useVita.persist.rehydrate();
    return unsub;
  }, []);

  return ready;
}
