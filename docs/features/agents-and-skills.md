---
title: Agent、Skill 与 MCP
sidebar_position: 4
---

# Agent、Skill 与 MCP

三者关系：**Agent** 决定"用哪个模型、有哪些工具、什么权限、什么 system prompt"；**Skill** 是可被 agent 调用的、打包好的 prompt 能力；**MCP** 让外部工具服务以标准协议接入，变成 agent 可用的工具。

## Agent

`Agent` 服务（`packages/opencode/src/agent/agent.ts:84`，`@opencode/Agent`）。

### 定义

`Info` Schema（`agent.ts:35`）：`id` / `name` / `model` / `permission` / `tools` / `prompt` / `description`。

### 内置 Agent（`agent.ts:99`）

| id | 用途 | prompt 模板 |
|---|---|---|
| `explore` | 只读探查（不改文件） | `agent/prompt/explore.txt` |
| `compaction` | 会话压缩摘要 | `agent/prompt/compaction.txt` |
| `title` | 生成会话标题 | `agent/prompt/title.txt` |
| `summary` | 生成会话摘要 | `agent/prompt/summary.txt` |

config 的 `agent` section（`ConfigAgent.load()`）可合并覆盖，或新增自定义 agent。

### 生成新 Agent

`Agent.generate()`（`agent.ts:368`）用 LLM `generateObject` 从 prompt 生成 agent 定义，system prompt 由 `PROMPT_GENERATE`（`agent/generate.txt`）+ 插件 `experimental.chat.system.transform` hook 组成（`:380`）。

### 默认 Agent

`defaultAgent()`（`:342`）从 config 取默认 agent ID。

### 子 Agent 权限

`deriveSubagentSessionPermission()`（`agent/subagent-permissions.ts:14`）：

- 从 parent session 继承 `deny` + `external_directory` 规则
- 若 subagent 没有 `task` / `todowrite` 权限则自动 deny

### CLI

```bash
opencode agent list
opencode agent create --path --description --mode --permissions --model
```

## Skill

Skill 是"打包好的 prompt 能力"——一个带 frontmatter 的 `SKILL.md`，agent 通过 `skill` 工具调用它，把其正文注入 system prompt。

### 定义

每个 skill 是一个 `SKILL.md`，frontmatter 含 `{ name, description }`，正文为 prompt 内容。

- frontmatter 校验：`skill/index.ts:53-58`
- 加载到 state：`skill/index.ts:105-140`（`add` 函数）

### 发现与注册（`skill/index.ts:173-232`）

1. 扫描外部目录 `.claude/skills`、`.agents/skills` 和 opencode 配置目录
2. 扫描 config 的 `skills.paths` 和 `skills.urls`
3. 远程 URL 调 `Discovery.pull(url)`（`skill/discovery.ts:49-132`）下载 `index.json` 里列的 skill 文件到缓存
4. 对所有匹配的 `SKILL.md` 调 `add()` 解析注册
5. 内置 skill `customize-opencode` 硬编码注入（`:278-283`）

### 与 Agent 的关系

- `available(agent?)`（`:310-315`）按 agent 的 permission 过滤 skill 列表，用 `Permission.evaluate("skill", skill.name, agent.permission)` 决定是否可用
- skill 内容作为 system prompt 的一部分注入 LLM 请求

> Skill 没有独立 CLI 子命令，通过配置 `skills.paths` / `skills.urls` 发现。

## MCP

MCP（Model Context Protocol）让外部工具服务以标准协议接入 opencode，变成 agent 可用的工具。

### 服务文件

| 文件 | 职责 |
|---|---|
| `mcp/index.ts` | MCP Service 核心（连接/状态/工具/OAuth） |
| `mcp/catalog.ts` | 工具定义获取与转 AI SDK Tool |
| `mcp/auth.ts` | OAuth token 存储 |
| `mcp/oauth-provider.ts` | OAuth 认证流程 |
| `mcp/oauth-callback.ts` | OAuth 回调 HTTP 服务 |

### 注册流程（`mcp/index.ts:484-551`）

1. 从 config 的 `mcp` 字段读所有服务配置
2. 对每个配置调 `create()`（`:364-407`）：
   - **local** 类型 → `StdioClientTransport`（`:332-362`）
   - **remote** 类型 → `StreamableHTTPClientTransport` 或 `SSEClientTransport`（`:228-330`）
3. 连接后调 `McpCatalog.defs()` 取工具列表，并 watch `tool-list-changed` 通知

### 工具转换

`mcp/catalog.ts:42-83` 的 `convertTool()` 把 MCP 工具定义转成 AI SDK 的 `dynamicTool`，命名规则 `clientName_toolName`。这样 MCP 工具就和内置工具一样进 `ToolRegistry`，受同一套权限与截断约束。

### OAuth

远程 MCP 可能要 OAuth（`mcp/index.ts:865-950`），回调由 `mcp/oauth-callback.ts` 起的 HTTP 服务接收，token 存在 `mcp/auth.ts`。

### CLI

```bash
opencode mcp add        # 添加 MCP 服务
opencode mcp list       # 列出
opencode mcp auth       # OAuth 认证
opencode mcp logout
opencode mcp debug
```

文件：`cli/cmd/mcp.ts:95`。

## 相关文档

- 工具执行与截断：[tools](./tools.md)
- 权限模型：[tools](./tools.md#权限模型)
- 运行时侧 agent 文件：[运行时子系统](../runtime-subsystems.md#agent--agent-定义)
