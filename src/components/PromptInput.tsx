"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";

interface Props {
  value: string;
  onChange: (v: string) => void;
  maxLength: number;
  placeholder?: string;
  disabled?: boolean;
  onSubmit: () => void;
  canSubmit: boolean;
  submitting: boolean;
}

const SAMPLE_PROMPTS = [
  "A cinematic night portrait in a Tokyo alley, neon reflections, rain-slick pavement, 35mm, 1970s kodachrome",
  "An astronaut cat drinking espresso under moonlight, watercolor, soft lavender and cream",
  "Black ink brush painting of misty mountains with a lone pagoda, traditional Chinese, minimalist",
  "Hyperreal product shot: a single white sneaker floating against a matte pastel backdrop, studio light",
];

export function PromptInput({
  value,
  onChange,
  maxLength,
  placeholder = "Describe what you want to see…",
  disabled,
  onSubmit,
  canSubmit,
  submitting,
}: Props) {
  const t = useTranslations("prompt");
  const tCreate = useTranslations("create");
  const tCommon = useTranslations("common");
  const [focused, setFocused] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const isOverLimit = value.length > maxLength;
  const syncTextareaValue = useCallback(
    (nextValue: string) => {
      if (nextValue !== value) {
        onChange(nextValue);
      }
    },
    [onChange, value],
  );

  useEffect(() => {
    if (!focused || disabled) return;

    const interval = window.setInterval(() => {
      const nextValue = textareaRef.current?.value;
      if (typeof nextValue === "string") {
        syncTextareaValue(nextValue);
      }
    }, 250);

    return () => window.clearInterval(interval);
  }, [disabled, focused, syncTextareaValue]);

  return (
    <div>
      <textarea
        ref={textareaRef}
        value={value}
        onChange={(e) => syncTextareaValue(e.currentTarget.value)}
        onInput={(e) => syncTextareaValue(e.currentTarget.value)}
        onCompositionEnd={(e) => syncTextareaValue(e.currentTarget.value)}
        onPaste={() => {
          window.setTimeout(() => {
            const nextValue = textareaRef.current?.value;
            if (typeof nextValue === "string") {
              syncTextareaValue(nextValue);
            }
          }, 0);
        }}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        placeholder={placeholder}
        rows={5}
        disabled={disabled}
        className="textarea"
        onKeyDown={(e) => {
          if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
            e.preventDefault();
            if (canSubmit && !submitting) onSubmit();
          }
        }}
      />

      {focused && value.length === 0 && (
        <div className="mt-4 space-y-2">
          <div className="text-[11px] tracking-[0.05em] uppercase text-[#86868B] mb-2 font-medium">
            {t("tryOne")}
          </div>
          {SAMPLE_PROMPTS.map((p, i) => (
            <button
              key={i}
              type="button"
              onClick={() => onChange(p)}
              className="block w-full text-left text-[13px] text-[#6E6E73] hover:text-[#1D1D1F] italic transition-colors py-1 leading-[1.4]"
            >
              &ldquo;{p}&rdquo;
            </button>
          ))}
        </div>
      )}

      <div className="mt-4 pt-3 border-t border-[#E5E5E7] flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span
            className={cn(
              "text-[12px] tabular",
              isOverLimit ? "text-[#D70015]" : "text-[#86868B]",
            )}
          >
            {String(value.length).padStart(4, "0")} / {String(maxLength).padStart(5, "0")}
          </span>
          <span className="text-[11px] tracking-[0.05em] uppercase text-[#86868B]">
            {t("chars")}
          </span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-[11px] tracking-[0.05em] uppercase text-[#86868B] hidden sm:inline">
            {t("shortcutHint")}
          </span>
          <button
            type="button"
            onClick={onSubmit}
            disabled={!canSubmit || submitting}
            className="btn btn-primary"
            aria-label={tCreate("submit")}
          >
            {submitting ? (
              <>
                <span className="spinner" />
                {tCreate("submitting")}
              </>
            ) : (
              <>{tCreate("submit")}</>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
