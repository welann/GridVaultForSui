/**
 * Vault 创建和管理测试
 */
import { ContractTester, type TestResult } from './ContractTester.js';
import * as config from './config.js';

const tester = new ContractTester();
const results: TestResult[] = [];

// 用于存储测试创建的 Vault ID
let testVaultId = '';
let testOwnerCapId = '';
let testTraderCapId = '';

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
  console.log('     Vault 创建和管理测试');
  console.log('========================================\n');

  // 检查配置
  config.printConfig();
  config.validateConfig();

  if (!tester.isConfigValid()) {
    console.error('❌ 配置无效，请检查 .env 文件');
    console.log('需要设置: SUI_PRIVATE_KEY 和 PACKAGE_ID\n');
    process.exit(1);
  }

  console.log(`测试账户: ${tester.getAddress()}\n`);

  // 测试 1: 创建 Vault
  await runTest('创建 Vault', async () => {
    const { vaultId, ownerCapId, traderCapId, digest } = await tester.createVault();
    
    // 保存创建的 ID 用于后续测试
    testVaultId = vaultId;
    testOwnerCapId = ownerCapId;
    testTraderCapId = traderCapId;
    
    console.log(`   Vault ID: ${vaultId}`);
    console.log(`   OwnerCap ID: ${ownerCapId}`);
    console.log(`   TraderCap ID: ${traderCapId}`);
    console.log(`   交易: ${digest}`);
  });

  // 如果创建失败，跳过后续测试
  if (!testVaultId) {
    console.log('\n⚠️  Vault 创建失败，跳过后续测试');
    printSummary();
    process.exit(1);
  }

  // 使用新创建的 Vault 进行后续测试
  console.log('\n使用新创建的 Vault 进行后续测试:\n');

  // 测试 2: 获取 Vault 信息
  await runTest('获取 Vault 信息', async () => {
    const info = await tester.getVaultInfo(testVaultId);
    console.log(`   Balance A: ${info.balanceA}`);
    console.log(`   Balance B: ${info.balanceB}`);
    console.log(`   Paused: ${info.paused}`);
    console.log(`   Max In Per Trade: ${info.maxInPerTrade}`);
    console.log(`   Cooldown Ms: ${info.cooldownMs}`);
  });

  // 测试 3: 设置风险参数
  await runTest('设置风险参数', async () => {
    const digest = await tester.setRiskParams(testVaultId, testOwnerCapId, BigInt(1000), BigInt(5000));
    console.log(`   交易: ${digest}`);
    
    // 验证更新
    const info = await tester.getVaultInfo(testVaultId);
    if (info.maxInPerTrade !== BigInt(1000)) {
      throw new Error('风险参数未正确更新');
    }
    console.log('   ✅ 风险参数已更新');
  });

  // 测试 4: 暂停 Vault
  await runTest('暂停 Vault', async () => {
    const digest = await tester.setPaused(testVaultId, testOwnerCapId, true);
    console.log(`   交易: ${digest}`);
    
    const info = await tester.getVaultInfo(testVaultId);
    if (!info.paused) {
      throw new Error('Vault 未正确暂停');
    }
    console.log('   ✅ Vault 已暂停');
  });

  // 测试 5: 恢复 Vault
  await runTest('恢复 Vault', async () => {
    const digest = await tester.setPaused(testVaultId, testOwnerCapId, false);
    console.log(`   交易: ${digest}`);
    
    const info = await tester.getVaultInfo(testVaultId);
    if (info.paused) {
      throw new Error('Vault 未正确恢复');
    }
    console.log('   ✅ Vault 已恢复');
  });

  // 打印创建的 Vault 信息供用户保存
  console.log('\n========================================');
  console.log('     创建的 Vault 信息（请保存）');
  console.log('========================================');
  console.log(`VAULT_ID=${testVaultId}`);
  console.log(`OWNER_CAP_ID=${testOwnerCapId}`);
  console.log(`TRADER_CAP_ID=${testTraderCapId}`);
  console.log('========================================');
  console.log('\n请将这些值添加到 bot/.env 文件中\n');

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
