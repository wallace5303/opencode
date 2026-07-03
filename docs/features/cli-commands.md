---
title: CLI 命令
sidebar_position: 1
---

# CLI 命令

opencode 的 CLI 既是开发入口（`bun dev`），也是发布产物（`opencode`）。所有子命令注册在 `packages/opencode/src/index.ts:81-103`。下面按用途分组。

## 交互与非交互运行

| 命令 | 用途 | 关键参数 |
|---|---|---|
| `opencode`（默认） | 启动 TUI | `--model/-m`、`--continue/-c`、`--session/-s`、`--fork`、`--prompt`、`--agent`、`--auto`、`--mini` |
| `opencode run [message..]` | 非交互跑一条消息（`--mini` 交互、`--attach` 远程） | `--command`、`--continue/-c`、`--session/-s`、`--fork`、`--share`、`--model/-m`、`--agent`、`--format`、`--file/-f`、`--title`、`--attach`、`--dir`、`--interactive/-i`、`--auto`、`--demo` |
| `opencode attach <url>` | 连到远程 opencode 服务 | `--dir`、`--continue/-c`、`--session/-s`、`--fork`、`--password/-p`、`--username/-u`、`--mini` |

文件：`cli/cmd/tui.ts:72`、`cli/cmd/run.ts:126`、`cli/cmd/attach.ts:7`。

## 服务端

| 命令 | 用途 |
|---|---|
| `opencode serve` | 启动无头 HTTP 服务（默认 4096，`--port` 可改） |
| `opencode web` | 启动服务并打开浏览器界面 |
| `opencode acp` | 启动 ACP（Agent Client Protocol）服务，供外部 agent 客户端经 NDJSON 流接入 |

文件：`cli/cmd/serve.ts:6`、`cli/cmd/web.ts:31`、`cli/cmd/acp.ts:9`。

## 会话管理

| 命令 | 用途 |
|---|---|
| `opencode session list` | 列出会话（`--max-count/-n`、`--format`） |
| `opencode session delete <sessionID>` | 删除会话 |
| `opencode export [sessionID]` | 导出会话为 JSON（`--sanitize`） |
| `opencode import <file>` | 从 JSON 文件或分享 URL 导入会话 |
| `opencode pr <number>` | checkout PR 并在该分支上跑 opencode |

文件：`cli/cmd/session.ts:44`、`cli/cmd/export.ts:222`、`cli/cmd/import.ts:83`、`cli/cmd/pr.ts:8`。

## Provider 与模型

| 命令 | 用途 |
|---|---|
| `opencode providers list` / `ls` | 列出 provider 及认证状态 |
| `opencode providers login [url]` | 登录某 provider（OAuth） |
| `opencode providers logout [provider]` | 登出 |
| `opencode models [provider]` | 列出可用模型（`--verbose`、`--refresh`） |

文件：`cli/cmd/providers.ts:239`、`cli/cmd/models.ts:8`。

## Agent 与 Skill

| 命令 | 用途 |
|---|---|
| `opencode agent list` | 列出 agent |
| `opencode agent create` | 生成新 agent（`--path`、`--description`、`--mode`、`--permissions`、`--model/-m`） |

文件：`cli/cmd/agent.ts:254`。Skill 通过配置发现，无独立 CLI 子命令，见 [agents-and-skills](./agents-and-skills.md)。

## MCP

`opencode mcp` 管理 MCP 服务：`add` / `list` / `auth` / `logout` / `debug`。文件：`cli/cmd/mcp.ts:95`。详见 [agents-and-skills](./agents-and-skills.md#mcp)。

## 插件

`opencode plugin <module>`（别名 `plug`）安装插件并更新配置（`--global/-g`、`--force/-f`）。文件：`cli/cmd/plug.ts:178`。

## 账户与统计

| 命令 | 用途 |
|---|---|
| `opencode console login [url]` / `logout [email]` / `switch` / `orgs` / `open` | 管理 console 账户 |
| `opencode stats` | 显示 token/cost 统计（`--days`、`--tools`、`--models`、`--project`） |

文件：`cli/cmd/account.ts:237`、`cli/cmd/stats.ts:49`。

## GitHub 集成

`opencode github install` 安装 GitHub agent；`opencode github run --event --token` 处理事件。文件：`cli/cmd/github.ts:37`。

## 维护

| 命令 | 用途 |
|---|---|
| `opencode upgrade [target]` | 升级（`--method/-m`：curl/npm/pnpm/bun/brew/choco/scoop） |
| `opencode uninstall` | 卸载（`--keep-config/-c`、`--keep-data/-d`、`--dry-run`、`--force/-f`） |
| `opencode generate` | 从 OpenAPI spec 生成 SDK 代码示例（输出 JSON） |
| `opencode db [query]` | 数据库查询工具（`--format json/tsv`；子命令 `path`） |
| `opencode debug` | 调试子命令集合 |

文件：`cli/cmd/upgrade.ts:8`、`cli/cmd/uninstall.ts:25`、`cli/cmd/generate.ts:5`、`cli/cmd/db.ts:54`、`cli/cmd/debug/`。

## 开发期等价

开发时把 `opencode` 换成 `bun dev`，参数完全一致：

```bash
bun dev                 # = opencode（TUI）
bun dev serve           # = opencode serve
bun dev web             # = opencode web
bun dev run "修个 bug"  # = opencode run
bun dev .               # 对着仓库根目录跑 TUI
```

详见 [工程基建](../tooling.md#常用命令)。
