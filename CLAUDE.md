# CLAUDE.md

本文件为 Claude Code（claude.ai/code）在本仓库中处理代码时提供指导。

## 仓库状态

这是 **opencode** monorepo（Bun + TypeScript，Turborepo workspaces）。`opencode-docs` 目录名只是本地检出路径；仓库根目录是 opencode 项目。默认分支是 `dev` —— 本地可能不存在 `main` ref；做 diff 时请用 `dev` 或 `origin/dev`。需要 Bun 1.3+。

## 命令

除非特别说明，均在仓库根目录运行。测试和类型检查必须在 package 目录下运行，绝不在根目录运行（根目录的 `bun test` 会因 `do-not-run-tests-from-root` 守卫而以退出码 1 退出）。

```bash
bun install                      # 安装依赖（postinstall 会运行 packages/core 的 fix-node-pty）
bun dev                          # 针对 packages/opencode 运行 opencode TUI（即 `opencode` 二进制的本地等价物）
bun dev <directory>              # 针对指定目录运行 TUI（用 `bun dev .` 表示仓库根目录）
bun dev serve [--port 8080]      # headless API 服务器（默认端口 4096）
bun dev web                      # 服务器 + web UI
bun run --cwd packages/app dev   # web UI 开发（先启动 `bun dev serve`）
bun --cwd packages/desktop dev   # Electron 桌面应用
bun lint                         # oxlint（根目录）
bun typecheck                    # 跨 packages 的 turbo 类型检查
```

按 package 运行（例如 `packages/opencode`）：

```bash
bun typecheck                    # tsgo --noEmit — 永远用这个，不要用原始 tsc
bun test --timeout 30000 --only-failures        # 完整测试套件
bun test path/to/file.test.ts                    # 单个测试文件
bun test -t "name pattern"                       # 按名称运行单个测试
bun run test:httpapi                             # 练习公开的 HttpApi（coverage/auth/effect 模式）
bun run build                                    # 通过 script/build.ts 构建
./packages/opencode/script/build.ts --single     # 编译独立可执行文件 → packages/opencode/dist/opencode-<platform>/bin/opencode
```

其他开发服务器：`dev:console`、`dev:stats`、`dev:storybook`（见根目录 `package.json`）。

## 代码生成（不要手动编辑）

- `packages/client/src/generated` 和 `src/generated-effect` 由公开的 Protocol/Server `HttpApi` 生成。修改其中任一后，从 `packages/client` 运行 `bun run generate`。
- 旧版 JS SDK 通过 `./packages/sdk/js/script/build.ts` 重新生成。

## 架构

### 依赖方向（强制执行，重要）

运行时依赖流向：**Schema → Core 和 Protocol → Server**。**Client** 运行时代码可以依赖 Schema 和 Protocol，但**绝不**依赖 Core 或 Server。`sdk-next` 组合 Client + Core + Server。不要引入违反此分层的 import。

### 关键 packages（`packages/`）

- `opencode` — 核心业务逻辑与服务器；CLI/TUI 入口。`src/` 的子目录映射到各个领域：`session`、`provider`、`tool`、`agent`、`server`、`config`、`auth`、`lsp`、`mcp`、`plugin`、`permission`、`project`、`session`、`worktree`、`cli/cmd`（CLI 子命令）、`cli/cmd/tui`（TUI，SolidJS + opentui）。
- `app` — 共享的 web UI 组件（SolidJS）。
- `desktop` — 包装 `packages/app` 的 Electron 应用。
- `tui`、`ui`、`web` — 额外的 SolidJS UI 界面。
- `core` — 共享的核心原语（也提供 `fix-node-pty` postinstall）。
- `schema`、`protocol` — 类型/契约定义（依赖图的底层）。
- `server` — HTTP 服务器实现。
- `client`、`sdk`、`sdk-next` — 生成/组合的客户端库。
- `plugin` — 发布的 `@opencode-ai/plugin` 的源码。
- `docs` — 文档站点（MDX + `docs.json`；`openapi.json` 是发布的 API 规范）。

### 存储 / DB

`packages/opencode` 使用 `#db` import 别名，通过 package `imports` 条件解析为 `src/storage/db.bun.ts`（Bun）或 `db.node.ts`（Node）。Drizzle schema 使用 **snake_case** 字段名，因此列名无需重新定义为字符串。

### V2 Session 核心

