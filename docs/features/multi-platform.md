---
title: 多端
sidebar_position: 7
---

# 多端（TUI / Web / Desktop / SDK）

opencode 同一份业务内核，多个表面：终端、浏览器、桌面、嵌入式。所有表面共享 `packages/app` 的 SolidJS 组件，通过 SDK/客户端连到 server。

## 形态一览

| 形态 | 启动命令 | 包 |
|---|---|---|
| TUI（终端） | `opencode` / `bun dev` | `opencode`（含 `cli/cmd/tui/`）+ `tui` |
| 无头 server | `opencode serve` / `bun dev serve` | `opencode`（`server/`） |
| Web UI | `bun dev web` | `opencode` server + `app` + `web` |
| Desktop | `bun --cwd packages/desktop dev` | `desktop`（Electron 包 `app`） |
| SDK（库） | — | `sdk` / `sdk-next` |
| ACP | `opencode acp` | `opencode`（`acp/`） |

## 共享契约：HttpApi

所有远程表面都走同一份 HttpApi 契约（`packages/protocol/src/api.ts` 的 `makeDefaultApi`），server 实现，客户端生成。详见 [客户端与 UI](../clients-and-ui.md)。

## TUI

TUI 不是传统终端库，而是 **SolidJS + [opentui](https://github.com/sst/opentui)**——在终端里跑响应式组件树，代码风格和 Web 端一致。

- 入口：`packages/opencode/src/cli/cmd/tui.ts:72`
- 组件：`packages/opencode/src/cli/cmd/tui/`
- 配置：`TuiConfig`（`config/tui.ts`），含 `tui-migrate.ts`（旧配置迁移）

TUI 通过 SDK 连本地或远程 server。

## Web UI

```bash
bun dev serve                 # 1. 先起无头 server（4096）
bun run --cwd packages/app dev # 2. 再起 Web UI
```

`app` 包提供共享 SolidJS 组件，`web` 包是 Web 端组装。两者通过生成的 client 调 HttpApi。

## Desktop

`desktop` 包用 Electron 包 `app`。运行时依赖全是 electron 相关（dev 依赖 `app`/`ui`）。

```bash
bun --cwd packages/desktop dev
```

## SDK

| 包 | 角色 |
|---|---|
| `client` | 从 HttpApi 生成的纯客户端（Promise + Effect 两套），运行时只依赖 `schema`/`protocol` |
| `sdk` | 旧版 JS SDK |
| `sdk-next` | 新一代 SDK，组合 `client` + `core` + `server` |

### Embedded OpenCode

`sdk-next` 的关键能力：用 **in-memory `HttpClient`** 直接打同一套路由与 handler，不经过真实网络。把 opencode 当库嵌进任意 TS 应用，无需起独立 server 进程。

术语上（`CONTEXT.md`）：

- **OpenCode Client** — 从 HttpApi 派生的 Promise/Effect API
- **Embedded OpenCode** — 同进程宿主，结构上扩展 OpenCode Client，提供 in-memory HTTP 传输 + 额外同进程能力
- **SDK Contract IR** — 运行时中性的契约编译表示，让不同 SDK emitter 自选公开值模型

## 远程连接

`opencode attach <url>` 连到远程 opencode 服务（`cli/cmd/attach.ts:7`），支持 `--password`/`--username` 认证、`--continue`/`--session`/`--fork` 恢复会话。这让"本地 TUI + 远程 server"成为可能。

## 多端分层边界

- UI 包**不能**直接 `import` `core`/`server` 运行时代码
- 需要新能力 → 下沉到 `protocol` 契约 → 生成到 `client` → UI 用
- 同进程嵌入 → 用 `sdk-next` 的 Embedded OpenCode，别起 server 再 HTTP 自连

详见 [客户端与 UI](../clients-and-ui.md#分层边界再强调)。

## 相关文档

- 客户端与 SDK 全景：[客户端与 UI](../clients-and-ui.md)
- CLI 命令：[cli-commands](./cli-commands.md)
- server 实现：[运行时子系统](../runtime-subsystems.md#server--http-服务器与-httpapi)
