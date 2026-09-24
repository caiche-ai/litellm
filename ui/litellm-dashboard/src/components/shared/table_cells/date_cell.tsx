"use client";

import { CellTooltip } from "./cell_tooltip";
import { useLocale } from "@/contexts/LocaleContext";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"] as const;

export type DatePrecision = "datetime" | "date";

interface DateCellProps {
  value: string | null | undefined;
  precision?: DatePrecision;
  fallback?: string;
}

const pad = (n: number): string => String(n).padStart(2, "0");

export const formatCellDate = (date: Date, precision: DatePrecision): string =>
  precision === "date"
    ? `${MONTHS[date.getMonth()]} ${date.getDate()}, ${date.getFullYear()}`
    : `${MONTHS[date.getMonth()]} ${date.getDate()}, ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;

export const formatFullTimestamp = (date: Date): string => {
  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const day = `${MONTHS[date.getMonth()]} ${date.getDate()}, ${date.getFullYear()}`;
  const time = `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
  return `${day}, ${time} (${timeZone})`;
};

export function DateCell({ value, precision = "datetime", fallback = "-" }: DateCellProps) {
  const { locale, text } = useLocale();
  const date = value ? new Date(value) : null;
  if (!date || Number.isNaN(date.getTime())) {
    return <span className="text-muted-foreground">{text(fallback)}</span>;
  }

  const formatOptions: Intl.DateTimeFormatOptions = {
    year: "numeric",
    month: locale === "zh-CN" ? "numeric" : "short",
    day: "numeric",
    ...(precision === "datetime" ? { hour: "2-digit", minute: "2-digit", second: "2-digit" } : {}),
  };
  const localizedDate = new Intl.DateTimeFormat(locale, formatOptions).format(date);

  return (
    <CellTooltip
      content={formatFullTimestamp(date)}
      trigger={
        <span className="whitespace-nowrap">
          {locale === "zh-CN" ? localizedDate : formatCellDate(date, precision)}
        </span>
      }
    />
  );
}
