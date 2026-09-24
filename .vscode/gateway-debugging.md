# LiteLLM 模型调用链路与断点指南

本文追踪当前代码中一条典型的 `POST /v1/chat/completions` 请求，场景为 Router 管理模型组、实际供应商为 OpenAI、`stream=false`、缓存未命中且调用成功

行号链接可在 VS Code Markdown 预览中点击。代码变更后行号可能漂移，此时可通过链接文字中的函数名重新定位

## 调试准备

在 VS Code 的“运行和调试”中选择 `LiteLLM Proxy`，按 `F5` 启动。启动配置位于 [launch.json](./launch.json)，可执行请求位于 [requests.http](./requests.http)

在 `.env` 中配置真实的供应商密钥，不要把密钥写入本文或提交到 Git：

```dotenv
OPENAI_API_KEY=<your-key>
```

## 主调用链

```text
POST /v1/chat/completions
  -> user_api_key_auth()
     -> _user_api_key_auth_builder()
     -> _authorize_authenticated_request()
     -> common_checks()
  -> chat_completion()
  -> ProxyBaseLLMRequestProcessing.base_process_llm_request()
  -> ProxyBaseLLMRequestProcessing._process_llm_request()
     -> _pre_call_with_fallbacks()
        -> common_processing_pre_call_logic()
           -> add_litellm_data_to_request()
           -> function_setup()
           -> ProxyLogging.pre_call_hook()
     -> ProxyLogging.during_call_hook()
     -> route_request()
        -> _route_request_single_attempt()
        -> Router.acompletion()
           -> async_function_with_fallbacks()
           -> async_function_with_retries()
           -> Router._acompletion()
              -> async_get_available_deployment()
              -> litellm.acompletion()
                 -> utils.wrapper_async()
                 -> SDK cache lookup
                 -> litellm.completion()
                 -> _complete_custom_openai()
                 -> OpenAIChatCompletion.completion()
                 -> OpenAIChatCompletion.acompletion()
                 -> OpenAI SDK / HTTPX
                 -> update_response_metadata()
                 -> success callbacks
     -> ProxyLogging.post_call_success_hook()
     -> LiteLLM response headers
  -> FastAPI response
```

## 断点总表

