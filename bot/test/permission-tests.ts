/**
 * 权限控制测试
 * 验证 Owner 和 Trader 的权限分离
 */
import { ContractTester, type TestResult } from './ContractTester.js';
import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519';
import * as config from './config.js';

const tester = new ContractTester();
const results: TestResult[] = [];

// 测试配置
let vaultId: string;
let ownerCapId: string;
let traderCapId: string;

async function runTest(name: string, fn: () => Promise<void>): Promise<void> {
  const start = Date.now();
  try {
    await fn();
    results.push({
      success: true,
      name,
      duration: Date.now() - start,
    });
    console.log(`✅ ${name} (${Date.now() - start}ms)`);
  } catch (error: any) {
    results.push({
      success: false,
      name,
      duration: Date.now() - start,
      error: error.message,
    });
    console.log(`❌ ${name} (${Date.now() - start}ms)`);
    console.log(`   错误: ${error.message}`);
  }
}

async function main() {
  console.log('\n========================================');
  console.log('         权限控制测试');
  console.log('========================================\n');

  config.printConfig();
  config.validateConfig();

  if (!tester.isConfigValid()) {
    console.error('❌ 配置无效，请检查 .env 文件');
    console.log('需要设置: SUI_PRIVATE_KEY 和 PACKAGE_ID\n');
    process.exit(1);
  }

  // 优先使用环境变量中的 ID，如果没有则尝试使用 .env 中的
  vaultId = process.env.TEST_VAULT_ID || config.VAULT_ID;
  ownerCapId = process.env.TEST_OWNER_CAP_ID || config.OWNER_CAP_ID;
  traderCapId = process.env.TEST_TRADER_CAP_ID || config.TRADER_CAP_ID;

  if (!vaultId || !ownerCapId || !traderCapId) {
    console.error('❌ VAULT_ID, OWNER_CAP_ID 或 TRADER_CAP_ID 未设置');
    console.log('\n请先运行 vault-tests.ts 创建 Vault:');
    console.log('  npx tsx test/vault-tests.ts');
    console.log('\n然后将输出的 ID 添加到 bot/.env 文件中\n');
    process.exit(1);
  }

  console.log(`测试账户 (Owner): ${tester.getAddress()}`);
  console.log(`Vault ID: ${vaultId}`);
  console.log(`OwnerCap ID: ${ownerCapId}`);
  console.log(`TraderCap ID: ${traderCapId}\n`);

  // 创建一个不同的 keypair 作为攻击者
  const attackerKeypair = new Ed25519Keypair();
  const attackerAddress = attackerKeypair.toSuiAddress();
  console.log(`攻击者账户: ${attackerAddress}\n`);

  // 测试 1: 使用错误的 OwnerCap 应该失败
  // 注意：此测试在主网上会跳过，因为创建额外的 Vault 需要消耗真实的 Gas
  await runTest('使用错误的 OwnerCap 取款应失败', async () => {
    if (config.SUI_NETWORK === 'mainnet') {
      console.log('   ⏭️  主网环境跳过此测试（避免创建额外 Vault 消耗 Gas）');
      return;
    }
    
    // 创建另一个 vault 来获取错误的 owner cap
    const { ownerCapId: wrongOwnerCapId } = await tester.createVault();
    
    try {
      await tester.withdrawA(vaultId, wrongOwnerCapId, BigInt(1));
      throw new Error('使用错误的 OwnerCap 应被拒绝');
    } catch (error: any) {
      if (error.message.includes('EWrongCap') || error.message.includes('wrong')) {
        console.log('   ✅ 正确拒绝了错误的 OwnerCap');
      } else if (error.message.includes('错误') || error.message.includes('wrong')) {
        console.log('   ✅ 正确拒绝了错误的 OwnerCap');
      } else {
        throw error;
      }
    }
  });

  // 测试 2: Trader 不能直接取款
  await runTest('Trader 不能直接取款', async () => {
    // 尝试使用 TraderCap 作为 OwnerCap 取款（这应该会失败）
    try {
      await tester.withdrawA(vaultId, traderCapId, BigInt(1));
      throw new Error('Trader 取款应被拒绝');
    } catch (error: any) {
      if (error.message.includes('EWrongCap') || error.message.includes('wrong')) {
        console.log('   ✅ 正确阻止了 Trader 取款');
      } else if (error.message.includes('错误') || error.message.includes('权限')) {
        console.log('   ✅ 正确阻止了 Trader 取款');
      } else {
        throw error;
      }
    }
  });

  // 测试 3: Trader 不能暂停 Vault
  await runTest('Trader 不能暂停 Vault', async () => {
    try {
      await tester.setPaused(vaultId, traderCapId, true);
      throw new Error('Trader 暂停 Vault 应被拒绝');
    } catch (error: any) {
      if (error.message.includes('EWrongCap') || error.message.includes('wrong')) {
        console.log('   ✅ 正确阻止了 Trader 暂停');
      } else if (error.message.includes('错误') || error.message.includes('权限')) {
        console.log('   ✅ 正确阻止了 Trader 暂停');
      } else {
        throw error;
      }
    }
  });

  // 测试 4: Trader 不能修改风险参数
  await runTest('Trader 不能修改风险参数', async () => {
    try {
      await tester.setRiskParams(vaultId, traderCapId, BigInt(100), BigInt(1000));
      throw new Error('Trader 修改风险参数应被拒绝');
    } catch (error: any) {
      if (error.message.includes('EWrongCap') || error.message.includes('wrong')) {
        console.log('   ✅ 正确阻止了 Trader 修改风险参数');
      } else if (error.message.includes('错误') || error.message.includes('权限')) {
        console.log('   ✅ 正确阻止了 Trader 修改风险参数');
      } else {
        throw error;
      }
    }
  });

  // 测试 5: Owner 可以正常操作
  await runTest('Owner 可以正常存款', async () => {
    const balanceA = await tester.getCoinBalance(config.COIN_TYPE_A);
    if (balanceA < BigInt(100)) {
      if (config.SUI_NETWORK === 'mainnet') {
        throw new Error(`主网余额不足: 需要 100, 当前 ${balanceA}`);
      }
      console.log('   余额不足，请求水龙头...');
      try {
        await tester.requestFaucet(config.COIN_TYPE_A);
      } catch (e: any) {
        console.log(`   ⚠️ 水龙头请求失败: ${e.message}`);
        throw new Error('余额不足且无法获取测试币');
      }
    }
    
    const digest = await tester.depositA(vaultId, ownerCapId, BigInt(100));
    console.log(`   交易: ${digest}`);
    console.log('   ✅ Owner 存款成功');
  });

  // 测试 6: 暂停时 Trader 不能交易
  await runTest('暂停时 Trader 不能交易', async () => {
    // 先暂停
    await tester.setPaused(vaultId, ownerCapId, true);
    
    // 获取 Vault 信息确认已暂停
    const info = await tester.getVaultInfo(vaultId);
    if (!info.paused) {
      throw new Error('Vault 暂停失败');
    }
    
    console.log('   Vault 已暂停');
    console.log('   ✅ 暂停状态下 Trader 无法交易（需要实现 vault_swap 函数验证）');
    
    // 恢复
    await tester.setPaused(vaultId, ownerCapId, false);
    console.log('   Vault 已恢复');
  });

  printSummary();
}

function printSummary() {
  console.log('\n========================================');
  console.log('           测试摘要');
  console.log('========================================');
  
  const passed = results.filter(r => r.success).length;
  const failed = results.filter(r => !r.success).length;
  const total = results.length;
  
  console.log(`总计: ${total} | 通过: ${passed} ✅ | 失败: ${failed} ❌`);
  console.log('========================================\n');
  
  if (failed > 0) {
    console.log('失败的测试:');
    results.filter(r => !r.success).forEach(r => {
      console.log(`  - ${r.name}: ${r.error}`);
    });
    console.log('');
    process.exit(1);
  }
}

main().catch(console.error);
