# GridVault 项目规划（PoC，TypeScript 技术栈）

> 日期：2026-02-02（UTC+8）

目标：在 Sui 测试网/本地网实现一个“网格交易风格”的机器人 PoC。
- 交易对：**SUI / USDC**（先做概念验证）
- DEX/聚合：**Cetus Aggregator**（活动要求）
- 执行频率：**秒级 tick**（每秒评估一次）
- 网格参数：**用户可配置**（不写死）
- 风控：**MVP 不强制启用**，但**预留结构与接口位置**以便后续加固

---

## 0. 技术栈决策（Why TypeScript）

Sui 生态的主流开发体验更偏向 TypeScript：
- Sui 官方 SDK 以 TS 为主（交易构造、签名、提交、事件查询等）
- Cetus Aggregator 文档/SDK 以 TS 为主（报价、路由、构造 swap 交易块）

因此 PoC 阶段统一采用 **TypeScript 全栈**：
- 链上：Move（必需）
- 链下 bot：Node.js + TypeScript
- 前端：Next.js + TypeScript

> Rust 在 PoC 阶段不作为主路径（除非后续性能/并发/部署需要再引入）。

---

## 1. 总体原则（尽可能简洁、可演进）

1. **链上合约只做“资金安全与权限隔离”**：资金只能在 Vault 内流转；bot 侧不应拥有提现/转出能力。
2. **策略与网格状态链下（TypeScript bot）**：减少 shared object 写冲突、降低 Move 复杂度。
3. **秒级执行 = 单并发交易**：同一时刻最多 0/1 笔 in-flight 交易，避免 shared object 冲突与重复下单。
4. **测试驱动开发（TDD）**：每个模块先写测试样例，再写实现；优先跑通最小闭环（create → deposit → authorize → trade → observe）。

---

## 2. 模块分工

### 2.1 Move 合约（`contracts/`）
职责：
- **Vault 资金托管**（shared object）
- **权限系统**：`OwnerCap`（用户持有）/ `TraderCap`（bot 持有）
- **受限交易入口**：`vault_swap_*`（只允许把 swap 的产出重新存回 Vault）
- **事件**：Deposit/Withdraw/Trade/Config
- **风控占位**：预留 `RiskParams` 字段与校验位置（MVP 默认不启用）

核心安全约束（MVP 必须满足）：
- **bot 没有任何可提现/转账入口**（合约层禁止“把 Vault 的 Coin 转到外部地址”）
- 所有 swap 的输出 **必须回到 Vault**

> 备注：Cetus Aggregator 的 on-chain 集成细节较多，PoC 阶段可以先把 `vault_swap_*` 做成可演进的接口（先 stub + 事件 + 权限），再逐步接入真正的 swap。

### 2.2 Bot（TypeScript，`bot/` 或 `apps/bot/`）
职责：
- **秒级 tick**：拉取价格/报价 → 策略决策 → 发起交易
- **报价/路由**：通过 `@cetusprotocol/aggregator-sdk`（`findRouters` / `routerSwap` / `fastRouterSwap`）
- **交易执行**：通过 `@mysten/sui` TS SDK 构造交易并签名提交
- **状态持久化**：SQLite（网格配置、运行状态、最近成交、失败重试等）
- **对外 API**：给前端展示（状态/历史/日志），以及接收用户配置（可写入配置）

并发/一致性：
- 采用“单飞行交易（single in-flight tx）”模型：发起后等待回执或超时再进入下一轮 tick。

密钥管理（PoC）：
- 优先支持从环境变量加载（例如 `SUI_PRIVATE_KEY`），避免绑定本机 CLI 配置。
- 可选：读取 Sui CLI keystore 并自动使用 `sui client addresses` 的 active address（便于你现在的 testnet 账号体系）。

### 2.3 Next.js 前端（`frontend/` 或 `apps/frontend/`）
职责：Owner 侧管理与可视化。
- 钱包签名：创建 Vault、deposit/withdraw、暂停/恢复、把 `TraderCap` 转给 bot 地址
- 参数配置：网格参数配置（写入 bot 的配置 API）
- 可视化：Vault 余额、链上事件、bot 状态/交易历史

---

## 3. 接口草案（先把边界固定下来）

### 3.1 Move（概念接口）
> 具体函数名/参数会随着 swap 集成方式落地而微调。

- `create_and_share<A, B>() -> (OwnerCap, TraderCap, vault_id)`
- `deposit_a/deposit_b(vault, owner_cap, coin)`
- `withdraw_a/withdraw_b(vault, owner_cap, amount) -> Coin<T>`
- `set_paused(vault, owner_cap, bool)`
- `vault_swap_a_to_b(vault, trader_cap, amount_in, min_out, ...)`
- `vault_swap_b_to_a(vault, trader_cap, amount_in, min_out, ...)`

