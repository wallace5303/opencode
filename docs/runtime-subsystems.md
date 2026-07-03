---
title: 运行时子系统
sidebar_position: 5
---

# 运行时子系统

这章把 `packages/opencode/src` 下五个核心子系统的关键文件与入口列出来，作为读代码的导航图。Session 的**运行时内核**在 core 包，深度拆解见 [Session V2 深度](./session-v2-deep-dive.md)；本章聚焦 opencode 包的业务侧。

> 提醒：opencode 包是"**跑什么**"（业务编排、工具实现、provider 注册），core 包是"**怎么跑一次会话**"（admission/execution/runner）。见 [架构分层](./architecture.md)。

## provider/ — LLM Provider

| 文件 | 职责 |
|---|---|
| `provider/provider.ts:1129` | `Provider.Interface` — list/getProvider/getModel/catalog |
| `provider/provider.ts:1151` | `Provider.Service`（`@opencode/Provider`） |
| `provider/provider.ts:1018` | `Model` Schema — providerID/api/capabilities/cost/limit/status |
| `provider/provider.ts:1188` | `fromModelsDevModel()` — ModelsDev → Provider.Model |
| `provider/provider.ts:1318` | catalog 构建：`mapValues(modelsDev, fromModelsDevProvider)` |
| `provider/provider.ts:1639` | `resolveSDK()` — Model → AI SDK 实例 |
| `provider/auth.ts:90` | `ProviderAuth.Interface` — methods/authorize/callback |
| `provider/model-status.ts` | `ModelStatus`：alpha/beta/deprecated/active |
| `provider/transform.ts:430` | `message()` — 消息转换适配各 provider SDK |
| `provider/error.ts` | 错误类型 |

**注册方式**：`provider.ts` 的 state 初始化里硬编码 per-provider 配置块（anthropic/openai/bedrock/google/gcp_vertex/gitlab/cloudflare/sap/snowflake…），每块含 `id`/`autoload`/`auth`/`options`/`getModel`。state 合并配置文件与 ModelsDev Catalog，产出 `catalog` 字段。

**模型解析**：opencode 的 `Provider.catalog` 来自 core 的 `ModelsDev` 服务；core 的 `session/runner/model.ts:172` 的 `resolve(session)` 查 core 的 `Catalog` 服务（`@opencode/v2/Catalog`），再用 `fromCatalogModel()` 转成 AI SDK `LanguageModel`。

**认证**：`ProviderAuth.authorize` 在各 provider 块里被 `dep.auth(input.id)` 调用，优先取环境变量，fallback 到 auth key / OAuth token。

