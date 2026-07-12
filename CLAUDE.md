# CLAUDE.md

本文件为 Claude Code（claude.ai/code）在本仓库中处理内容时提供指导。

## 仓库状态

这是 **opencode-docs** —— 一个**只写文档**的仓库，不包含 opencode 源码。被文档化的对象是上游 [sst/opencode](https://github.com/sst/opencode) monorepo（Bun + TypeScript）；本仓库的产物是一个基于 **Mintlify** 的文档站，位于 `website/`。

- 默认分支：`dev`。做 diff 用 `dev` 或 `origin/dev`（本地可能没有 `main` ref）。
- 文档内容基于 opencode `v1.17.13` 前后的代码状态；上游重构后，文中引用的 `packages/...:行号` 路径可能漂移。

## 目录结构

```
opencode-docs/
├── CLAUDE.md
├── README.md
└── website/                 # Mintlify 项目根（docs.json 所在目录，命令在这里跑）
    ├── docs.json            # 站点配置 + 导航（groups → pages，路径 docs/...）
    ├── package.json         # mintlify CLI（pnpm）
    ├── pnpm-lock.yaml / pnpm-workspace.yaml
    ├── favicon.svg
    ├── logo/                # /logo/light.svg、/logo/dark.svg
    └── docs/                # 文档内容（.mdx）
        ├── introduction.mdx  + 8 篇根文档（overview / architecture / glossary / tooling / runtime-subsystems / session-v2-deep-dive / clients-and-ui / learning-path）
        ├── features/         # 功能文档（8 篇）
        └── internals/        # 实现原理（8 篇）
```

> **Mintlify 约束（重要）**：Mintlify 把 `docs.json` 所在目录作为项目根，**内容必须放在根之下**。它没有 Docusaurus 那种 `docs.path: "../docs"` 指向外层目录的配置。所以文档内容在 `website/docs/`，而不是与 `website/` 平级。不要尝试把 `docs/` 移成 `website/` 的兄弟目录——实测会导致 dev 服务器把 `../` 规范化掉、所有页面 404，或符号链接方案抛 `RangeError`。

## 命令

均在 `website/` 目录下运行（`docs.json` 在那里）：

```bash
cd website
pnpm install         # 安装 mintlify CLI（pnpm 11+）
pnpm dev             # 开发服务器，默认 http://localhost:3000
pnpm build           # 生产构建
pnpm lint            # 失效链接检查（mintlify broken-links）
```

> 也可不装依赖直接 `npx mintlify@latest dev`。`mintlify dev` / `build` / `broken-links` 都必须从 `website/`（即 `docs.json` 所在目录）运行。

## Mintlify 写作规范

编辑 `website/docs/` 下的 `.mdx` 时遵循：

- **frontmatter**：`title` + `description` 必填；可选 `sidebarTitle`（侧边栏短名）。**不要**写 `sidebar_position`——顺序由 `docs.json` 的 `navigation` 控制。
- **正文不要 H1**：frontmatter 的 `title` 会渲染为页面主标题，正文开头不要再写 `# 标题`（会重复）。
- **Tabs**：用 Mintlify 内置 `<Tabs>` / `<Tab title="…">`，**无需 import**。不要用 Docusaurus 的 `import Tabs from '@theme/Tabs'` / `<TabItem>`。
- **站内链接**：去掉 `.md` 扩展名（`./architecture`，不是 `./architecture.md`）；锚点 `#xxx` 保留。
- **文件后缀**：统一 `.mdx`（含 JSX 组件的页面必须，纯文本也兼容）。
- **图表**：` ```mermaid ` 代码块原生渲染，无需插件。
- **静态资源**：以 `/` 开头的路径从 `website/` 根解析（如 `/favicon.svg`、`/logo/light.svg`），放在 `website/` 根下而非子目录。
- **新增页面**：在 `website/docs/` 建好 `.mdx` 后，必须把路径（相对 `website/`，如 `docs/features/foo`）加进 `website/docs.json` 的某个 `navigation.groups[].pages` 数组，否则不会被导航收录。

### 导航分组（`docs.json`）

- **开始**：introduction、overview、learning-path
- **架构与原理**：architecture、glossary、tooling、runtime-subsystems、session-v2-deep-dive、clients-and-ui
- **功能**（`docs/features/`）：cli-commands、providers、tools、agents-and-skills、sessions、config、multi-platform、docs-site
- **实现原理**（`docs/internals/`）：dependency-layering、session-lifecycle、llm-stream-loop、tool-registry-permissions、system-context-algebra、httpapi-codegen、storage-db、embedded-opencode

## 文档主题：opencode（被文档化的对象）

写文档时需要准确描述 opencode，以下是关键背景（这些规则用来**校对文档内容**，不是本仓库要执行的命令）：

- **依赖方向铁律**：运行时依赖 `Schema → Core/Protocol → Server`；Client 只依赖 Schema/Protocol，**绝不**依赖 Core/Server；`sdk-next` 组合 Client + Core + Server。
- **Session V2 内核位置**：在 `packages/core/src/session*`，**不在** `packages/opencode/src/session`（后者是业务编排层）。这是初学者最易踩的坑，文档里反复强调。
- **规范术语**：使用上游 `CONTEXT.md` 的规范词——System Context、Context Source、Context Epoch、Admitted Prompt、Prompt Promotion、Provider Turn、Session Drain 等；**避免**"系统提示词"之类口语说法。完整对照见 `website/docs/glossary.mdx`。
- **源码引用**：统一写成 `packages/xxx/src/yyy.ts:行号` 形式，方便读者跳转。

## 约定

### 分支与提交

- 默认分支：`dev`。分支名：≤3 个连字符分隔的单词，无斜杠，无 `feat/`/`fix:` 前缀（如 `session-v2-notes`）。
- 约定式提交：`type(scope): summary`。类型：`docs`、`chore`、`fix`、`refactor`。scope 用 `docs`（文档内容）或 `engine`（站点配置/工具/依赖）。示例：`docs: expand session-lifecycle mermaid`、`chore(engine): bump mintlify`、`fix(docs): broken cross-link in overview`。

### 风格

- 中文内容；措辞与周围段落保持一致。
- Markdown 保持简洁；本仓库未配 Prettier，无需手动格式化。
- 改动 `.mdx` 后，建议跑 `pnpm lint`（在 `website/`）确认无失效链接。
