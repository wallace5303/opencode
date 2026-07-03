---
title: Providers
sidebar_position: 2
---

# Providers（模型供应方）

opencode 通过统一的 `Provider` 抽象对接多家模型供应方。所有 provider 在 `packages/opencode/src/provider/provider.ts` 的 state 初始化里注册。

## 支持的 Provider

注册的 provider 块（`provider.ts` state 初始化，约 `:1100-1629`）：

- **anthropic** — Claude 系列
- **openai** — GPT 系列
- **bedrock** — AWS Bedrock
- **google** — Gemini
- **gcp_vertex** — Vertex AI 上的 Gemini
- **gitlab** — GitLab Duo
- **cloudflare** — Workers AI
- **sap** — SAP AI Core
- **snowflake** — Cortex

每个块含 `id` / `autoload` / `auth` / `options` / `getModel`。

## 模型元数据来源

provider 的 `catalog` 不是手写列表，而是来自 **models.dev**：

- core 的 `ModelsDev` 服务（`packages/core/src/models-dev.ts:121`，`@opencode/v2/ModelsDev`）拉取 provider/model 元数据
- opencode 的 `provider/provider.ts:1318` 用 `mapValues(modelsDev, fromModelsDevProvider)` 映射成 `catalog`
- `fromModelsDevModel()`（`:1188`）把 ModelsDev.Model 转成 `Provider.Model`

`Provider.Model` Schema（`provider.ts:1018`）：`providerID` / `api` / `capabilities` / `cost` / `limit` / `status`。`status` 取自 `ModelStatus`（`provider/model-status.ts`）：`alpha` / `beta` / `deprecated` / `active`。

> 新增 provider：优先给 [models.dev](https://github.com/anomalyco/models.dev) 提 PR，而不是改 opencode 代码。

## 模型解析

业务侧 `Provider.catalog` 来自 ModelsDev；runner 侧解析走 core：

- `packages/core/src/session/runner/model.ts:172` 的 `resolve(session)` 查 core 的 `Catalog` 服务（`packages/core/src/catalog.ts:62`，`@opencode/v2/Catalog`）
- 再用 `fromCatalogModel()` 转成 AI SDK `LanguageModel`
- `provider/provider.ts:1639` 的 `resolveSDK()` 把 `Model` 映射到 AI SDK 实例

插件可通过 `ctx.catalog.transform`（`packages/core/src/plugin/models-dev.ts:142`）注入或修改 provider/model 元数据。

## 认证

`ProviderAuth` 服务（`provider/auth.ts:90`）暴露 `methods()` / `authorize()` / `callback()`：

- 认证类型（`auth.ts:41` 的 `Method`）：`oauth` 或 `api`
- `authorize` 在各 provider 块里被 `dep.auth(input.id)` 调用，**优先取环境变量**，fallback 到 auth key / OAuth token
- OAuth 流程由 `ProviderAuth.layer`（`auth.ts:109`）统一处理，依赖 `Auth.Service` + `Plugin.Service`

### CLI 认证命令

```bash
opencode providers list            # 查看认证状态
opencode providers login [url]     # OAuth 登录
opencode providers logout [provider]
```

详见 [CLI 命令](./cli-commands.md#provider-与模型)。

## 消息转换

不同 provider 的 SDK 消息格式有差异。`provider/transform.ts:430` 的 `message()` 把 opencode 内部消息适配到具体 provider SDK。

## 相关文档

- 运行时侧文件清单：[运行时子系统](../runtime-subsystems.md#provider--llm-provider)
- Catalog 与配置：[config](./config.md)
- 术语：Model Request Options / Generation Controls → [术语表](../glossary.md)
