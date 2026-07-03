---
title: 会话管理
sidebar_position: 5
---

# 会话管理

会话（Session）是 opencode 的核心持久化单位。这章讲业务侧的功能：创建/恢复、fork、revert、compaction、分享、worktree。运行时内核见 [Session V2 深度](../session-v2-deep-dive.md)。

## 创建与恢复

- 新会话：`opencode`（TUI）或 `opencode run` 创建
- 恢复：`opencode --continue`（最近一条）或 `opencode --session <id>`（指定）
- fork：`opencode --fork` 从某会话分叉

底层 `SessionV2.prompt`（`packages/core/src/session.ts:360`）admit 一条 `session_input` 后唤醒执行，详见 [Session V2 深度](../session-v2-deep-dive.md)。

## Fork

`Session.fork(input)`（`packages/opencode/src/session/session.ts:693-734`）：

- 输入 `{ sessionID, messageID? }`
- 创建新 session，深度拷贝所有消息到新 session（含 ID 重映射）
- 标题追加 `(fork #N)`

可选 `messageID` 从某条消息处分叉，而非整条会话。

## Revert

`SessionRevert.revert(input)`（`packages/opencode/src/session/revert.ts:38-88`）：

- 输入 `{ sessionID, messageID, partID? }`
- 找到目标消息/部分，snapshot 当前文件状态
- 恢复到 revert 点之前的 snapshot，patch 回后续修改
- `unrevert()`（`:90-98`）恢复到 revert 前的 snapshot

V2 版 revert 在 core：`packages/core/src/session/revert.ts`。

## Compaction（压缩）

会话变长后，opencode 自动压缩历史以控制上下文长度。入口 `SessionCompaction`（`packages/opencode/src/session/compaction.ts`）：

| 函数 | 行 | 用途 |
|---|---|---|
| `process(input)` | `:289-511` | 触发压缩流程 |
| `create(input)` | `:513-536` | 创建压缩 |
| `select` | `:188-239` | 选取需压缩的历史消息 |
| `prune` | `:243-287` | 裁剪 tool output |

流程：

1. `select` 选取要压缩的历史消息，保留最近 N 个 turn（`tail_turns`，默认 2）
2. 用内置 **compaction agent**（见 [agents-and-skills](./agents-and-skills.md)）对历史生成摘要
3. 创建 `type: "compaction"` part 标记压缩点
4. overflow 时删除 media 并自动继续

runner 侧在每次 turn 检查：`compactIfNeeded`（`runner/llm.ts:210`）、overflow 走 `compactAfterOverflow`（`:281`）。

## 分享（Share）

把会话发到远程，生成公开链接。

### 文件

| 文件 | 职责 |
|---|---|
| `share/session.ts` | SessionShare Service（create/share/unshare） |
| `share/share-next.ts` | ShareNext Service（实际上传/同步/删除） |

### 分享（`share/session.ts:26-32`）

1. `shareNext.create(sessionID)` 向远程 API POST 创建分享
2. API 返回 `{ id, url, secret }`，写入本地 `SessionShareTable`
3. `session.setShare()` 更新 session 元数据里的 url

公开链接格式：`https://opncd.ai/share/<slug>`（或 console API `/api/shares/<id>/data`）。

### 自动分享

`share=auto` 配置或 `autoShare` 标志时（`share/session.ts:39-46`），新 session 创建后自动 fork 分享。

### 实时同步

`ShareNext`（`share/share-next.ts:124-147`）监听 session/message/part 更新事件，入队后 `flush()`（`:247-272`）增量 PATCH 到远程 `/api/shares/:id/sync`。

### 导入

`opencode import <file|url>`（`cli/cmd/import.ts:83-224`）：

1. URL 解析提取 slug（`:28-31`）
2. GET `/api/shares/:id/data` 取扁平数组（session/message/part）
3. `transformShareData()`（`:49-79`）重组为嵌套结构
4. 写入本地数据库

## Worktree

基于 git worktree 的并行开发——每个 worktree 一个独立工作目录，共享同一个仓库。

`Worktree` 服务（`packages/opencode/src/worktree/index.ts:119`）：

| 操作 | 行 | 行为 |
|---|---|---|
| `create` | `:289-292` | 生成唯一名称/分支，`git worktree add` 建目录，boot 项目实例，跑 start 命令 |
| `list` | `:333-359` | `git worktree list --porcelain` 解析，排除主 worktree |
| `remove` | `:388-449` | `git worktree remove --force` + 删对应分支（`git branch -D`） |
| `reset` | `:525-611` | 非主 worktree：fetch + `reset --hard` 到默认分支、clean、submodule update、跑 start scripts |

存储路径：`Global.Path.data/worktree/<projectID>/<name>`。

## ACP（Agent Client Protocol）

ACP 让外部 agent 客户端经 **stdin/stdout 的 NDJSON 流**接入 opencode，执行 `initialize` / `newSession` / `loadSession` / `prompt` / `cancel` / `forkSession` / `setSessionModel` 等操作。

- 入口 `ACP.init({ sdk })`（`packages/opencode/src/acp/agent.ts:24-30`）创建 `Agent` 实例，绑到 `AgentSideConnection`
- CLI：`opencode acp`（`cli/cmd/acp.ts:9-73`）起 HTTP server + SDK client + NDJSON stream
- 文件：`acp/` 下有 `agent.ts` / `service.ts` / `session.ts` / `tool.ts` / `permission.ts` / `profile.ts` / `event.ts` / `content.ts` / `usage.ts` 等

## Project 与 VCS

会话运行在某个 Project 实例上。

- **Project** 服务（`project/project.ts:83`）：`fromDirectory`（`:213-310`）发现/初始化项目
- **Bootstrap**（`project/bootstrap.ts:17-50`）：初始化顺序 Config → Plugin →（LSP / ShareNext / Format / Vcs / Snapshot / Project 并发）
- **VCS**（`project/vcs.ts:281`）：`branch()` / `defaultBranch()` / `status()` / `diff(mode)` / `diffRaw()` / `apply(patch)`，支持 git 和 branch 两种 diff 模式，watch HEAD 变化发 `BranchUpdated` 事件
- **InstanceContext**（`project/instance-context.ts:6`）：`{ directory, worktree, project }`，`containsPath()` 判断路径是否在项目边界内

## 相关命令

```bash
opencode session list          # 列会话
opencode session delete <id>   # 删会话
opencode export [sessionID]    # 导出 JSON
opencode import <file|url>     # 导入
opencode pr <number>           # checkout PR 并跑
```

详见 [CLI 命令](./cli-commands.md#会话管理)。

## 相关文档

- 运行时内核：[Session V2 深度](../session-v2-deep-dive.md)
- Agent 与 compaction agent：[agents-and-skills](./agents-and-skills.md)
- 术语：Admitted Prompt / Provider Turn / Session Drain → [术语表](../glossary.md)
