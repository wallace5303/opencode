import type { SidebarsConfig } from "@docusaurus/plugin-content-docs"

/**
 * 手动侧边栏：细分类，不挪文件、不破坏相对链接。
 * doc id = 相对 docs/ 的路径（无扩展名）。顶层文件 id 即文件名，子目录文件 id 为 `dir/name`。
 */
const sidebars: SidebarsConfig = {
  learningSidebar: [
    "intro",

    {
      type: "category",
      label: "基础认知",
      collapsed: false,
      items: ["overview", "architecture", "glossary"],
    },

    {
      type: "category",
      label: "工程与运行时",
      collapsed: false,
      items: ["tooling", "runtime-subsystems", "session-v2-deep-dive", "clients-and-ui"],
    },

    "learning-path",

    {
      type: "category",
      label: "功能文档",
      collapsed: false,
      items: [
        {
          type: "category",
          label: "命令与多端",
          collapsed: false,
          items: ["features/cli-commands", "features/multi-platform"],
        },
        {
          type: "category",
          label: "能力",
          collapsed: false,
          items: [
            "features/providers",
            "features/tools",
            "features/agents-and-skills",
            "features/sessions",
          ],
        },
        {
          type: "category",
          label: "配置与扩展",
          collapsed: false,
          items: ["features/config", "features/docs-site"],
        },
      ],
    },

    {
      type: "category",
      label: "实现原理",
      collapsed: false,
      items: [
        {
          type: "category",
          label: "架构与契约",
          collapsed: false,
          items: [
            "internals/dependency-layering",
            "internals/httpapi-codegen",
            "internals/storage-db",
            "internals/embedded-opencode",
          ],
        },
        {
          type: "category",
          label: "运行时机制",
          collapsed: false,
          items: [
            "internals/session-lifecycle",
            "internals/llm-stream-loop",
            "internals/tool-registry-permissions",
            "internals/system-context-algebra",
          ],
        },
      ],
    },
  ],
}

export default sidebars
