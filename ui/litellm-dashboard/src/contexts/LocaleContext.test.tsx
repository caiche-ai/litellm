import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { LocaleProvider, useLocale } from "./LocaleContext";

function Example() {
  const { nav, t } = useLocale();
  return (
    <>
      <span>{t("login.title")}</span>
      <span>{nav("api-keys", "Virtual Keys")}</span>
      <LanguageSwitcher />
    </>
  );
}

describe("LocaleProvider", () => {
  afterEach(() => {
    document.cookie = "litellm_locale=; Path=/; Max-Age=0";
    document.documentElement.lang = "en";
  });

  it("uses the saved Chinese locale across the login and navigation surfaces", async () => {
    document.cookie = "litellm_locale=zh-CN; Path=/";
    render(
      <LocaleProvider>
        <Example />
      </LocaleProvider>,
    );

    expect(await screen.findByText("登录")).toBeInTheDocument();
    expect(screen.getByText("虚拟密钥")).toBeInTheDocument();
    expect(document.documentElement).toHaveAttribute("lang", "zh-CN");
  });

  it("switches languages immediately and persists the choice", async () => {
    document.cookie = "litellm_locale=en; Path=/";
    render(
      <LocaleProvider>
        <Example />
      </LocaleProvider>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Language" }));
    fireEvent.click(await screen.findByText("简体中文"));

    expect(await screen.findByText("登录")).toBeInTheDocument();
    expect(document.cookie).toContain("litellm_locale=zh-CN");
  });
});
