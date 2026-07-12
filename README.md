# docs-engine

opencode 学习文档的 Mintlify 站点。整个站点工程都在 `website/` 子目录里（Mintlify 把 `docs.json` 所在目录作为项目根，内容必须放在根之下，所以没有把 `docs/` 与 `website/` 平级摆放）。

```
docs-engine/
└── website/        # Mintlify 项目根，所有命令在这里跑（cd website && pnpm dev）
    └── docs/       # 文档内容（.mdx）
```

详见 [`website/README.md`](./website/README.md)。
