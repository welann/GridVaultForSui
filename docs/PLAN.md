# GridVault 项目规划（PoC）

> 日期：2026-02-01

目标：在 Sui 测试网/本地网实现一个“网格交易风格”的机器人 PoC。
- 交易对：**SUI / USDC**（先做概念验证）
- DEX/聚合：**Cetus Aggregator**（活动要求）
- 执行频率：**秒级 tick**（每秒评估一次）
- 网格参数：**用户可配置**（不写死）
- 风控：**MVP 不强制启用**，但**预留结构与接口位置**以便后续加固

---

## 1. 总体原则（尽可能简洁、可演进）

1. **链上合约只做“资金安全与权限隔离”**：资金只能在 Vault 内流转；Bot 不可提现/转出。
2. **策略与网格状态全部链下（Rust bot）**：减少 shared object 写冲突、降低 Move 复杂度。
3. **秒级执行 = 单并发交易**：同一时刻最多 0/1 笔 in-flight 交易，避免 shared object 冲突与重复下单。
4. **测试驱动开发（TDD）**：每个模块先写测试样例，再写实现；优先写最小闭环（create → deposit → authorize → trade → observe）。

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

### 2.2 Rust Bot（`bot/`）
职责：
- **秒级 tick**：拉取价格/报价 → 策略决策 → 发起交易
- **报价/路由**：通过 Cetus Aggregator（HTTP / SDK）获取路由参数 + `min_out`
- **交易执行**：签名并提交 tx，调用 Move 的 `vault_swap_*`
- **状态持久化**：SQLite（网格配置、运行状态、最近成交、失败重试等）
- **对外只读 API**：给前端展示（状态/历史/日志），以及接收用户配置（可写入配置）

并发/一致性：
- 采用“单飞行交易（single in-flight tx）”模型：发起后等待回执或超时再进入下一轮 tick。

### 2.3 Next.js 前端（`frontend/`）
职责：只做 Owner 侧管理与可视化。
- 钱包签名：创建 Vault、deposit/withdraw、暂停/恢复、把 `TraderCap` 转给 bot 地址
- 参数配置：网格参数配置（写入 bot 的配置 API）
- 可视化：Vault 余额、链上事件、bot 状态/交易历史

---

## 3. 接口草案（先把边界固定下来）

### 3.1 Move（概念接口）
> 具体函数名/参数会在实现时结合 Cetus Aggregator 的 on-chain 调用方式微调。

- `create_and_share<A, B>() -> (OwnerCap, TraderCap, vault_id)`
  - 创建并 share `Vault<A,B>`，返回两张 cap
- `deposit_a/deposit_b(vault, owner_cap, coin)`
- `withdraw_a/withdraw_b(vault, owner_cap, amount) -> Coin<T>`
- `set_paused(vault, owner_cap, bool)`
  - Owner 一键刹车（PoC 强烈建议）
- `vault_swap_a_to_b(vault, trader_cap, amount_in, min_out, cetus_route_*)`
- `vault_swap_b_to_a(vault, trader_cap, amount_in, min_out, cetus_route_*)`

风控占位（不启用但保留）：
- `RiskParams { max_in_per_trade, cooldown_ms, allowlist_dex, allowlist_coin, ... }`

### 3.2 Rust bot（内部模块接口）
- `QuoteService`：`get_quote(side, amount_in) -> { route, min_out, price }`
- `Strategy`：`decide(market, vault_snapshot, grid_state) -> Action`
- `Executor`：`execute(Action) -> TxResult`
- `Storage`：SQLite 持久化（配置、状态、历史）
- `API`：
  - `GET /status`
  - `GET /history`
  - `POST /config`（网格参数）
  - `POST /control`（start/stop）

### 3.3 前端与 bot/链上交互
- 前端：
  - 直接连接钱包与链上交互（创建/存取/暂停/授权 TraderCap）
  - 通过 HTTP 调用 bot（读状态/写配置）
- bot：
  - 只与链上交互做 `vault_swap_*`

---

## 4. 里程碑（MVP → 可用）

- **M1（链上可信边界）**：Move Vault + caps + 受限 swap 入口 + 事件 + pause
- **M2（bot 最小闭环）**：秒级 tick + 网格策略（单对）+ 交易执行 + SQLite + 最小 API
- **M3（管理面板）**：Next.js：创建/存取/授权/暂停 + 事件与 bot 状态展示
- **M4（加固与扩展）**：逐步启用风控校验、熔断、重试策略优化、更多观测与回测

---

## 5. TDD：测试矩阵（先写测试样例再写实现）

### 5.1 Move（`sui move test`）
核心测试样例：
1. **创建**：`create_and_share` 返回的 cap 与 vault 绑定正确；事件发出。
2. **权限**：无 `OwnerCap` 无法 withdraw / set_paused；无 `TraderCap` 无法 trade。
3. **资金**：deposit/withdraw 前后 Vault 余额正确。
4. **交易约束**：trade 不返回 coin；swap 输出必须回到 Vault（不可转出）。
5. **暂停**：paused 时 trade 失败（Owner 可恢复）。

### 5.2 Rust（`cargo test`）
核心测试样例：
1. **网格决策**：给定配置 + 价格序列 → 断言触发 Buy/Sell/None 与档位推进。
2. **单并发交易**：在“in-flight”状态下 tick 不应再次下单。
3. **报价解析**：mock Cetus Aggregator 响应 → 解析 route + 计算 `min_out`（slippage bps 来自配置）。
4. **失败重试**：mock 链上失败/对象冲突 → 指数退避/重试次数/状态落库一致。

### 5.3 E2E（localnet 优先）
建议做一条最小验收脚本：
1. localnet 起链
2. 创建 Vault
3. deposit SUI/USDC
4. 授权 TraderCap 给 bot 地址
5. bot 发起 1 笔 swap
6. 校验：Vault 余额变化 + TradeEvent 存在

---

## 6. 代码结构建议（清晰、可维护）

- `contracts/`：Move 包
  - `sources/`：Vault、caps、events、risk
  - `tests/`：Move 单测
- `bot/`：Rust workspace
  - `crates/`：`strategy`、`quote`、`executor`、`storage`、`api`
  - `bin/grid-bot/`：可执行入口
- `frontend/`：Next.js
- `docs/`：本文件 + 参数说明 + 运行手册

---

## 7. PoC 默认配置（先跑通再打磨）

- tick：1000ms
- 并发：单 in-flight tx
- slippage：提供默认值（例如 50–100 bps），用户可改
- 网络：E2E 优先 localnet，之后迁移到 testnet

---

## 8. 待确认/后续可选项（不阻塞 MVP）

- Cetus Aggregator 的 on-chain 调用细节：路由参数格式、需要的 object refs（实现时对齐 SDK/文档）
- 前端对链上事件的索引方式：直接 RPC query events vs 自建索引
- 风控启用策略：先加 `max_in_per_trade` / `cooldown`，再加 allowlist 与日限额
