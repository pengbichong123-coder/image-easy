"use client";

import { useEffect, useRef } from "react";
import { useSession } from "next-auth/react";

export function CheckoutSessionRefresh({ active }: { active: boolean }) {
  const { data: session, update } = useSession();
  const sessionRef = useRef(session);
  const updateRef = useRef(update);

  useEffect(() => {
    sessionRef.current = session;
    updateRef.current = update;
  }, [session, update]);

  useEffect(() => {
    if (!active) return;

    let canceled = false;
    const initialCredits = sessionRef.current?.user?.credits;
    const retryDelays = [0, 2000, 5000, 10000, 20000];
    const timers: number[] = [];

    async function refreshSession() {
      const updatedSession = await updateRef.current();
      const updatedCredits = updatedSession?.user?.credits;
      if (
        typeof initialCredits === "number"
        && typeof updatedCredits === "number"
        && updatedCredits !== initialCredits
      ) {
        canceled = true;
        timers.forEach((timer) => window.clearTimeout(timer));
      }
    }

    retryDelays.forEach((delay) => {
      const timer = window.setTimeout(() => {
        if (!canceled) {
          refreshSession().catch(() => {});
        }
      }, delay);
      timers.push(timer);
    });

    return () => {
      canceled = true;
      timers.forEach((timer) => window.clearTimeout(timer));
    };
  }, [active]);

  return null;
}
