# Presidio Analyze 性能测试报告

## 测试摘要

本次测试评估 LiteLLM 使用 Presidio Analyzer 对大文本执行隐私识别时的耗时，不包含 Anonymize、LiteLLM Proxy 路由和大模型调用

测试日期为 2026-09-29。测试结果显示，在当前单 Gunicorn sync worker 的本机部署中，100K token 输入的 Analyze P50 为 6.893 秒，900K token 输入的 Analyze P50 为 77.835 秒。大输入的稳定处理吞吐约为每秒 11,500 至 12,500 token

## 测试目标

测试目标是确定不同输入规模下 Presidio 隐私识别阶段的稳定态耗时，并观察 LiteLLM 分块机制、检测数量和处理吞吐随输入规模的变化

本报告只衡量 Analyze 阶段。完整隐私过滤还包含 Anonymize，因此不能把本报告中的耗时直接当作最终用户请求的端到端耗时

## 测试环境

| 项目 | 配置 |
|---|---|
| 项目路径 | `/Users/caic/code/litellm` |
| Presidio 版本 | 2.2.364 |
| Analyzer 镜像 | `ghcr.io/data-privacy-stack/presidio-analyzer:latest` |
| Analyzer 镜像摘要 | `sha256:ae8f6f111ac2f04e3fec552f7f80edd0dcbfa2dd69ee1b9e030475be31669885` |
| Analyzer 端口 | `127.0.0.1:5002` |
| 服务进程 | Gunicorn sync worker，1 个 worker |
| NLP 引擎 | spaCy，`en_core_web_lg` 3.8.0 |
| LiteLLM Analyze 分块上限 | 500,000 JSON 编码字节 |
| 分块重叠 | 4,096 字符 |
| LiteLLM 分块并发上限 | 8 |
| 容器内存上限 | 7.748 GiB |

虽然 LiteLLM 可以并发提交最多 8 个 Analyze 分块，但 Analyzer 容器只有一个 sync worker，因此分块会在服务端排队，无法获得真正的并行处理收益

## 测试数据

测试数据来自 `ai4privacy/open-pii-masking-500k-ai4privacy` 数据集的 `source_text` 字段，并拼接为项目根目录下的 `presidio_1m_test.txt`

| 项目 | 数值 |
|---|---:|
| 完整文件 token 数 | 1,000,000 |
| Tokenizer | `cl100k_base` |
| 完整文件字符数 | 2,972,625 |
| 完整文件 UTF-8 大小 | 3,249,895 bytes |
| 完整文件 SHA-256 | `162d7d79638d9de2f72710654d868bb672bb1327c5bc7e711df9f69c41b71777` |

各测试输入均从完整文件开头按 tokenizer 结果精确截取。测试规模为 100K、250K、500K、750K 和 900K token

## 隐私识别配置

Analyze 请求只检测以下实体类型：

- `PERSON`
- `EMAIL_ADDRESS`
- `PHONE_NUMBER`
- `CREDIT_CARD`

测试直接调用 LiteLLM 的 `_OPTIONAL_PresidioPIIMasking.analyze_text`，因此覆盖以下逻辑：

- JSON 编码长度计算
- 超大文本分块
- 4,096 字符边界重叠
- 分块请求调度
- Presidio Analyzer 处理
- 分块结果坐标回映射
- 重叠检测结果合并

测试不执行以下逻辑：

- Presidio Anonymizer
- 输入内容替换或加密
- LiteLLM Proxy HTTP 请求解析和鉴权
- 模型路由
- 大模型调用
- 输出隐私过滤

## 测试方法

每个输入规模连续执行 3 次 Analyze。Presidio 服务在测试前已经加载完成，因此结果代表热态稳定运行性能，不代表首次启动时的冷启动性能

每次运行使用相同输入和实体配置，并记录 Analyze 总耗时及合并后的检测实体数量。汇总结果报告最小值、P50、最大值和基于 P50 计算的 token 吞吐

## 测试结果

