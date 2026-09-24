"use client";

import { createContext, ReactNode, useContext, useEffect, useState } from "react";

export type Locale = "en" | "zh-CN";

const COOKIE_NAME = "litellm_locale";

const messages = {
  en: {
    "language.label": "Language",
    "language.english": "English",
    "language.chinese": "简体中文",
    "login.title": "Login",
    "login.subtitle": "Access your LiteLLM Admin UI.",
    "login.defaultCredentials": "Default Credentials",
    "login.defaultCredentialsDescription":
      "By default, Username is admin and Password is your configured LiteLLM Proxy MASTER_KEY.",
    "login.credentialsHelp": "Need to set UI credentials or SSO?",
    "login.documentation": "Check the documentation",
    "login.worker": "Worker",
    "login.workerPlaceholder": "Choose a worker to connect to",
    "login.username": "Username",
    "login.usernamePlaceholder": "Enter your username",
    "login.usernameRequired": "Please enter your username",
    "login.password": "Password",
    "login.passwordPlaceholder": "Enter your password",
    "login.passwordRequired": "Please enter your password",
    "login.submit": "Login",
    "login.submitting": "Logging in...",
    "login.sso": "Login with SSO",
    "login.ssoUnavailable": "Please configure SSO to log in with SSO.",
    "login.disabled": "Admin UI Disabled",
    "login.disabledDescription":
      "The Admin UI has been disabled by the administrator. To re-enable it, update this environment variable:",
    "login.ssoNotice":
      "Single Sign-On (SSO) is enabled. LiteLLM no longer redirects to SSO automatically when this page loads. To restore automatic redirects, set AUTO_REDIRECT_UI_LOGIN_TO_SSO=true in your environment.",
  },
  "zh-CN": {
    "language.label": "语言",
    "language.english": "English",
    "language.chinese": "简体中文",
    "login.title": "登录",
    "login.subtitle": "进入 LiteLLM 管理后台",
    "login.defaultCredentials": "默认凭据",
    "login.defaultCredentialsDescription": "默认用户名为 admin，密码为 LiteLLM Proxy 配置的 MASTER_KEY",
    "login.credentialsHelp": "需要配置管理后台凭据或单点登录？",
    "login.documentation": "查看文档",
    "login.worker": "工作节点",
    "login.workerPlaceholder": "选择要连接的工作节点",
    "login.username": "用户名",
    "login.usernamePlaceholder": "请输入用户名",
    "login.usernameRequired": "请输入用户名",
    "login.password": "密码",
    "login.passwordPlaceholder": "请输入密码",
    "login.passwordRequired": "请输入密码",
    "login.submit": "登录",
    "login.submitting": "正在登录...",
    "login.sso": "使用单点登录",
    "login.ssoUnavailable": "请先配置单点登录",
    "login.disabled": "管理后台已停用",
    "login.disabledDescription": "管理员已停用管理后台。如需重新启用，请更新以下环境变量：",
    "login.ssoNotice":
      "单点登录已启用。LiteLLM 当前不会在此页面加载时自动跳转。如需恢复自动跳转，请在环境中设置 AUTO_REDIRECT_UI_LOGIN_TO_SSO=true",
  },
} as const;

export type MessageKey = keyof (typeof messages)["en"];

const navMessages: Record<Locale, Readonly<Record<string, string>>> = {
  en: {},
  "zh-CN": {
    "AI GATEWAY": "AI 网关",
    OBSERVABILITY: "可观测性",
    "ACCESS CONTROL": "访问控制",
    "DEVELOPER TOOLS": "开发者工具",
    SETTINGS: "设置",
    "api-keys": "虚拟密钥",
    "llm-playground": "模型调试",
    models: "模型与端点",
    agentic: "智能体",
    agents: "智能体",
    workflows: "工作流运行记录",
    memory: "记忆",
    "mcp-servers": "MCP 服务器",
    skills: "技能",
    guardrails: "防护规则",
    policies: "策略",
    tools: "工具",
    "search-tools": "搜索工具",
    "vector-stores": "向量存储",
    "tool-policies": "工具策略",
    new_usage: "用量",
    "cost-optimization": "成本优化",
    logs: "日志",
    "guardrails-monitor": "防护监控",
    teams: "团队",
    projects: "项目",
    users: "内部用户",
    organizations: "组织",
    "access-groups": "访问组",
    budgets: "预算",
    api_ref: "API 参考",
    "model-hub-table": "AI 模型中心",
    "learning-resources": "学习资源",
    caching: "响应缓存",
    experimental: "实验功能",
    prompts: "提示词",
    "transform-request": "API 调试",
    "tag-management": "标签管理",
    "4": "旧版用量",
    settings: "设置",
    "router-settings": "路由设置",
    "logging-and-alerts": "日志与告警",
    "admin-panel": "管理设置",
    "cost-tracking": "成本跟踪",
    "ui-theme": "界面主题",
  },
};

interface LocaleContextValue {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (key: MessageKey) => string;
  nav: (key: string, fallback: string) => string;
}

const defaultValue: LocaleContextValue = {
  locale: "en",
  setLocale: () => undefined,
  t: (key) => messages.en[key],
  nav: (_key, fallback) => fallback,
};

const LocaleContext = createContext<LocaleContextValue>(defaultValue);

const localeFromBrowser = (): Locale => {
  const cookieLocale = document.cookie
    .split("; ")
    .find((entry) => entry.startsWith(`${COOKIE_NAME}=`))
    ?.split("=")[1];
  if (cookieLocale === "en" || cookieLocale === "zh-CN") return cookieLocale;
  return navigator.language.toLowerCase().startsWith("zh") ? "zh-CN" : "en";
};

export function LocaleProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>("en");

  useEffect(() => {
    const frame = requestAnimationFrame(() => setLocaleState(localeFromBrowser()));
    return () => cancelAnimationFrame(frame);
  }, []);

  const setLocale = (nextLocale: Locale) => {
    setLocaleState(nextLocale);
    document.cookie = `${COOKIE_NAME}=${nextLocale}; Path=/; Max-Age=31536000; SameSite=Lax`;
  };

  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  const value: LocaleContextValue = {
    locale,
    setLocale,
    t: (key) => messages[locale][key],
    nav: (key, fallback) => navMessages[locale][key] ?? fallback,
  };

  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}

export const useLocale = (): LocaleContextValue => useContext(LocaleContext);