> 新增 provider：优先给 [models.dev](https://github.com/anomalyco/models.dev) 提 PR，而不是改 opencode 代码。

## tool/ — 工具注册与实现

| 文件 | 职责 |
|---|---|
| `tool/tool.ts:63` | `Def` interface — id/description/parameters/execute |
| `tool/tool.ts:151` | `define()` 工具定义工厂 |
| `tool/registry.ts:69` | `ToolRegistry.Interface` — all/ids/tools/named/describeTask |
| `tool/registry.ts:80` | `ToolRegistry.Service`（`@opencode/ToolRegistry`） |
| `tool/registry.ts:110` | `fromPlugin()` — Plugin ToolDefinition → Tool.Def |
| `tool/registry.ts:198-218` | builtin 工具初始化列表 |
| `tool/truncate.ts:33` | `Truncate.Interface` — cleanup/write/output/limits |
| `tool/truncate.ts:15-16` | `MAX_LINES=2000` / `MAX_BYTES=50KB` |
| `tool/truncation-dir.ts:4` | `TRUNCATION_DIR = $DATA/tool-output` |

**builtin 工具**（`registry.ts:198`）：invalid / shell / read / glob / grep / edit / write / task / fetch / todo / search / skill / patch / question / lsp / plan。每个工具一个文件（`tool/read.ts`、`tool/shell.ts`…），导出 `ToolDef` 常量。

**注册流程**：`Tool.init(toolDef)` 把每个 `DefWithoutID` 包装成带拦截的 `Def`——执行前做 permission 检查，执行后做 truncate 截断。plugin 工具由 `fromPlugin()` 追加。

**Model Tool Output 大小限制**：`Truncate.limits()` 读 config `tool_output.max_lines/max_bytes`，默认 2000 行 / 50KB。超出时 `Truncate.output()` 把全文写入 `TRUNCATION_DIR` 并返回截断预览 + outputPath。

**Managed Tool Output File**：`TRUNCATION_DIR`（`$DATA/tool-output`）。`Truncate.write()` 把全文写到 `path.join(TRUNCATION_DIR, ToolID.ascending())`；`Truncate.cleanup()` 在 session 结束时清理。这就是 `CONTEXT.md` 里 **Managed Tool Output File** 的落地。

## agent/ — Agent 定义

| 文件 | 职责 |
|---|---|
| `agent/agent.ts:35` | `Info` Schema — id/name/model/permission/tools/prompt |
| `agent/agent.ts:64` | `Agent.Interface` — list/get/defaultInfo/defaultAgent/generate |
| `agent/agent.ts:84` | `Agent.Service`（`@opencode/Agent`） |
| `agent/agent.ts:99` | state 初始化：4 个内置 agent |
| `agent/agent.ts:214/224/248/263` | explore / compaction / title / summary 内置 agent |
| `agent/agent.ts:368` | `generate()` — 用 LLM `generateObject` 从 prompt 生成 agent 定义 |
| `agent/subagent-permissions.ts:14` | `deriveSubagentSessionPermission()` |
| `agent/prompt/*.txt` | 各 agent 的 prompt 模板 |

**内置 agent**：explore（只读探查）、compaction（会话压缩）、title（生成标题）、summary（生成摘要）。config 的 `agent` section（`ConfigAgent.load()`）可合并覆盖。

**子 agent 权限**：`deriveSubagentSessionPermission()` 从 parent session 继承 deny + external_directory 规则；若 subagent 没有 task/todowrite 权限则自动 deny。

## server/ — HTTP 服务器与 HttpApi

```
server/
  server.ts                 # 主入口 listen/startWithPortFallback
  routes/instance/httpapi/
    api.ts                  # RootHttpApi + InstanceHttpApi 组装
    server.ts               # HttpApiApp: createRoutes/webHandler
    groups/                 # 21 个 HttpApi Group 定义
    handlers/               # 21 个对应 handler 实现
    middleware/             # 9 个中间件
    websocket-tracker.ts    # WebSocket 连接生命周期
  shared/                   # server/client 共享类型
```

**关键入口**：

| 文件 | 行 | 说明 |
|---|---|---|
| `server/server.ts` | `:73` | `listen(opts)` 入口 |
| `server/server.ts` | `:117` | `startWithPortFallback`（4096 兜底） |
| `routes/instance/httpapi/api.ts` | `:54` | `RootHttpApi`（Control + ControlPlane + Global） |
| `routes/instance/httpapi/api.ts` | `:61` | `InstanceHttpApi`（Config/File/Instance/MCP/Permission/Project/Provider/Pty/Question/Session/Sync/Tui/Workspace…） |
| `routes/instance/httpapi/server.ts` | `:131-154` | 4 层路由：rootApi / eventApi / ptyConnectApi / instanceApi |
| `routes/instance/httpapi/server.ts` | `:271` | `createRoutes()` 组装所有 Layer |

**HttpApi Groups（21 个）**：config / control / control-plane / event / experimental / file / global / instance / mcp / metadata / permission / project-copy / project / provider / pty / question / query / session / sync / tui / workspace。

**中间件（9 个）**：authorization / compression / cors-vary / error / fence / instance-context / proxy / schema-error / workspace-routing。

**SSE**：`groups/event.ts:11` 定义 `subscribe` endpoint（`text/event-stream`），`handlers/event.ts:89` 用 `Queue.offerUnsafe` 推送事件。这是客户端实时拿 session 事件的通道。

**WebSocket**：`groups/pty.ts:139` 定义 `connect` endpoint，`websocket-tracker.ts` 管理连接生命周期。用于 PTY 交互。

## permission/ — 权限评估

| 文件 | 职责 |
|---|---|
| `permission/index.ts:28` | `evaluate(permission, pattern, ...rulesets)` 核心评估 |
| `permission/index.ts:67` | `ask()` — evaluate → deny 则抛错，否则挂起等 reply |
| `permission/index.ts:109` | `reply()` — approve/deny/correct |
| `permission/index.ts:186` | `fromConfig()` — ConfigPermissionV1 → ruleset |
| `permission/arity.ts:163` | `BashArity` — ~130 条 shell 命令的参数 arity |

**评估流程**：`evaluate()` 遍历所有 rulesets（session ruleset + approved rules），用 `Wildcard.match()` 做 permission + pattern 双重匹配，取 `findLast` 命中规则，默认 allow。`ask()` 先 evaluate，deny 直接抛 `DeniedError`，否则 deferred 等 `reply()`。

**arity 判断**：`BashArity` 提供约 130 条常用命令的参数 arity（如 `git:2`、`npm:2`、`npm install:2`、`npm run:3`）。`prefix()` 从命令 token 序列截取匹配 arity 的前缀，用于权限 pattern 匹配——这样 `npm run build` 和 `npm run` 能匹配到不同规则。

## config/ — 配置（自导出模式）

详见 [工程基建](./tooling.md#配置系统srcconfig)。核心：每个模块顶部 `export * as ConfigX from "./x"`。Catalog（模型元数据）在 core 包的 `catalog.ts` / `models-dev.ts`。

## storage/ — 存储与 `#db`

详见 [工程基建](./tooling.md#存储与-db)。`#db` 条件导入切换 Bun/Node 适配；`storage.ts` 是 JSON 文件存储 + migration；`schema.ts` re-export 所有 Drizzle 表（snake_case）。

## 串起来：一次工具调用的路径

```
用户在 TUI 输入 prompt
  → opencode/session/prompt.ts（业务入口）
  → core 的 SessionV2.prompt（admit + wake）
  → core 的 SessionExecution.local → SessionRunCoordinator → SessionRunner.run
  → runner/llm.ts: 一次 llm.stream
  → 模型返回 tool_call
  → toolMaterialization.settle() → ToolRegistry 找到 tool
  → tool execute（先 permission.ask，再 Truncate.output 截断）
  → 结果作为 Model Tool Output 持久化进 Session History
  → 回到 runner 继续 continuation 循环
```

每一步的 file:line 见 [Session V2 深度](./session-v2-deep-dive.md)。

## 进一步阅读

- 内核机制：[Session V2 深度](./session-v2-deep-dive.md)
- 分层：[架构分层](./architecture.md)
- 术语：ToolRegistry / Model Tool Output / Managed Tool Output File → [术语表](./glossary.md)
