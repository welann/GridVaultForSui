# GridVault 合约

Sui Move 智能合约 - 网格交易 Vault。

## 概述

GridVault 是一个资金托管合约，实现 Owner 和 Trader 权限分离：

- **Owner**: 控制资金存取、暂停交易、设置风险参数
- **Trader**: 仅可执行交易（由 Bot 持有）

## 模块结构

```
contracts/
├── Move.toml              # Move 配置
├── Move.lock              # 锁定依赖版本
├── sources/
│   └── contracts.move     # grid_vault 模块
├── tests/
│   └── contracts_tests.move   # Move 单元测试
├── package.json           # TypeScript 测试依赖
└── tsconfig.json          # TypeScript 配置
```

## 快速开始

### 构建合约

```bash
cd contracts
sui move build
```

### 运行单元测试

```bash
sui move test
```

### 部署合约

```bash
# 确保已配置 sui client
sui client publish
```

部署后会输出 Package ID，需要记录用于后续配置。

## 核心结构

### Vault

```move
public struct Vault<phantom A, phantom B> has key, store {
    id: UID,
    balance_a: balance::Balance<A>,  // 代币 A 余额
    balance_b: balance::Balance<B>,  // 代币 B 余额
    paused: bool,                     // 暂停状态
    risk: RiskParams,                 // 风险参数
}
```

### Capability

```move
// Owner 权限
public struct OwnerCap has key, store {
    id: UID,
    vault_id: ID,
}

// Trader 权限
public struct TraderCap has key, store {
    id: UID,
    vault_id: ID,
}
```

## 主要函数

### 创建 Vault

```move
public fun create_and_share<A, B>(ctx: &mut TxContext): (OwnerCap, TraderCap, ID)
```

创建 Vault 并共享，返回 OwnerCap、TraderCap 和 Vault ID。

### 存款

```move
public fun deposit_a<A, B>(vault: &mut Vault<A, B>, owner_cap: &OwnerCap, coin_in: Coin<A>)
public fun deposit_b<A, B>(vault: &mut Vault<A, B>, owner_cap: &OwnerCap, coin_in: Coin<B>)
```

Owner 存入代币 A 或 B。

### 取款

```move
public fun withdraw_a<A, B>(vault: &mut Vault<A, B>, owner_cap: &OwnerCap, amount: u64, ctx: &mut TxContext): Coin<A>
public fun withdraw_b<A, B>(vault: &mut Vault<A, B>, owner_cap: &OwnerCap, amount: u64, ctx: &mut TxContext): Coin<B>
```

Owner 取出指定金额的代币。

### 暂停/恢复

```move
public fun set_paused<A, B>(vault: &mut Vault<A, B>, owner_cap: &OwnerCap, paused: bool)
```

Owner 暂停或恢复 Vault 交易。

### 交易（未完全实现）

```move
public fun vault_swap_a_to_b<A, B>(vault: &mut Vault<A, B>, trader_cap: &TraderCap, amount_in: u64, min_out: u64, route: vector<u8>): u64
public fun vault_swap_b_to_a<A, B>(vault: &mut Vault<A, B>, trader_cap: &TraderCap, amount_in: u64, min_out: u64, route: vector<u8>): u64
```

Trader 执行交易（当前为占位实现）。

## 事件

合约会发出以下事件：

- `VaultCreatedEvent` - Vault 创建
- `DepositEvent` - 存款
- `WithdrawEvent` - 取款
- `TradeEvent` - 交易
- `PausedEvent` - 暂停状态变更
- `RiskParamsUpdatedEvent` - 风险参数更新

## 错误码

| 错误码 | 名称 | 说明 |
|--------|------|------|
| 0 | `EWrongCap` | 使用了错误的 Cap |
| 1 | `EPaused` | Vault 已暂停 |
| 2 | `ENotImplemented` | 功能未实现 |
| 3 | `EZeroAmount` | 金额为零 |
| 4 | `EInsufficientBalance` | 余额不足 |

## 集成测试

TypeScript 集成测试位于 `bot/test/` 目录：

```bash
cd bot
npx tsx test/run-tests.ts
```

测试功能：
- Vault 创建和管理
- 存款和取款
- 权限控制验证

## 配置

### Move.toml

```toml
[package]
name = "grid_vault"
edition = "2024"
version = "0.0.1"

[addresses]
grid_vault = "0x0"  # 部署时自动替换
```

### .env

合约部署后，在 `bot/.env` 中配置：

```env
PACKAGE_ID=0x...  # 部署后的包 ID
```

## 安全设计

1. **权限分离**: OwnerCap 和 TraderCap 分离，Trader 无法取款
2. **暂停机制**: Owner 可随时暂停，暂停后 Trader 无法交易
3. **金额检查**: 零金额和超额取款都会被拒绝
4. **Cap 验证**: 所有操作都验证 Cap 与 Vault 的匹配关系

## 依赖

- Sui Framework (Move 2024 Edition)

## 相关链接

- [Bot](../bot/) - 交易机器人
- [前端](../frontend/) - 管理面板
