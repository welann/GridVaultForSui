/**
 * 存款和取款测试
 */
import { ContractTester, type TestResult } from './ContractTester.js';
import * as config from './config.js';

const tester = new ContractTester();
const results: TestResult[] = [];

// 测试配置
let vaultId: string;
let ownerCapId: string;

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
  console.log('       存款和取款测试');
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

  if (!vaultId || !ownerCapId) {
    console.error('❌ VAULT_ID 或 OWNER_CAP_ID 未设置');
    console.log('\n请先运行 vault-tests.ts 创建 Vault:');
    console.log('  npx tsx test/vault-tests.ts');
    console.log('\n然后将输出的 ID 添加到 bot/.env 文件中\n');
    process.exit(1);
  }

  console.log(`测试账户: ${tester.getAddress()}`);
  console.log(`Vault ID: ${vaultId}\n`);

  // 获取初始余额
  let initialInfo = await tester.getVaultInfo(vaultId);
  console.log('初始 Vault 状态:');
  console.log(`  Balance A: ${initialInfo.balanceA}`);
  console.log(`  Balance B: ${initialInfo.balanceB}\n`);

  // 获取账户余额
  const balanceA = await tester.getCoinBalance(config.COIN_TYPE_A);
  const balanceB = await tester.getCoinBalance(config.COIN_TYPE_B);
  console.log('账户余额:');
  console.log(`  Coin A: ${balanceA}`);
  console.log(`  Coin B: ${balanceB}\n`);

  // 测试 1: 存款 Coin A
  await runTest('存款 Coin A (1000)', async () => {
    if (balanceA < BigInt(1000)) {
      console.log('   余额不足，尝试请求水龙头...');
      try {
        await tester.requestFaucet(config.COIN_TYPE_A);
        console.log('   ✅ 水龙头请求成功');
      } catch (e: any) {
        console.log(`   ⚠️ 水龙头请求失败: ${e.message}`);
        throw new Error('余额不足且无法获取测试币');
      }
    }
    
    const digest = await tester.depositA(vaultId, ownerCapId, BigInt(1000));
    console.log(`   交易: ${digest}`);
    
    const info = await tester.getVaultInfo(vaultId);
    console.log(`   新 Balance A: ${info.balanceA}`);
    
    if (info.balanceA < initialInfo.balanceA + BigInt(1000)) {
      throw new Error('存款未正确记录');
    }
    console.log('   ✅ 存款成功');
  });

  // 更新初始余额
  initialInfo = await tester.getVaultInfo(vaultId);

  // 测试 2: 存款 Coin B
  await runTest('存款 Coin B (5000)', async () => {
    if (balanceB < BigInt(5000)) {
      console.log('   ⚠️  Coin B 余额不足，跳过');
      return;
    }
    
    const digest = await tester.depositB(vaultId, ownerCapId, BigInt(5000));
    console.log(`   交易: ${digest}`);
    
    const info = await tester.getVaultInfo(vaultId);
    console.log(`   新 Balance B: ${info.balanceB}`);
    
    if (info.balanceB < initialInfo.balanceB + BigInt(5000)) {
      throw new Error('存款未正确记录');
    }
    console.log('   ✅ 存款成功');
  });

  // 更新初始余额
  initialInfo = await tester.getVaultInfo(vaultId);

  // 测试 3: 取款 Coin A
  await runTest('取款 Coin A (400)', async () => {
    if (initialInfo.balanceA < BigInt(400)) {
      throw new Error('Vault 余额不足');
    }
    
    const digest = await tester.withdrawA(vaultId, ownerCapId, BigInt(400));
    console.log(`   交易: ${digest}`);
    
    const info = await tester.getVaultInfo(vaultId);
    console.log(`   新 Balance A: ${info.balanceA}`);
    
    if (info.balanceA !== initialInfo.balanceA - BigInt(400)) {
      throw new Error('取款未正确记录');
    }
    console.log('   ✅ 取款成功');
  });

  // 测试 4: 取款 Coin B
  await runTest('取款 Coin B (2000)', async () => {
    if (initialInfo.balanceB < BigInt(2000)) {
      console.log('   ⚠️  Vault 中 Coin B 余额不足，跳过');
      return;
    }
    
    const digest = await tester.withdrawB(vaultId, ownerCapId, BigInt(2000));
    console.log(`   交易: ${digest}`);
    
    const info = await tester.getVaultInfo(vaultId);
    console.log(`   新 Balance B: ${info.balanceB}`);
    
    if (info.balanceB !== initialInfo.balanceB - BigInt(2000)) {
      throw new Error('取款未正确记录');
    }
    console.log('   ✅ 取款成功');
  });

  // 测试 5: 零金额存款应失败
  await runTest('零金额存款应被拒绝', async () => {
    try {
      await tester.depositA(vaultId, ownerCapId, BigInt(0));
      throw new Error('零金额存款应被拒绝，但交易成功了');
    } catch (error: any) {
      if (error.message.includes('EZeroAmount') || error.message.includes('zero')) {
        console.log('   ✅ 正确拒绝了零金额存款');
      } else if (error.message.includes('被')) {
        console.log('   ✅ 正确拒绝了零金额存款');
      } else {
        throw error;
      }
    }
  });

  // 测试 6: 超额取款应失败
  await runTest('超额取款应被拒绝', async () => {
    const info = await tester.getVaultInfo(vaultId);
    const excessiveAmount = info.balanceA + BigInt(1000000);
    
    try {
      await tester.withdrawA(vaultId, ownerCapId, excessiveAmount);
      throw new Error('超额取款应被拒绝，但交易成功了');
    } catch (error: any) {
      if (error.message.includes('EInsufficientBalance') || error.message.includes('insufficient')) {
        console.log('   ✅ 正确拒绝了超额取款');
      } else if (error.message.includes('不足')) {
        console.log('   ✅ 正确拒绝了超额取款');
      } else {
        throw error;
      }
    }
  });

  // 最终状态
  const finalInfo = await tester.getVaultInfo(vaultId);
  console.log('\n最终 Vault 状态:');
  console.log(`  Balance A: ${finalInfo.balanceA}`);
  console.log(`  Balance B: ${finalInfo.balanceB}\n`);

  printSummary();
}

function printSummary() {
  console.log('========================================');
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
