"use client";

import { useEffect } from "react";
import { useSession } from "next-auth/react";

export function CheckoutSessionRefresh({ active }: { active: boolean }) {
  const { update } = useSession();

  useEffect(() => {
    if (!active) return;

    update();
    const retry = window.setTimeout(() => {
      update();
    }, 2500);

    return () => window.clearTimeout(retry);
  }, [active, update]);

  return null;
}
