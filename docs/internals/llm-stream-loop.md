---
title: 一次 Provider Turn 的完整链路
sidebar_position: 3
---

# 一次 Provider Turn 的完整链路

拆解 `runTurnAttempt`——SessionRunner 内层 continuation 循环的每一步。文件：`packages/core/src/session/runner/llm.ts:168-343`。

## 链路图

```
runTurnAttempt(sessionID, promotion, currentStep)
  │
  ├─ (1)  getSession(sessionID)                     :174   reload session info
  ├─ (2)  SessionContextEpoch.initialize/prepare    :178/193  取 system context baseline
  ├─ (3)  if promotion: promote steers/queue        :182-190  safe boundary 提升
  │        promoted>0 → currentStep=1               :190   重置配额
  ├─ (4)  models.resolve(session)                   :194   解析 LLM Model
  ├─ (5)  SessionHistory.entriesForRunner(...)      :195   reload projected history
  ├─ (6)  toLLMMessages(context, model)             :206   翻译为 LLM 消息
  ├─ (7)  isLastStep = currentStep >= agent.steps   :197
  │        if isLastStep: toolChoice="none" + MAX_STEPS_PROMPT  :206-209
  ├─ (8)  LLM.request() → llm.stream(request)  ★    :200/227  恰好一次流式调用
  ├─ (9)  流式消费: createLLMEventPublisher 持久化   :213-225  每 event 落库
  ├─ (10) 工具调用结算                                :238-266
  │        provider-executed → 跳过
  │        其他 → toolMaterialization.settle() → publish(toolResult)
  ├─ (11) compactIfNeeded / compactAfterOverflow    :210/281
  ├─ (12) awaitToolFibers                            :291   等本地工具 fiber
  └─ (13) return { needsContinuation, step }        :340
```

## 时序图（一次 turn 的参与者视角）

```
Runner        ContextEpoch    Catalog      History       LLM         Tool        Store
 │                │              │            │           │             │           │
 │──get session─────────────────────────────────────────────────────────────────────▶│
 │──prepare──────▶│              │            │           │             │           │
 │                │──reconcile───│(sources)   │           │             │           │
 │                │   vs snapshot│            │           │             │           │
 │                │──Updated?──────────────────────────────────────────────────────▶│ ContextUpdated
 │◀──baseline/snapshot│           │            │           │             │           │
 │──promote(steer/queue, cutoff)────────────────────────────────────────────────────▶│ 写 promoted_seq
 │──resolve──────│──────────────▶│            │           │             │           │
 │◀──Model───────│───────────────│            │           │             │           │
 │──entriesForRunner(baselineSeq)─────────────▶│           │             │           │
 │◀──projected history────────────────────────│           │             │           │
 │──isLastStep? 若是 → toolChoice=none + MAX_STEPS_PROMPT                              │
 │──request + stream──────────────────────────────────────▶│             │           │
 │                │              │            │           │──event──────────────────▶│ 实时持久化
 │◀──tool_call────│──────────────│────────────│───────────│             │           │
 │──settle────────│──────────────│────────────│───────────│────────────▶│           │
 │                │              │            │           │             │──Permission.ask
 │                │              │            │           │             │──execute
 │                │              │            │           │             │──Truncate.output
 │◀──toolResult───│──────────────│────────────│───────────│─────────────│──────────▶│ Model Tool Output
 │──compactIfNeeded─────────────────────────────────────────────────────────────────▶│
 │──awaitToolFibers─────────────────────────────────────────────────────────────────▶│
 │──return { needsContinuation, step }                                                │
```

## 逐段解释

### (1) reload session info

`getSession(sessionID)`（`:174`）从 `SessionStore` 重读 session。**每次 turn 都 reload**——不缓存，因为 session 元数据（agent/model/permission）可能已被并发改动。

### (2) System Context baseline

`SessionContextEpoch.initialize`（首次，`:178`）/ `prepare`（后续，`:193`）：

- 首次：`SystemContext.initialize(value)` 生成 baseline generation
- 后续：`SystemContext.reconcile(value, snapshot)` 对比上次 snapshot
  - `Updated` → 发 `ContextUpdated` 事件，commit 时 `advance(snapshot)`
  - `ReplacementBlocked` → 保留旧 baseline

