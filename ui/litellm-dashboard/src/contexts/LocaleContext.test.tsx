import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { LocaleProvider, useLocale } from "./LocaleContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/shared/PageHeader";

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

  it("localizes shared page, form, and action primitives", async () => {
    document.cookie = "litellm_locale=zh-CN; Path=/";
    render(
      <LocaleProvider>
        <PageHeader title="Virtual Keys" subtitle="Manage virtual keys for API access and authentication" icon={null} />
        <Input placeholder="Search" />
        <Button>Refresh</Button>
      </LocaleProvider>,
    );

    expect(await screen.findByRole("heading", { name: "虚拟密钥" })).toBeInTheDocument();
    expect(screen.getByText("管理用于 API 访问和身份验证的虚拟密钥")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("搜索")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "刷新" })).toBeInTheDocument();
  });
});