| 顺序 | 阶段 | 断点位置 | 重点观察 |
|---:|---|---|---|
| 1 | FastAPI 路由注册 | [`/v1/chat/completions`](../litellm/proxy/proxy_server.py#L11456) | 路径及鉴权依赖 |
| 2 | API Key 鉴权 | [`user_api_key_auth()`](../litellm/proxy/auth/user_api_key_auth.py#L3288) | `api_key`、`request_data`、`route` |
| 3 | 构造鉴权身份 | [`_user_api_key_auth_builder()`](../litellm/proxy/auth/user_api_key_auth.py#L1465) | Key 来源、缓存或数据库结果 |
| 4 | 通用权限检查 | [`common_checks()`](../litellm/proxy/auth/auth_checks.py#L881) | 模型权限、团队状态、预算 |
| 5 | Chat endpoint | [`chat_completion()`](../litellm/proxy/proxy_server.py#L11477) | 请求体、租户 metadata |
| 6 | Proxy 通用入口 | [`base_process_llm_request()`](../litellm/proxy/common_request_processing.py#L2437) | `route_type`、`llm_router` |
| 7 | Proxy 实际处理 | [`_process_llm_request()`](../litellm/proxy/common_request_processing.py#L2502) | 原始模型名、日志对象、请求数据 |
| 8 | pre-call 与本地 fallback | [`_pre_call_with_fallbacks()`](../litellm/proxy/common_request_processing.py#L2219) | 限流失败后的 fallback |
| 9 | 通用 pre-call | [`common_processing_pre_call_logic()`](../litellm/proxy/common_request_processing.py#L1895) | 别名、Guardrail、Hook 修改 |
| 10 | Proxy 路由入口 | [`route_request()`](../litellm/proxy/route_llm_request.py#L426) | Router 或直接 SDK |
| 11 | 单次路由决策 | [`_route_request_single_attempt()`](../litellm/proxy/route_llm_request.py#L464) | `data["model"]`、共享 Session |
| 12 | Router 入口 | [`Router.acompletion()`](../litellm/router.py#L2733) | 模型组、stream、fallback 参数 |
| 13 | fallback 包装 | [`async_function_with_fallbacks()`](../litellm/router.py#L7442) | fallback 配置及原始异常 |
| 14 | retry 包装 | [`async_function_with_retries()`](../litellm/router.py#L7577) | 重试次数、退避、失败部署 |
| 15 | 执行一次部署调用 | [`Router._acompletion()`](../litellm/router.py#L3585) | 选中部署及实际模型参数 |
| 16 | 选择健康部署 | [`async_get_available_deployment()`](../litellm/router.py#L13117) | 健康列表、策略、deployment |
| 17 | SDK 异步入口 | [`litellm.acompletion()`](../litellm/main.py#L397) | `custom_llm_provider`、标准参数 |
| 18 | SDK 装饰器包装 | [`wrapper_async()`](../litellm/utils.py#L1909) | 缓存、Metadata、成功失败回调 |
| 19 | 统一供应商分发 | [`litellm.completion()`](../litellm/main.py#L5083) | Provider Config、参数映射 |
| 20 | OpenAI 分支 | [`_complete_custom_openai()`](../litellm/main.py#L2564) | 默认 handler 与实验 handler 分支 |
| 21 | OpenAI handler | [`OpenAIChatCompletion.completion()`](../litellm/llms/openai/openai.py#L646) | stream 和 async 分支 |
| 22 | OpenAI 异步调用 | [`OpenAIChatCompletion.acompletion()`](../litellm/llms/openai/openai.py#L890) | 最终 body、client、原始响应 |
| 23 | OpenAI 请求转换 | [`async_transform_request()`](../litellm/llms/openai/chat/gpt_transformation.py#L513) | messages、tools、实际模型名 |
| 24 | 调用 OpenAI SDK | [`make_openai_chat_completion_request()` 调用点](../litellm/llms/openai/openai.py#L947) | 最终 URL、body、timeout |
| 25 | SDK 响应 Metadata | [`update_response_metadata()`](../litellm/litellm_core_utils/llm_response_utils/response_metadata.py#L223) | 成本、耗时、hidden params |
| 26 | Proxy post-call | [`post_call_success_hook()` 调用点](../litellm/proxy/common_request_processing.py#L2854) | 响应 Guardrail、usage、成本 |
| 27 | 响应 Header | [`get_custom_headers()` 调用点](../litellm/proxy/common_request_processing.py#L2931) | call ID、model ID、response cost |
| 28 | 返回 endpoint | [`return response`](../litellm/proxy/common_request_processing.py#L2975) | 最终 OpenAI 兼容响应 |

## 1. FastAPI 与鉴权

FastAPI 在进入 [`chat_completion()`](../litellm/proxy/proxy_server.py#L11477) 前执行 [`user_api_key_auth()`](../litellm/proxy/auth/user_api_key_auth.py#L3288)

鉴权入口先读取请求体和路由，再调用 [`_user_api_key_auth_builder()`](../litellm/proxy/auth/user_api_key_auth.py#L1465) 解析 Master Key、Virtual Key、JWT 或自定义鉴权结果。身份解析完成后执行请求授权，最终由 [`common_checks()`](../litellm/proxy/auth/auth_checks.py#L881) 检查团队和项目状态、模型权限及各级预算

鉴权失败会在这里直接返回，后续 endpoint、Router 和供应商调用均不会执行

## 2. Endpoint 与 Proxy 前处理

[`chat_completion()`](../litellm/proxy/proxy_server.py#L11477) 在 [读取请求体](../litellm/proxy/proxy_server.py#L11508) 后，把用户、团队、组织和 Agent 信息写入 metadata，并在 [11528 行](../litellm/proxy/proxy_server.py#L11528) 调用 `base_process_llm_request()`

[`base_process_llm_request()`](../litellm/proxy/common_request_processing.py#L2437) 为调用包装首字节前的 SSE keepalive，随后进入 [`_process_llm_request()`](../litellm/proxy/common_request_processing.py#L2502)

通用 pre-call 路径依次执行：

1. [`add_litellm_data_to_request()` 调用点](../litellm/proxy/common_request_processing.py#L2014) 补充 Header、鉴权和 Proxy 上下文
2. [模型优先级解析](../litellm/proxy/common_request_processing.py#L2056)
3. [全局模型别名](../litellm/proxy/common_request_processing.py#L2076) 和 [Key 级模型别名](../litellm/proxy/common_request_processing.py#L2080)
4. [`function_setup()` 调用点](../litellm/proxy/common_request_processing.py#L2148) 创建贯穿整次调用的日志对象
5. [合并模型级 Guardrail](../litellm/proxy/common_request_processing.py#L2173)
6. [`pre_call_hook()` 调用点](../litellm/proxy/common_request_processing.py#L2187) 执行限流、Guardrail 和自定义 Hook

## 3. Proxy 路由决策

[`_process_llm_request()`](../litellm/proxy/common_request_processing.py#L2502) 并发启动 `during_call_hook()`，然后在 [2603 行](../litellm/proxy/common_request_processing.py#L2603) 调用 `route_request()`

[`_route_request_single_attempt()`](../litellm/proxy/route_llm_request.py#L464) 有几条主要路径：

- 请求携带 `api_key` 或 `api_base` 时，从 [488 行](../litellm/proxy/route_llm_request.py#L488) 直接调用 Router 或 SDK
- 模型被 Router 识别时，从 [642 行](../litellm/proxy/route_llm_request.py#L642) 调用 `llm_router.acompletion()`
- 开启全模型透传时，从 [648 行](../litellm/proxy/route_llm_request.py#L648) 直接调用 SDK
- 没有 Router但 CLI 指定模型时，从 [712 行](../litellm/proxy/route_llm_request.py#L712) 直接调用 SDK

## 4. Router、retry 与 fallback

[`Router.acompletion()`](../litellm/router.py#L2733) 在 [2760 行](../litellm/router.py#L2760) 进入 fallback 包装器。fallback 包装器在 [7491 行](../litellm/router.py#L7491) 先执行 retry 包装器

[`async_function_with_retries()`](../litellm/router.py#L7577) 通过 [7610 行](../litellm/router.py#L7610) 执行一次 `Router._acompletion()`。失败后在 [7657 行](../litellm/router.py#L7657) 判断是否可重试，在 [7682 行](../litellm/router.py#L7682) 计算退避时间，并从 [7692 行](../litellm/router.py#L7692) 开始重试

[`Router._acompletion()`](../litellm/router.py#L3585) 在 [3603 行](../litellm/router.py#L3603) 选择部署。选中后在 [3651 行](../litellm/router.py#L3651) 合并实际模型、API Base、凭据和部署参数，最终在 [3689 行](../litellm/router.py#L3689) 调用 `litellm.acompletion()`

## 5. SDK 缓存和供应商分发

`litellm.acompletion()` 由 `@client` 装饰，因此首先进入 [`wrapper_async()`](../litellm/utils.py#L1909)。包装器在 [1968 行](../litellm/utils.py#L1968) 查询响应缓存，命中时在 [1978 行](../litellm/utils.py#L1978) 提前返回

缓存未命中时，从 [2035 行](../litellm/utils.py#L2035) 执行原始 `acompletion()`。该函数在 [643 行](../litellm/main.py#L643) 构造 `completion()` 调用，再通过 [649 行](../litellm/main.py#L649) 在线程池中执行统一供应商分发

OpenAI 或 OpenAI-compatible 模型在 [5860 行](../litellm/main.py#L5860) 命中分支，并从 [5886 行](../litellm/main.py#L5886) 调用 `_complete_custom_openai()`

## 6. OpenAI 请求

默认情况下，`_complete_custom_openai()` 从 [2663 行](../litellm/main.py#L2663) 调用 `OpenAIChatCompletion.completion()`。如果开启 `EXPERIMENTAL_OPENAI_BASE_LLM_HTTP_HANDLER`，则从 [2642 行](../litellm/main.py#L2642) 改走共享 `BaseLLMHTTPHandler`

默认异步非流式路径为：

```text
OpenAIChatCompletion.completion()
  -> OpenAIChatCompletion.acompletion()
  -> provider_config.async_transform_request()
  -> 创建或复用 AsyncOpenAI
  -> make_openai_chat_completion_request()
  -> OpenAI SDK
  -> HTTPX
```

关键断点分别是 [异步分支](../litellm/llms/openai/openai.py#L713)、[请求转换](../litellm/llms/openai/openai.py#L913)、[创建客户端](../litellm/llms/openai/openai.py#L922) 和 [发起请求](../litellm/llms/openai/openai.py#L947)

查看请求头时不要复制、记录或提交 Authorization 和 API Key

## 7. SDK 和 Proxy 响应后处理

响应回到 SDK wrapper 后依次执行 [SDK post-call](../litellm/utils.py#L2077)、[写入响应缓存](../litellm/utils.py#L2094)、[更新响应 Metadata](../litellm/utils.py#L2123) 和 [分发成功回调](../litellm/utils.py#L2131)

Router 在 [3727 行](../litellm/router.py#L3727) 返回非流式结果。Proxy 在 [2629 行](../litellm/proxy/common_request_processing.py#L2629) 读取 `_hidden_params`，并在 [2854 行](../litellm/proxy/common_request_processing.py#L2854) 执行响应 Guardrail 和 post-call Hook

最后，Proxy 在 [2931 行](../litellm/proxy/common_request_processing.py#L2931) 写入 call ID、model ID、缓存和成本等响应 Header，在 [2967 行](../litellm/proxy/common_request_processing.py#L2967) 检查响应大小，然后返回 endpoint

## 流式请求分叉

`stream=true` 的鉴权、pre-call、Router 和 SDK 前半段与非流式请求相同

| 阶段 | 断点位置 | 作用 |
|---|---|---|
| OpenAI 流式分支 | [`async_streaming()` 调用点](../litellm/llms/openai/openai.py#L714) | 创建供应商流 |
| Router 包装流 | [`_acompletion_streaming_iterator()` 调用点](../litellm/router.py#L3719) | 增加 fallback 和部署槽管理 |
| Proxy 识别流 | [流式判断](../litellm/proxy/common_request_processing.py#L2651) | 准备流式 Header 和 generator |
| Proxy 返回 SSE | [`create_response()` 调用点](../litellm/proxy/common_request_processing.py#L2810) | 返回 `text/event-stream` |
| SSE 数据生成 | [`async_streaming_data_generator()`](../litellm/proxy/common_request_processing.py#L3866) | chunk 转换、错误处理和清理 |

## 提前终止与旁路

| 情况 | 位置 | 后续行为 |
|---|---|---|
| Key、权限或预算失败 | [`user_api_key_auth()`](../litellm/proxy/auth/user_api_key_auth.py#L3288) | 不进入 endpoint |
| pre-call Guardrail 拒绝 | [`pre_call_hook()` 调用点](../litellm/proxy/common_request_processing.py#L2187) | 不进入 Router |
| SDK 缓存命中 | [缓存返回](../litellm/utils.py#L1978) | 不调用供应商 |
| Router retry 成功 | [retry 循环](../litellm/router.py#L7692) | 返回其他尝试的结果 |
| Router fallback 成功 | [fallback 处理](../litellm/router.py#L7500) | 返回其他模型组结果 |
| post-call Guardrail 修改 | [`post_call_success_hook()`](../litellm/proxy/common_request_processing.py#L2854) | 返回修改后的响应 |

## 推荐断点组合

第一次跟踪完整链路时，建议设置：

1. [`user_api_key_auth()`](../litellm/proxy/auth/user_api_key_auth.py#L3288)
2. [`chat_completion()`](../litellm/proxy/proxy_server.py#L11477)
3. [`_process_llm_request()`](../litellm/proxy/common_request_processing.py#L2502)
4. [`route_request()`](../litellm/proxy/route_llm_request.py#L426)
5. [`Router._acompletion()`](../litellm/router.py#L3585)
6. [`litellm.acompletion()`](../litellm/main.py#L397)
7. [`OpenAIChatCompletion.acompletion()`](../litellm/llms/openai/openai.py#L890)
8. [OpenAI SDK 请求调用点](../litellm/llms/openai/openai.py#L947)
9. [`post_call_success_hook()` 调用点](../litellm/proxy/common_request_processing.py#L2854)

调试“为什么选中了这个部署”时，重点设置 [`async_get_available_deployment()`](../litellm/router.py#L13117) 和 [`Router._acompletion()`](../litellm/router.py#L3585)

调试“参数在哪里被改写”时，重点设置 [`common_processing_pre_call_logic()`](../litellm/proxy/common_request_processing.py#L1895)、[`wrapper_async()`](../litellm/utils.py#L1909) 和 [`async_transform_request()`](../litellm/llms/openai/chat/gpt_transformation.py#L513)

调试“为什么没有请求供应商”时，依次检查鉴权、pre-call Hook、SDK cache 和 Router retry/fallback 断点
