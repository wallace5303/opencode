# opencode 学习文档 · Mintlify 引擎

基于 [Mintlify](https://mintlify.com/) 搭建的 opencode 学习文档站。`website/` 是 Mintlify 项目根：站点配置在 `docs.json`，文档内容在 `docs/`（`.mdx`）。

> **目录约定**：`website/` 是 Mintlify 项目根（`docs.json` 所在目录）。Mintlify 要求内容必须在项目根之下，因此文档内容放在 `website/docs/`，而不是与 `website/` 平级。这不同于 Docusaurus（可用 `docs.path: "../docs"` 指向外层），Mintlify 没有等价配置。

## 目录结构

```
opencode-docs/
└── website/                   # Mintlify 项目根（在这里跑命令）
    ├── docs.json              # 站点配置 + 导航（groups → pages，路径 docs/...）
    ├── package.json           # mintlify CLI 脚本
    ├── favicon.svg            # 站点图标（Mintlify 从根目录解析静态资源）
    ├── logo/                  # 明暗 logo（/logo/light.svg、/logo/dark.svg）
    └── docs/                  # 文档内容
        ├── introduction.mdx   # 落地页
        ├── overview.mdx
        ├── architecture.mdx
        ├── glossary.mdx
        ├── tooling.mdx
        ├── runtime-subsystems.mdx
        ├── session-v2-deep-dive.mdx
        ├── clients-and-ui.mdx
        ├── learning-path.mdx
        ├── features/          # 功能文档（8 篇）
        └── internals/         # 实现原理（8 篇）
```

## 本地开发

```bash
cd website
pnpm install         # 安装 mintlify CLI
pnpm dev             # 开发服务器（默认 http://localhost:3000）
pnpm build           # 生产构建
pnpm lint            # 检查失效链接（mintlify broken-links）
```

> 也可不装依赖直接 `npx mintlify@latest dev`。

## .mdx 写法规范

`docs/` 下的内容遵循以下 Mintlify 规范：

- **frontmatter**：移除 Docusaurus 的 `sidebar_position`；每篇补 `description`；个别标题更丰富的页面（如 `Providers（模型供应方）`）把正文的 H1 信息并入 `title`；长标题加 `sidebarTitle` 让侧边栏更紧凑。
- **正文 H1**：删除每篇开头重复的 `# 标题`——Mintlify 用 frontmatter `title` 渲染页面主标题，正文无需再写一遍。
- **Tabs**：移除 Docusaurus 的 `import Tabs from '@theme/Tabs'` / `TabItem`，改用 Mintlify 内置的 `<Tabs>` / `<Tab title="…">`（无需 import）。
- **链接**：站内 Markdown 链接去掉 `.md` 扩展名（`./architecture.md` → `./architecture`），锚点 `#xxx` 保留。
- **文件后缀**：全部改为 `.mdx`（含 JSX 组件的页面需要，纯文本也兼容）。
- **图表**：` ```mermaid ` 代码块原样保留，Mintlify 原生支持渲染。

导航顺序由 `docs.json` 的 `navigation` 控制（不再靠 `sidebar_position`）。

> Mintlify 4.x 用 `docs.json` 作为配置（旧版 `mint.json` 会在运行时被自动升级并提示 legacy）。本目录直接采用 `docs.json`。

> 历史背景：本站由更早的 Docusaurus 版本迁移而来（frontmatter / Tabs / 链接的写法即迁移时确立的规范，沿用至今）。