风控占位（不启用但保留）：
- `RiskParams { max_in_per_trade, cooldown_ms, allowlist_dex, allowlist_coin, ... }`

### 3.2 Bot（内部模块接口，TypeScript）
建议的内部模块：
- `QuoteService`：
  - `getQuote(side, amountIn) -> { routerData, minOut, price }`
  - 底层：`AggregatorClient.findRouters(...)`
- `Strategy`：
  - `decide(market, vaultSnapshot, gridState) -> Action`
- `Executor`：
  - `buildTx(action) -> Transaction`
  - `signAndExecute(tx) -> digest`
- `Storage`：SQLite
- `HTTP API`：
  - `GET /status`
  - `GET /history`
  - `POST /config`（网格参数）
  - `POST /control`（start/stop）

### 3.3 前端与 bot/链上交互
- 前端：
  - 直接连接钱包与链上交互（创建/存取/暂停/授权 TraderCap）
  - 通过 HTTP 调用 bot（读状态/写配置）
- bot：
  - 只与链上交互做交易提交（并根据链上事件/回执更新 SQLite）

---

## 4. 里程碑（MVP → 可用）

- **M1（链上可信边界）**：Move Vault + caps + pause + 事件 +（swap 入口先 stub）
- **M2（bot 最小闭环）**：TypeScript bot：秒级 tick + 网格策略（单对）+ 交易执行 + SQLite + 最小 API
- **M3（管理面板）**：Next.js：创建/存取/授权/暂停 + 事件与 bot 状态展示
- **M4（加固与扩展）**：逐步启用风控校验、熔断、重试策略优化、更多观测与回测

---

## 5. TDD：测试矩阵（先写测试样例再写实现）

### 5.1 Move（`sui move test`）
核心测试样例：
1. **创建**：cap 与 vault 绑定正确；事件发出。
2. **权限**：无 `OwnerCap` 无法 withdraw / set_paused；无 `TraderCap` 无法 trade。
3. **资金**：deposit/withdraw 前后 Vault 余额正确。
4. **交易约束**：trade 路径不产生外部转出；swap 输出必须回到 Vault。
5. **暂停**：paused 时 trade 失败（Owner 可恢复）。

### 5.2 Bot（TypeScript，建议 `vitest`）
核心测试样例：
1. **网格决策**：给定配置 + 价格序列 → 断言触发 Buy/Sell/None 与档位推进。
2. **单并发交易**：在“in-flight”状态下 tick 不应再次下单。
3. **报价解析**：mock Cetus Aggregator 响应 → 解析 routerData + 计算 `minOut`（slippage bps 来自配置）。
4. **交易构造**：给定 action → 断言构造出的 Transaction 调用目标正确（包/模块/函数/参数类型）。
5. **失败重试**：mock 链上失败/对象冲突 → 重试次数/退避策略/状态落库一致。

### 5.3 E2E（localnet 优先，随后 testnet）
建议做一条最小验收脚本：
1. localnet 起链
2. 创建 Vault
3. deposit SUI/USDC
4. 授权 TraderCap 给 bot 地址
5. bot 发起 1 笔 swap（或先走 stub 事件验证）
6. 校验：Vault 余额变化/事件存在/SQLite 落库

---

## 6. 代码结构建议（清晰、可维护）

PoC 推荐采用 TS monorepo（也可先用简单目录，后续再升级）：
- `contracts/`：Move 包
  - `sources/`：Vault、caps、events、risk
  - `tests/`：Move 单测
- `bot/`（或 `apps/bot/`）：TypeScript bot
  - `src/`：quote/strategy/executor/storage/api
  - `test/`：vitest 单测
- `frontend/`（或 `apps/frontend/`）：Next.js
- `docs/`：本文件 + 参数说明 + 运行手册

---

## 7. PoC 默认配置（先跑通再打磨）

- tick：1000ms
- 并发：单 in-flight tx
- slippage：提供默认值（例如 50–100 bps），用户可改
- 网络：E2E 优先 localnet，之后迁移到 testnet

---

## 8. 待确认/后续可选项（不阻塞 MVP）

- swap 落地方案：
  - A：在 `vault_swap_*` 内部完成 swap（安全性更强，但 Move 侧集成成本更高）
  - B：链下用 Aggregator SDK 构造 swap PTB（更易用，但需要重新评估 Vault 的“不可转出”约束如何保证）
- 前端对链上事件的索引方式：直接 RPC query events vs 自建索引
- 风控启用策略：先加 `max_in_per_trade` / `cooldown`，再加 allowlist 与日限额