Session 运行时是持久化的，准入（admission）与执行（execution）是分离的。改动 session 代码时：

- `SessionV2.prompt(...)` 准入一行持久的 `session_input` 记录，然后除非 `resume: false`，否则调度建议性的 `SessionExecution.wake(sessionID)`。序列化的 runner 在安全边界将准入的输入提升为可见的用户消息。
- `SessionExecution` 是进程级全局且基于 Session ID 的 —— 任何层都不应接收 Session ID；placement 仅在 drain 时通过 `SessionStore` + `LocationServiceMap` 发现。中断针对活动的进程本地所有权链；空闲/缺失时为 no-op。
- 每个 provider turn 一次显式的 `llm.stream(request)` 调用；在持久化续接前重新加载投影的历史。**不要**桥接旧版 `SessionPrompt.loop(...)` 或委托给内存中的 tool loop。
- `SessionRunCoordinator` 合并同一 Session 的 resume 并合并 prompt 唤醒；不同 Session 并发运行。在集群化出现之前，drain 是进程本地的；drain 没有持久化身份或 transcript 边界。
- 投递词汇是显式的：`steer`（默认，在下一个安全边界提升）、`queue`（挂起直到 Session 即将空闲）。提升任何新的用户输入会重置 agent 的 provider-turn 配额；一个 steer 批次只重置一次。
- System Context 的代数/注册表/内置项位于 `src/system-context`；Context Source 生产者与其观察的领域在一起；Session History 选择和 Context Epoch 持久化由 Session 拥有。

关于规范词汇（System Context、Context Source、Context Epoch、Admitted Prompt、Prompt Promotion、Provider Turn、Session Drain 等）见 `CONTEXT.md` —— 使用这些术语，而不是 "system prompt" 之类的非正式说法。

## 约定

### 分支与提交

- 默认分支：`dev`。分支名：≤3 个连字符分隔的单词，无斜杠，无 `feat/`/`fix:` 前缀（如 `session-recovery`）。
- 提交和 PR 标题均使用约定式提交（Conventional commits）：`type(scope): summary`。类型：`feat`、`fix`、`docs`、`chore`、`refactor`、`test`。Scope = 受影响的 package（`core`、`opencode`、`tui`、`app`、`desktop`、`sdk`、`plugin`、…）。示例：`fix(tui): simplify thinking toggle styling`、`docs: update contributing guide`。

### 风格（来自 AGENTS.md —— 这些是强制执行的偏好，不是通用建议）

- 禁止 alias import（`import { foo as bar }`），禁止 star import。若需要命名空间值，按名 import 模块自身导出的命名空间，例如 `import { Project } from "@opencode-ai/core/project"` 然后用 `Project.ID`。
- 在启动敏感路径中优先用动态 import；在最窄的、需要绑定作用域顶部解构绑定（不要内联 `await import(...).then(...)` 链）。分支特定的 import 保持在分支内部。
- 依赖类型推断；除非为导出或清晰性所需，否则避免显式注解/接口。避免 `any`。
- 内联一次性使用的值；不要预先抽取 helper。仅当 helper 命名了一个真实概念时，才将其保留在主 export 之下。
- 优先用 `const` + 三元/提前返回，而非 `let`/重新赋值。避免 `else`。
- 尽可能避免 `try`/`catch`；优先 `.catch(...)`。不要从只做同步解析/校验的 helper 返回 `Effect`。
- 避免不必要的解构；用点表示法保留上下文。
- 优先用函数式数组方法（`flatMap`/`filter`/`map`）而非 `for` 循环；在 `filter` 上用类型守卫以保持推断。
- 合适时使用 Bun API（`Bun.file()` 等）。
- 在 Effect generator 中，调用方法前将 service 绑定到命名变量 —— 不要嵌套 `yield* (yield* Foo.Service).bar()`。
- 优先用 Effect schema helper（`Schema.UnknownFromJsonString`、`Schema.decodeUnknownOption`），而非手动 `JSON.parse` 包在 `Effect.try` 里。
- 在 `src/config` 中，添加配置模块时遵循自导出模式（`export * as ConfigAgent from "./agent"`）。
- Prettier：`semi: false`、`printWidth: 120`。

### 测试

- 避免 mock；除非别无选择，否则不要碰 `globalThis.*`。测试真实实现 —— 不要把逻辑复制进测试。
- 测试从 package 目录（如 `packages/opencode`）运行，绝不在根目录。
