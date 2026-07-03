import type { Config } from "@docusaurus/types"
import type * as Preset from "@docusaurus/preset-classic"

const config: Config = {
  title: "OpenCode 学习文档",
  tagline: "开源 AI 编码 agent · 架构学习与实现原理",
  favicon: "img/favicon.svg",

  // 生产部署时改为你自己的域名
  url: "https://opencode-docs.local",
  baseUrl: "/",
  trailingSlash: false,

  // GitHub Pages 部署相关；本地预览可忽略
  organizationName: "gsx",
  projectName: "opencode-docs",

  onBrokenAnchors: "throw",
  onBrokenLinks: "throw",

  // 文档站本身独立于 opencode 主仓库，不开启 i18n
  i18n: {
    defaultLocale: "zh-CN",
    locales: ["zh-CN"],
  },

  // Mermaid 图表支持：```mermaid 代码块渲染为可交互图
  markdown: {
    mermaid: true,
    hooks: {
      onBrokenMarkdownLinks: "warn",
    },
  },
  themes: ["@docusaurus/theme-mermaid"],

  // 本地全文搜索：构建时生成静态索引，无需 Algolia 后端
  // language 含 "zh" 启用中文分词（lunr），匹配本站中文文档
  plugins: [
    [
      "@easyops-cn/docusaurus-search-local",
      {
        indexDocs: true,
        indexBlog: false,
        indexPages: true,
        language: ["en", "zh"],
        hashed: true,
        docsDir: "../docs",
        blogDir: ".",
        docsRouteBasePath: "docs",
        searchResultLimits: 12,
        // 搜索分区：可按"功能文档"/"实现原理"缩小范围；默认搜全部
        searchContextByPaths: [
          { label: "功能文档", path: "docs/features" },
          { label: "实现原理", path: "docs/internals" },
        ],
        useAllContextsWithNoSearchContext: true,
      },
    ],
  ],

  presets: [
    [
      "classic",
      {
        docs: {
          // 关键：文档内容放在仓库根的 docs/，而不是 website/docs/
          path: "../docs",
          routeBasePath: "docs",
          sidebarPath: "./sidebars.ts",
          // 暂不开启在线编辑链接；确定仓库地址后可改为字符串 URL
          editUrl: undefined,
        },
        blog: false,
        theme: {
          customCss: "./src/css/custom.css",
        },
      } satisfies Preset.Options,
    ],
  ],

  themeConfig: {
    colorMode: {
      defaultMode: "dark",
      disableSwitch: false,
      respectPrefersColorScheme: true,
    },
    // Mermaid 主题：明暗双主题 + opencode 绿主题变量
    mermaid: {
      theme: { light: "default", dark: "dark" },
      options: {
        themeVariables: {
          primaryColor: "#16a34a",
          primaryTextColor: "#ffffff",
          primaryBorderColor: "#15803d",
          lineColor: "#16a34a",
          secondaryColor: "#bbf7d0",
          tertiaryColor: "#dcfce7",
          actorBkg: "#16a34a",
          actorTextColor: "#ffffff",
          actorBorderColor: "#15803d",
          signalColor: "#374151",
          labelColor: "#16a34a",
          noteBkgColor: "#dcfce7",
          noteTextColor: "#14532d",
          noteBorderColor: "#16a34a",
        },
      },
    },
    navbar: {
      title: "OpenCode Docs",
      logo: {
        alt: "OpenCode Logo",
        src: "img/logo.svg",
      },
      items: [
        {
          type: "docSidebar",
          sidebarId: "learningSidebar",
          position: "left",
          label: "学习文档",
        },
        {
          href: "https://github.com/sst/opencode",
          label: "opencode 仓库",
          position: "right",
        },
      ],
    },
    footer: {
      style: "dark",
      links: [
        {
          title: "文档",
          items: [
            { label: "学习文档", to: "/docs/intro" },
            { label: "项目全景", to: "/docs/overview" },
            { label: "架构分层", to: "/docs/architecture" },
            { label: "术语表", to: "/docs/glossary" },
          ],
        },
        {
          title: "资源",
          items: [
            { label: "opencode 官网", href: "https://opencode.ai" },
            { label: "GitHub", href: "https://github.com/sst/opencode" },
            { label: "Discord", href: "https://opencode.ai/discord" },
          ],
        },
      ],
      copyright: `Copyright © ${new Date().getFullYear()} opencode-docs. Built with Docusaurus.`,
    },
    prism: {
      // 使用 preset-classic 自带的默认主题；只追加常用语言
      additionalLanguages: ["bash", "json"],
    },
  } satisfies Preset.ThemeConfig,
}

export default config