详见 [system-context-algebra](./system-context-algebra.md)。

### (3) Promote（safe boundary）

见 [session-lifecycle](./session-lifecycle.md#阶段-5promote提升safe-boundary)。`cutoff = EventV2.latestSequence`，只提升已投影的 input。`promoted>0` → `currentStep=1` 重置配额。

### (4) 模型解析

`models.resolve(session)`（`:194`）→ core 的 `Catalog` 服务查 provider+model → `fromCatalogModel()` 转 AI SDK `LanguageModel`。详见 [运行时子系统](../runtime-subsystems.md#provider--llm-provider)。

### (5) reload projected history

`SessionHistory.entriesForRunner(db, sessionID, baselineSeq)`（`:195`）——带 `baselineSeq`（Context Epoch 的截止）加载投影历史。**续作前必须 reload**，不重用内存里的旧历史。

### (6) 翻译为 LLM 消息

`toLLMMessages(context, model)`（`:206`，定义在 `to-llm-message.ts:170`）把 opencode 内部消息格式翻成具体 provider SDK 需要的格式。

### (7) max-steps 检查

`isLastStep = currentStep >= agent.info.steps`（`:197`）。达上限：

- `toolChoice="none"` —— 禁用工具
- 注入 `MAX_STEPS_PROMPT`（`runner/max-steps.ts:1-16`）—— 强制纯文本收尾

### (8) llm.stream —— ★ 每 turn 恰好一次

`LLM.request()` 构建（`:200`）→ `llm.stream(request)`（`:227`）。

**关键不变量**：一次 provider turn **恰好一次** `llm.stream` 调用。不要在 turn 内多次调用、不要用内存工具循环替代（`AGENTS.md` 明令）。

### (9) 流式消费与持久化

`createLLMEventPublisher`（`:213-225`，定义在 `publish-llm-event.ts:54-423`）把每个流式 event 持久化（文本块、工具调用、reasoning 等）。这样即使中途中断，已产出的事件也已落库，可恢复。

### (10) 工具调用结算

模型返回 `tool_call`（`:238-266`）：

- **provider-executed** 工具（provider 自己跑的，如内置 web search）→ 跳过本地执行
- 其他 → `toolMaterialization.settle()` 结算 → `publish(LLMEvent.toolResult(...))` 持久化

工具结果作为 **Model Tool Output**（有界投影）进 Session History。超限的全文写到 **Managed Tool Output File**。详见 [tool-registry-permissions](./tool-registry-permissions.md)。

### (11) Compaction

- `compactIfNeeded`（`:210`）—— turn 后检查是否该压缩
- overflow 时 `compactAfterOverflow`（`:281`）—— 删 media 并自动继续

详见 [sessions](../features/sessions.md#compaction压缩)。

### (12) 等待本地工具 fiber

`awaitToolFibers`（`:291`）等所有本地执行的工具 fiber 完成（工具可能并发跑）。

### (13) 返回

`{ needsContinuation, step }`（`:340`）：

- `needsContinuation=true`（有工具调用或 pending steer）→ 内层 continuation 循环继续，`step++`
- 否则 → 退出内层，回到外层 queue 循环

## 双层循环回顾

```
run(sessionID, force):                          runner/llm.ts:378
  检查 pending steer/queue，无且非 force → 返回
  外层 queue 循环:  while hasPending("queue")    promotion 首轮=queue/steer/undefined
    内层 continuation: while needsContinuation   promotion 后续="steer"
      runTurnAttempt(...)
```

## 不变量

1. 每 turn 恰好一次 `llm.stream`
2. 续作前 reload projected history（不重用内存历史）
3. promote 在 stream 之前的 safe boundary
4. 工具结果经截断后作为 Model Tool Output 持久化
5. 流式 event 实时落库，可中断恢复

## 相关文档

- 上一层时序：[session-lifecycle](./session-lifecycle.md)
- 工具结算细节：[tool-registry-permissions](./tool-registry-permissions.md)
- System Context baseline：[system-context-algebra](./system-context-algebra.md)
