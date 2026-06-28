"use client";

import { useEffect, useRef } from "react";
import { useSession } from "next-auth/react";

export function CheckoutSessionRefresh({ active }: { active: boolean }) {
  const { update } = useSession();
  const updateRef = useRef(update);

  useEffect(() => {
    updateRef.current = update;
  }, [update]);

  useEffect(() => {
    if (!active) return;

    updateRef.current();
    const retry = window.setTimeout(() => {
      updateRef.current();
    }, 2500);

    return () => window.clearTimeout(retry);
  }, [active]);

  return null;
}