| 输入 token | UTF-8 大小 | 分块数 | 检测实体 | 最小耗时 | P50 | 最大耗时 | P50 吞吐 |
|---:|---:|---:|---:|---:|---:|---:|---:|
| 100,000 | 326,122 bytes | 1 | 3,224 | 6.496s | 6.893s | 7.231s | 14,507.5 token/s |
| 250,000 | 814,913 bytes | 2 | 8,127 | 19.975s | 20.245s | 20.483s | 12,348.6 token/s |
| 500,000 | 1,614,412 bytes | 4 | 15,954 | 39.758s | 40.004s | 41.236s | 12,498.7 token/s |
| 750,000 | 2,429,862 bytes | 6 | 24,194 | 64.145s | 64.317s | 64.805s | 11,660.9 token/s |
| 900,000 | 2,929,372 bytes | 7 | 29,129 | 77.582s | 77.835s | 78.168s | 11,562.9 token/s |

### 单次原始结果

| 输入 token | 第 1 次 | 第 2 次 | 第 3 次 |
|---:|---:|---:|---:|
| 100,000 | 6.496s | 6.893s | 7.231s |
| 250,000 | 20.245s | 19.975s | 20.483s |
| 500,000 | 40.004s | 41.236s | 39.758s |
| 750,000 | 64.145s | 64.317s | 64.805s |
| 900,000 | 77.835s | 78.168s | 77.582s |

## 结果分析

100K token 输入保持在单个 Analyze 请求内，P50 为 6.893 秒。250K token 输入开始触发分块，P50 增加到 20.245 秒

从 250K 到 900K token，耗时总体接近线性增长。稳定吞吐从约 12,349 token/s 下降到约 11,563 token/s，输入越大，分块重叠、请求编解码和结果合并带来的成本越明显

三次运行的检测数量完全一致。各规模最大值与最小值差异较小，说明单请求、无外部竞争时的重复性较好

当前环境可以使用以下粗略估算进行容量规划：

```text
Analyze耗时约为每10万token增加8至9秒
```

该估算适用于本报告中的数据分布、实体配置、单 worker 容器和热态运行环境。不同语言、实体密度、正则复杂度、NLP 模型和硬件会改变结果

## 已知限制

本次测试数据包含较高密度的合成隐私信息，可能比普通对话请求产生更多检测结果，因此不能代表所有生产流量

本次测试只运行一个客户端请求，没有测量多个用户请求并发时的队列延迟。当前单 worker Analyzer 在并发请求下预计会出现明显排队

测试没有采集逐秒 CPU 和内存峰值，也没有对 Docker Desktop 虚拟机调度开销进行单独校正

本次测试未包含 Anonymize。此前使用完整 1M token 文本执行完整过滤时，Analyze 可以完成，但 Anonymizer 对完整原文和 32,417 个检测结果处理超过 Gunicorn 默认 30 秒 timeout，最终返回 HTTP 500

## 优化建议

优先增加 Analyzer worker 数量，使 LiteLLM 的分块并发可以在服务端并行执行。增加 worker 会复制 spaCy 模型内存，需要同时观察容器内存峰值和吞吐收益

应分别测试 1、2、4 和 8 个 Analyzer worker，并在每种配置下重复本报告的输入规模测试。最终配置需要同时考虑单请求延迟、并发吞吐和内存使用

对于完整隐私过滤，需要先解决 Anonymize 不分块的问题。单纯提高 Gunicorn timeout 只能避免过早终止，不能解决超大请求的延迟、内存和故障恢复问题

生产容量规划还应增加并发 2、4、8 请求测试，并至少记录 P50、P95、P99、CPU、RSS、队列等待时间和失败率

## 结论

当前单 worker Presidio Analyzer 可以稳定处理小于 1M token 的输入，但大输入延迟较高。100K token 的 Analyze P50 为 6.893 秒，500K token 为 40.004 秒，900K token 为 77.835 秒

当前部署更适合低并发离线处理或后台任务。若用于同步在线请求，需要通过增加 Analyzer worker、限制单次输入大小或异步化隐私扫描来控制用户可见延迟
