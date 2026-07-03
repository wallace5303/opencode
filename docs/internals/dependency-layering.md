---
title: 分层约束如何落地
sidebar_position: 1
---

# 分层约束如何落地

[架构分层](../architecture.md) 给了铁律：`Schema → Core/Protocol → Server`，Client 只依赖 Schema/Protocol，`sdk-next` 组合三者。这章讲它**怎么被代码保证**，而不只是靠自觉。

## 三道防线

### 防线 1：`package.json` 的 dependencies vs devDependencies

运行时依赖由 `dependencies` 决定；`devDependencies` 只在开发/构建时存在，不进发布产物。

`packages/client/package.json`：

```jsonc
{
  "dependencies": {
    "@opencode-ai/schema": "workspace:*",
    "@opencode-ai/protocol": "workspace:*"
    // 注意：没有 core，没有 server
  },
  "devDependencies": {
    "@opencode-ai/core": "workspace:*",        // 仅代码生成用
    "@opencode-ai/server": "workspace:*",       // 仅代码生成用
    "@opencode-ai/httpapi-codegen": "workspace:*"
  }
}
```

含义：`client` 在**运行时**根本无法 `import` `core`/`server`——它们不在它的依赖图里。core/server 只在 dev 时被 codegen 读取，生成完就不需要了。

对比 `sdk-next`：

```jsonc
{
  "dependencies": {
    "@opencode-ai/client": "workspace:*",
    "@opencode-ai/core": "workspace:*",
    "@opencode-ai/server": "workspace:*"
  }
}
```

`sdk-next` 显式组合三者，所以它能做 Embedded OpenCode。

### 防线 2：契约层不依赖任何上层

- `schema` 仅依赖 `effect`
- `protocol` 仅依赖 `schema`（+ effect）
- `llm` 仅依赖 `schema`

契约层是依赖图的根，物理上无法反向引用上层。改上层不会破坏契约层。

### 防线 3：代码生成在时间上分离"读契约"和"跑实现"

```
构建期（dev）:
  protocol(契约) + server(实现) ──httpapi-codegen──▶ packages/client/src/generated*

                                                          ↓
运行期:                                                client 只用 schema + protocol
                                                       （core/server 已不需要）
```

生成器（`packages/httpapi-codegen`）在 dev 时读 `protocol` + `server` 的 HttpApi 契约，emit 出客户端代码。运行时客户端只依赖 `schema`/`protocol`，与 core/server 彻底解耦。

## 怎么验证分层没被破坏

### CI 校验生成物

`packages/client/package.json`：

```jsonc
{
  "scripts": {
    "generate": "bun run script/build.ts",
    "check:generated": "bun run generate && git diff --exit-code -- src/generated src/generated-effect"
  }
}
```

改了 Protocol/Server HttpApi 后忘了重新生成 → `check:generated` 的 `git diff --exit-code` 失败 → CI 挂。

### 你能做的检查

1. 想在 `client` 或 UI 包里 `import "@opencode-ai/core"` → **几乎一定是分层错误**。正确做法：把能力下沉到 `protocol` 契约，再生成到 client。
2. 想在 `schema`/`protocol` 里 `import` 上层 → 物理不可能（没有该依赖）。
3. 改了 HttpApi → 跑 `cd packages/client && bun run generate` → 提交生成物。

## 反模式与正确做法

| 反模式 | 正确做法 |
|---|---|
| client 直接调 core 的某函数 | 能力下沉到 protocol HttpApi 契约 → 生成到 client |
| UI 包 import server 内部 | UI 用 sdk/client，走 HttpApi |
| 同进程嵌入：起 server 再 HTTP 自连 | 用 `sdk-next` 的 Embedded OpenCode（in-memory HttpClient） |
| 手改 `src/generated*` | 改契约后跑 `generate`，生成物提交 |
| 在 `protocol` 里加业务逻辑 | 业务逻辑放 `server`/`opencode`，protocol 只放契约 |

## 为什么这么设计

- **客户端可独立分发**：`client` 包发布时不带 core/server，体积小、无副作用。
- **契约稳定**：上层重构只要契约不变，客户端不用重新生成。
- **多端复用**：同一份 HttpApi 契约生成 Promise 客户端、Effect 客户端、SDK IR，喂给 CLI/TUI/Web/Desktop/SDK。
- **可嵌入式**：`sdk-next` 组合三者后，opencode 能当库嵌进任意 TS 应用。

## 相关文档

- 分层全景与各包依赖：[架构分层](../architecture.md)
- 生成链路细节：[httpapi-codegen](./httpapi-codegen.md)
- 嵌入式用法：[embedded-opencode](./embedded-opencode.md)
