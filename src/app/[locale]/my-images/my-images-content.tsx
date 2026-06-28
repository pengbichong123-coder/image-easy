"use client";

import { useEffect, useState, useCallback } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { HistoryGrid, type HistoryItem } from "@/components/HistoryGrid";
import {
  getHistoryItemsNeedingStatusRefresh,
  mergeHistoryItemStatusRefresh,
} from "@/lib/history-status-refresh";
import { MODEL_GROUPS } from "@/lib/models";
import { cn } from "@/lib/utils";

export function MyImagesContent() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const t = useTranslations("archive");
  const tCommon = useTranslations("common");
  const [items, setItems] = useState<HistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [modelFilter, setModelFilter] = useState<string | "all">("all");

  const refreshProcessingItems = useCallback(async (historyItems: HistoryItem[]) => {
    const ids = getHistoryItemsNeedingStatusRefresh(historyItems);
    if (ids.length === 0) return;

    const results = await Promise.allSettled(
      ids.map(async (id) => {
        const res = await fetch(`/api/generate/${id}`, { cache: "no-store" });
        const data = await res.json().catch(() => ({}));
        if (!res.ok && data.status !== "failed") {
          throw new Error(data.error || "Failed to refresh generation status");
        }

        return data as Partial<HistoryItem> & { id: string };
      }),
    );

    const refreshedItems = results
      .filter((result): result is PromiseFulfilledResult<Partial<HistoryItem> & { id: string }> => result.status === "fulfilled")
      .map((result) => result.value);

    if (refreshedItems.length === 0) return;

    setItems((currentItems) => refreshedItems.reduce(
      (nextItems, refreshedItem) => mergeHistoryItemStatusRefresh(nextItems, refreshedItem),
      currentItems,
    ));
  }, []);

  const load = useCallback(
    async (cursor?: string) => {
      setLoading(true);
      try {
        const params = new URLSearchParams();
        params.set("limit", "24");
        if (cursor) params.set("cursor", cursor);
        if (modelFilter !== "all") params.set("modelGroup", modelFilter);
        const res = await fetch("/api/history?" + params.toString());
        if (res.status === 401) {
          router.push("/login?callbackUrl=/my-images");
          return;
        }
        const data = await res.json();
        if (cursor) {
          setItems((prev) => [...prev, ...data.items]);
        } else {
          setItems(data.items);
          void refreshProcessingItems(data.items);
        }
        setNextCursor(data.nextCursor);
      } finally {
        setLoading(false);
      }
    },
    [router, modelFilter, refreshProcessingItems],
  );

  useEffect(() => {
    if (status === "loading") return;
    if (!session) {
      router.push("/login?callbackUrl=/my-images");
      return;
    }
    load();
  }, [session, status, load]);

  async function handleDelete(id: string) {
    if (!confirm(t("discardConfirm"))) return;
    const res = await fetch(`/api/history?id=${id}`, { method: "DELETE" });
    if (res.ok) setItems(items.filter((i) => i.id !== id));
  }

  function handleReuse(item: HistoryItem) {
    router.push(`/create?reuse=${item.id}`);
  }

  if (status === "loading") {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="spinner" style={{ width: 24, height: 24 }} />
      </div>
    );
  }

  return (
    <div className="max-w-[1280px] mx-auto px-5 py-10 sm:py-16">
      {/* Header */}
      <div className="mb-10 sm:mb-14">
        <div className="text-[14px] text-[#6E6E73] mb-3">{t("kicker")}</div>
        <h1 className="display text-[48px] sm:text-[64px] text-[#1D1D1F] mb-3 leading-[1.05]">
          {t("titleA")} <span className="display-em text-[#0066CC]">{t("titleEm")}</span>
          {t("titleB")}
        </h1>
        <div className="text-[13px] text-[#86868B] mt-4 tabular">
          {t("printCount", { count: items.length })}
        </div>
      </div>

      {/* Filter bar */}
      <div className="mb-8 flex items-center gap-2 overflow-x-auto pb-2">
        <FilterPill
          active={modelFilter === "all"}
          onClick={() => setModelFilter("all")}
          label={t("filterAll")}
        />
        {MODEL_GROUPS.map((modelGroup) => (
          <FilterPill
            key={modelGroup.slug}
            active={modelFilter === modelGroup.slug}
            onClick={() => setModelFilter(modelGroup.slug)}
            label={modelGroup.displayName}
          />
        ))}
      </div>

      <HistoryGrid
        items={items}
        onDelete={handleDelete}
        onReuse={handleReuse}
        emptyText={
          modelFilter === "all"
            ? t("emptyText")
            : t("emptyFilter")
        }
      />

      {nextCursor && (
        <div className="text-center mt-12">
          <button
            onClick={() => load(nextCursor)}
            disabled={loading}
            className="btn btn-secondary"
          >
            {loading ? tCommon("loading") : t("loadMore")}
          </button>
        </div>
      )}
    </div>
  );
}

function FilterPill({
  active,
  onClick,
  label,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "px-4 py-1.5 text-[13px] rounded-full whitespace-nowrap transition-colors",
        active
          ? "bg-[#1D1D1F] text-white"
          : "bg-[#F5F5F7] text-[#1D1D1F] hover:bg-[#E5E5E7]",
      )}
    >
      {label}
    </button>
  );
}
