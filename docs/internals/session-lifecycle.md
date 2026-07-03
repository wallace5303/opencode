---
title: 会话生命周期
sidebar_position: 2
---

# 会话生命周期

一条用户消息从输入到落地为持久化历史的完整路径。所有路径基于 `packages/core/src`。

## 全局时序

```
用户输入 prompt
  │
  ▼
SessionV2.prompt(input)              session.ts:360
  │ (1) admit: 写 SessionInputTable + 发 PromptAdmitted      input.ts:41
  │ (2) execution.wake(sessionID)   ← resume:false 时跳过    session.ts:382
  ▼
SessionExecution.local               execution/local.ts:10
  │ coordinator.wake(sessionID)     ← 合并唤醒
  ▼
SessionRunCoordinator                run-coordinator.ts
  │ 若已有 entry: pendingWake=true（合并），直接返回
  │ 否则: 新建 entry，drain 回调启动
  ▼
drain 回调:
  store.get(sessionID)                                    execution/local.ts:18
  Effect.provide(locations.get(session.location))         :20  注入 Location Layer
  SessionRunner.run({ sessionID, force })                 :22
  ▼
SessionRunner.run（双层循环）          runner/llm.ts:378
  │ 外层 queue 循环:  while hasPending("queue")
  │ 内层 continuation: while needsContinuation
  │   ┌─────────────────────────────────────┐
  │   │ runTurnAttempt                        │ runner/llm.ts:168
  │   │  - promote steers/queue（safe boundary）│ :182-190
  │   │  - SystemContext.reconcile → Mid-Convo │ context-epoch.ts:40
  │   │  - reload projected history            │ :195
  │   │  - llm.stream(request)  ★ 一次         │ :227
  │   │  - 结算工具调用                         │ :238-266
  │   │  - compactIfNeeded                     │ :210
  │   └─────────────────────────────────────┘
  │ needsContinuation? → 继续内层循环
  │ 否则回到外层 queue 循环
  ▼
无 pending + 无续作 → drain 结束（进程本地，无持久身份）
```

## 时序图（参与者视角）

```
用户       SessionV2    Coordinator     Runner        LLM        Store(DB)
 │             │             │            │            │             │
 │──prompt────▶│             │            │            │             │
 │             │──admit─────────────────────────────────────────────▶│ 写 SessionInputTable
 │             │             │            │            │             │ + 发 PromptAdmitted
 │             │──wake──────▶│            │            │             │
 │             │             │ 合并/新建 entry          │             │
 │             │             │──run──────▶│            │             │ (provide Location Layer)
 │             │             │            │──get─────────────────────▶│ reload session
 │             │             │            │──promote(cutoff=latestSeq)│ safe boundary
 │             │             │            │──reconcile(context)       │ → Mid-Convo System Msg
 │             │             │            │──load history─────────────▶│ 带 baselineSeq
 │             │             │            │──stream───▶│              │ ★ 每 turn 一次
 │             │             │            │            │──event──────▶│ 流式实时落库
 │             │             │            │◀──chunk────│              │
 │             │             │            │──settle tools─────────────▶│ toolResult 持久化
 │             │             │            │──needsCont?                │
 │             │             │◀──done─────│            │              │
 │             │             │ settle: pendingWake?                    │
 │             │             │   true → 原地重启 entry                 │
 │             │             │   false → 删 key                        │
 │◀────────────│             │            │            │              │
```

## 阶段 1：Admit（接纳）

`SessionV2.prompt`（`session.ts:360-386`），`Effect.uninterruptible` 包裹：

```
(1) result.get(sessionID)                      // 验证存在         :363
(2) resolvePrompt(input.prompt)                // PromptInput→Prompt :364
(3) delivery = input.delivery ?? "steer"       // 默认 steer         :366
(4) SessionInput.admit(db, events, {...})      // 持久化 + 事件      :368
(5) SessionInput.equivalent(admitted, expected)// 一致性校验         :380
(6) if (resume !== false) execution.wake(...)  // 唤醒               :382
```

`admit`（`input.ts:41-81`）：写 `SessionInputTable` 一行 + 发 `SessionEvent.PromptAdmitted`。

**关键**：admit 只持久化，不跑模型。`resume:false` 时连唤醒都不做——纯记录（跨进程迁移、批量预写入场景）。

## 阶段 2：Wake（注册工作）

