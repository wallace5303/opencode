# opencode-docs

opencode 学习文档仓库。整个站点（Mintlify 引擎 + 文档内容）都在 `website/` 子目录里。

```
opencode-docs/
└── website/        # Mintlify 项目根，所有命令在这里跑（cd website && pnpm dev）
    └── docs/       # 文档内容（.mdx）
```

> Mintlify 把 `docs.json` 所在目录作为项目根，内容必须放在根之下，所以 `docs/` 在 `website/` 内部，而非平级。

详见 [`website/README.md`](./website/README.md)。
