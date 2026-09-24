"use client";

import { Languages } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Locale, useLocale } from "@/contexts/LocaleContext";

const options: ReadonlyArray<{ locale: Locale; labelKey: "language.english" | "language.chinese" }> = [
  { locale: "zh-CN", labelKey: "language.chinese" },
  { locale: "en", labelKey: "language.english" },
];

export function LanguageSwitcher() {
  const { locale, setLocale, t } = useLocale();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={<Button variant="ghost" size="icon-sm" aria-label={t("language.label")} title={t("language.label")} />}
      >
        <Languages />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-36">
        {options.map((option) => (
          <DropdownMenuItem key={option.locale} onClick={() => setLocale(option.locale)} className="justify-between">
            {t(option.labelKey)}
            {locale === option.locale ? <span aria-hidden>✓</span> : null}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