`SessionExecution.wake` → `SessionRunCoordinator.wake`（`run-coordinator.ts:81-92`）：

- **已有活跃 entry** → 仅置 `pendingWake=true`（**合并唤醒**），同步返回
- **无 entry** → 新建 entry 并 start（force=false）

同一 session 的多次 wake 合并成一次后续 drain，避免并发重复执行。

## 阶段 3：Drain（排空）

drain 回调（`execution/local.ts:17-28`）：

```
store.get(sessionID)                                    // 取 session info
  .pipe(Effect.provide(locations.get(session.location)))// 注入 Location Layer
  .pipe(SessionRunner.Service.use(runner => runner.run({ sessionID, force })))
```

**placement 发现**：`locations.get(session.location)` —— 从 `LocationServiceMap`（`location-service-map.ts`）取该 Location 的 Layer。这是 drain 时**唯一**查 Location 的地方。

> "No layer should take a Session ID"：只有 SessionExecution 用 sessionID 做 Location 路由；下层通过 Layer 依赖注入拿环境。

drain 是**进程本地**执行区间，**无持久身份、无 transcript 边界**。clustering 出现前不跨进程续作。

## 阶段 4：Run（双层循环）

`SessionRunner.run`（`runner/llm.ts:378-401`）：

```
外层 queue 循环:   while (hasPending("queue"))
  内层 continuation 循环: while (needsContinuation)
    runTurnAttempt(...)
```

- 首轮 `promotion` = steer/queue/undefined；后续轮 = `"steer"`
- `force` 让无 pending 时也跑一次（resume 场景）

详见下一次 provider turn 的拆解 → [llm-stream-loop](./llm-stream-loop.md)。

## 阶段 5：Promote（提升，safe boundary）

在 `runTurnAttempt` 开头（`:182-190`）：

```
cutoff = EventV2.latestSequence(db, session.id)     // :183 安全边界
if promotion == "steer": promoteSteers(cutoff)      // input.ts:245 提升所有 steer<=cutoff
if promotion == "queue": promoteNextQueued()        // input.ts:268 提升最早一条 queue
if promoted > 0: currentStep = 1                    // :190 重置 provider-turn 配额
```

**safe boundary** = 紧接 provider 调用之前、promote 与工具结算之后。promote 用 `cutoff` 保证不提升未投影完成的 input。

**配额重置**：提升任何新用户输入 → 重置 `currentStep`；一批 steer 只重置一次。queue 每次只提升一条，提升后重新评估续作再提升下一条。

## 阶段 6：结算与续作

`runTurnAttempt` 返回 `{ needsContinuation, step }`：

- `needsContinuation=true`（有工具调用或 pending steer）→ 内层循环继续
- 否则 → 检查外层 queue，无 pending → drain 结束

drain 结束后，`SessionRunCoordinator.settle`（`run-coordinator.ts:51-65`）检查 `pendingWake`：

- `pendingWake=true` 且未 stopping → **原地重启同一 entry**（force=false）
- 否则 → 删 active map 中的 key

## 中断

`SessionRunCoordinator.interrupt`（`:94-101`）：`stopping=true` + `pendingWake=false` + `Fiber.interrupt(owner)`。idle 或 missing 时是 no-op。

## 持久化表（贯穿全程）

| 表 | 写入时机 | 内容 |
|---|---|---|
| `SessionInputTable` | admit | id/session_id/admitted_seq/prompt/delivery/promoted_seq/time_created |
| `SessionMessageTable` | promote / 事件投影 | id/session_id/seq/type/data |
| `SessionContextEpochTable` | ContextUpdated 事件 commit | session_id/baseline/snapshot/baseline_seq |
| `SessionTable` | create/patch | id/project_id/.../agent/model/cost/tokens/... |

## 不变量

1. admit 只持久化 + advisory wake，不在 admit 里跑模型
2. wake 可合并，同 session 多次 wake = 一次后续 drain
3. promote 只在 safe boundary，cutoff = latestSequence
4. drain 进程本地、无持久身份
5. 提升新输入重置 provider-turn allowance（一批 steer 一次）
6. 只有 SessionExecution 用 sessionID 做 Location 路由

## 相关文档

- 一次 provider turn 内部：[llm-stream-loop](./llm-stream-loop.md)
- System Context 在 safe boundary 的合并：[system-context-algebra](./system-context-algebra.md)
- 完整术语：[术语表](../glossary.md)
