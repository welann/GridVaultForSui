# GridVault 合约集成测试

使用 TypeScript 编写的合约集成测试套件，用于验证部署在链上的合约功能。

## 目录结构

```
bot/test/
├── README.md              # 本说明文件
├── config.ts              # 测试配置文件，从 .env 加载
├── ContractTester.ts      # 合约测试工具类
├── run-tests.ts           # 测试主入口
├── vault-tests.ts         # Vault 创建和管理测试
├── deposit-tests.ts       # 存款和取款测试
└── permission-tests.ts    # 权限控制测试
```

## 安装依赖

测试代码位于 `bot/` 目录下，依赖与 Bot 共享：

```bash
cd bot
npm install
```

## 配置

测试配置从 `bot/.env` 文件加载。

1. 复制 `.env.example` 到 `.env`（如果还没有）：
```bash
cd bot
cp .env.example .env
```

2. 编辑 `.env` 文件，填入必要的配置：

```env
# 网络配置
SUI_NETWORK=testnet

# 测试账户私钥（suiprivkey1 格式）
SUI_PRIVATE_KEY=0x...

# 合约包 ID（部署合约后填入）
PACKAGE_ID=0x...

# Vault 相关 ID（创建 Vault 后填入，可选）
VAULT_ID=0x...
OWNER_CAP_ID=0x...
TRADER_CAP_ID=0x...
```

## 运行测试

### 运行所有测试
```bash
cd bot
npx tsx test/run-tests.ts
```

### 运行单个测试套件
```bash
cd bot

# Vault 创建和管理测试
npx tsx test/vault-tests.ts

# 存款和取款测试
npx tsx test/deposit-tests.ts

# 权限控制测试
npx tsx test/permission-tests.ts
```

## 测试流程

### 首次测试（没有 Vault）

1. **创建 Vault**：
   ```bash
   cd bot
   npx tsx test/vault-tests.ts
   ```
   测试会创建一个新的 Vault，并输出 Vault ID、OwnerCap ID 和 TraderCap ID。

2. **更新 .env 文件**：
   将输出的 ID 填入 `bot/.env` 文件：
   ```env
   VAULT_ID=0x...
   OWNER_CAP_ID=0x...
   TRADER_CAP_ID=0x...
   ```

3. **运行存款测试**：
   ```bash
   npx tsx test/deposit-tests.ts
   ```

4. **运行权限测试**：
   ```bash
   npx tsx test/permission-tests.ts
   ```

### 已有 Vault 的测试

如果已经有了 Vault，直接在 `bot/.env` 中填入相关 ID，然后运行测试：
```bash
cd bot
npx tsx test/run-tests.ts
```

## 测试功能覆盖

### Vault 创建和管理测试 (`vault-tests.ts`)
- ✅ 创建 Vault
- ✅ 获取 Vault 信息
- ✅ 设置风险参数
- ✅ 暂停 Vault
- ✅ 恢复 Vault

### 存款和取款测试 (`deposit-tests.ts`)
- ✅ 存款 Coin A (SUI)
- ✅ 存款 Coin B (USDC)
- ✅ 取款 Coin A
- ✅ 取款 Coin B
- ✅ 零金额存款拒绝
- ✅ 超额取款拒绝

### 权限控制测试 (`permission-tests.ts`)
- ✅ 错误的 OwnerCap 被拒绝
- ✅ Trader 不能直接取款
- ✅ Trader 不能暂停 Vault
- ✅ Trader 不能修改风险参数
- ✅ 暂停时 Trader 不能交易

## 错误码说明

合约中的错误码：
- `EWrongCap (0)`: 使用了错误的 Cap
- `EPaused (1)`: Vault 已暂停
- `ENotImplemented (2)`: 功能未实现
- `EZeroAmount (3)`: 金额为零
- `EInsufficientBalance (4)`: 余额不足

## 网络支持

- `testnet`: 测试网（推荐）
- `mainnet`: 主网
- `localnet`: 本地网络

## 注意事项

1. **Gas 费用**：测试会在链上执行交易，需要消耗 Gas。确保测试账户有足够的 SUI。

2. **水龙头**：在 testnet 上，如果余额不足，部分测试会自动请求水龙头。

3. **并发执行**：测试是顺序执行的，不建议并发运行多个测试实例。

4. **状态依赖**：部分测试依赖于 Vault 的状态，确保按顺序运行测试。

### Mainnet 测试注意事项

在 mainnet 上运行测试时需要特别注意：

1. **余额检查**：mainnet 上不会自动请求水龙头，测试前请确保账户有足够的 SUI 余额。

2. **跳过部分测试**：`permission-tests.ts` 中的"使用错误的 OwnerCap 取款应失败"测试在 mainnet 上会跳过，因为该测试需要创建额外的 Vault 来验证权限，会消耗真实的 Gas。

3. **代币类型**：确保 `.env` 文件中的 `COIN_TYPE_B` 设置为 mainnet 的 USDC 地址：
   ```env
   COIN_TYPE_B=0xdba34672e30cb065b1f93e3ab55318768fd6fef66c15942c9f7cb846e2f900e7::usdc::USDC
   ```

4. **风险**：mainnet 测试会消耗真实的代币，建议：
   - 使用专门的测试账户
   - 小额存款测试（修改测试文件中的金额）
   - 仔细确认 Vault ID 和 Cap ID 正确
   - 避免在 permission-tests.ts 中运行会创建新 Vault 的测试

## 扩展测试

要添加新的测试，可以创建新的测试文件，参考现有测试的结构：

```typescript
import { ContractTester } from './ContractTester.js';
import * as config from './config.js';

const tester = new ContractTester();

async function main() {
  // 你的测试代码
}

main().catch(console.error);
```

## 调试

在代码中添加日志输出：
```typescript
console.log('调试信息:', variable);
```

## API 兼容性

测试代码使用 `@mysten/sui` v1.15.1：

```typescript
// 导入路径
import { SuiClient, getFullnodeUrl } from '@mysten/sui/client';
import { Transaction } from '@mysten/sui/transactions';
import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519';
```
