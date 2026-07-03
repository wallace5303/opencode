---
title: 工具与权限
sidebar_position: 3
---

# 工具与权限

工具是 agent 落地操作的接口。opencode 的工具系统统一注册、统一拦截（权限 + 截断），插件和内置工具走同一套机制。

## 工具注册

`ToolRegistry` 服务（`packages/opencode/src/tool/registry.ts:80`，`@opencode/ToolRegistry`）：

- 接口（`:69`）：`all` / `ids` / `tools` / `named` / `describeTask`
- builtin 工具在 state 初始化（`registry.ts:198-218`）时实例化
- 插件工具由 `fromPlugin()`（`registry.ts:110`）把 `Plugin.ToolDefinition` 转成 `Tool.Def` 追加

`Tool.define()`（`tool.ts:151`）是定义工厂；`Tool.Def`（`tool.ts:63`）含 `id` / `description` / `parameters` / `execute`。

注册时 `Tool.init()` 把每个 `DefWithoutID` 包装成带拦截的 `Def`：执行前做 **permission 检查**，执行后做 **Truncate 截断**。

## 内置工具

| 工具 | 文件 | 用途 |
|---|---|---|
| `read` | `tool/read.ts` | 读文件 |
| `write` | `tool/write.ts` | 写文件 |
| `edit` | `tool/edit.ts` | 编辑文件（字符串替换） |
| `apply_patch` / `patch` | `tool/apply_patch.ts` / `tool/patch.ts` | 应用 patch |
| `shell` | `tool/shell.ts`（含 `shell/prompt.ts`、`shell/id.ts`） | 执行 shell 命令 |
| `glob` | `tool/glob.ts` | 文件名匹配 |
| `grep` | `tool/grep.ts` | 内容搜索 |
| `lsp` | `tool/lsp.ts` | LSP 诊断/符号 |
| `fetch` / `webfetch` | `tool/webfetch.ts` | 抓取网页 |
| `search` / `websearch` | `tool/websearch.ts` / `mcp-websearch.ts` | 网页搜索 |
| `task` | `tool/task.ts` | 子任务 |
| `todo` | `tool/todo.ts` | 待办清单 |
| `plan` | `tool/plan.ts` | 规划 |
| `skill` | `tool/skill.ts` | 调用 skill |
| `question` | `tool/question.ts` | 向用户提问 |
| `invalid` | `tool/invalid.ts` | 占位/无效工具 |

## 执行流程

```
模型返回 tool_call
  → runner 的 toolMaterialization.settle()
  → ToolRegistry 查 tool
  → tool.execute(args, ctx)
      ├─ decode args
      ├─ Permission.ask(permission, pattern)   ← 拦截
      ├─ 真正执行
      └─ Truncate.output(result)               ← 截断
  → 结果作为 Model Tool Output 持久化进 Session History
```

`execute` 的 `ctx` 含 `sessionID` / `messageID` / `permission` / `agent`。

## 输出截断（Model Tool Output）

工具输出可能很大。`Truncate` 服务（`tool/truncate.ts:33`，`@opencode/Truncate`）：

- `limits()`（`:42`）读 config `tool_output.max_lines/max_bytes`，默认 `MAX_LINES=2000`、`MAX_BYTES=50KB`（`truncate.ts:15-16`）
- 超出时 `output()`（`:86-150`）把全文写入临时文件，返回截断预览 + `outputPath`
- `Result` 类型（`:20`）：`{ content, truncated: true, outputPath }` 或 `{ content, truncated: false }`
- 截断提示模板在 `:130`

## Managed Tool Output File

超限的全文写到 `TRUNCATION_DIR`（`tool/truncation-dir.ts:4`）= `$DATA/tool-output`：

- `Truncate.write()`（`truncate.ts:69`）写到 `path.join(TRUNCATION_DIR, ToolID.ascending())`
- `Truncate.cleanup()`（`:58`）在 session 结束时清理目录

这就是 `CONTEXT.md` 里 **Managed Tool Output File** 的落地——保留完整输出供后续查阅，而回放给模型的是有界投影（**Model Tool Output**）。

## 权限模型

`Permission` 服务（`packages/opencode/src/permission/index.ts:40`，`@opencode/Permission`）：

### 评估

`evaluate(permission, pattern, ...rulesets)`（`index.ts:28`）：

- 遍历所有 rulesets（session ruleset + approved rules）
- 用 `Wildcard.match()` 做 `permission` + `pattern` 双重匹配
- 取 `findLast` 命中规则，默认 `{ action: "allow" }`

### 请求流程

- `ask()`（`:67`）：先 evaluate，**deny 直接抛 `DeniedError`**；否则挂起 pending 等 `reply()`
- `reply()`（`:109`）：`approve` / `deny` / `correct`
- `fromConfig()`（`:186`）：从 `ConfigPermissionV1.Info` 构建 ruleset

### Bash arity 判断

`BashArity`（`permission/arity.ts:163`）提供约 **130 条**常用 shell 命令的参数 arity，如 `git:2`、`npm:2`、`npm install:2`、`npm run:3`。`prefix()`（`:1`）从命令 token 序列截取匹配 arity 的前缀，用于权限 pattern 匹配——这样 `npm run build` 和 `npm run` 能命中不同规则。

## 子 Agent 权限

`deriveSubagentSessionPermission()`（`agent/subagent-permissions.ts:14`）：

- 从 parent session 继承 `deny` + `external_directory` 规则
- 若 subagent 没有 `task` / `todowrite` 权限则自动 deny

详见 [agents-and-skills](./agents-and-skills.md#子-agent-权限)。

## 相关文档

- 工具在 runner 中的调用：[Session V2 深度](../session-v2-deep-dive.md)
- 术语：Model Tool Output / Managed Tool Output File / PTY Environment → [术语表](../glossary.md)
- MCP 工具如何接入：[agents-and-skills](./agents-and-skills.md#mcp)
