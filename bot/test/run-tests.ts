/**
 * GridVault 合约测试主入口
 * 运行所有测试套件
 */
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

interface TestSuite {
  name: string;
  file: string;
  description: string;
  requiresVault?: boolean;
}

const testSuites: TestSuite[] = [
  {
    name: 'Vault 创建和管理',
    file: 'vault-tests.ts',
    description: '测试 Vault 创建、暂停/恢复、风险参数设置',
    requiresVault: false,
  },
  {
    name: '存款和取款',
    file: 'deposit-tests.ts',
    description: '测试存取款功能和边界条件',
    requiresVault: true,
  },
  {
    name: '权限控制',
    file: 'permission-tests.ts',
    description: '测试 Owner 和 Trader 权限分离',
    requiresVault: true,
  },
];

// 从环境变量读取 Vault ID
let vaultId = process.env.TEST_VAULT_ID || '';
let ownerCapId = process.env.TEST_OWNER_CAP_ID || '';
let traderCapId = process.env.TEST_TRADER_CAP_ID || '';

async function runTestSuite(suite: TestSuite): Promise<boolean> {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`运行: ${suite.name}`);
  console.log(`描述: ${suite.description}`);
  console.log(`${'='.repeat(60)}\n`);

  return new Promise((resolve) => {
    const testPath = join(__dirname, suite.file);
    
    // 设置环境变量传递给子进程
    const env = {
      ...process.env,
      TEST_VAULT_ID: vaultId,
      TEST_OWNER_CAP_ID: ownerCapId,
      TEST_TRADER_CAP_ID: traderCapId,
    };
    
    const child = spawn('tsx', [testPath], {
      stdio: ['inherit', 'pipe', 'pipe'],
      shell: true,
      env,
    });

    let output = '';
    
    child.stdout?.on('data', (data) => {
      const str = data.toString();
      output += str;
      process.stdout.write(str);
      
      // 解析创建的 Vault ID
      const vaultMatch = str.match(/VAULT_ID=(0x[a-fA-F0-9]+)/);
      const ownerMatch = str.match(/OWNER_CAP_ID=(0x[a-fA-F0-9]+)/);
      const traderMatch = str.match(/TRADER_CAP_ID=(0x[a-fA-F0-9]+)/);
      
      if (vaultMatch) vaultId = vaultMatch[1];
      if (ownerMatch) ownerCapId = ownerMatch[1];
      if (traderMatch) traderCapId = traderMatch[1];
    });

    child.stderr?.on('data', (data) => {
      process.stderr.write(data);
    });

    child.on('close', (code) => {
      resolve(code === 0);
    });

    child.on('error', (err) => {
      console.error(`运行测试失败: ${err.message}`);
      resolve(false);
    });
  });
}

async function main() {
  console.log('\n');
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║            GridVault 合约集成测试套件                      ║');
  console.log('╚════════════════════════════════════════════════════════════╝');

  const results: { suite: string; success: boolean }[] = [];
  let shouldContinue = true;

  for (const suite of testSuites) {
    // 如果前面的测试失败，跳过需要 Vault 的测试
    if (suite.requiresVault && !vaultId) {
      console.log(`\n⚠️  跳过 ${suite.name} - 需要 Vault ID`);
      results.push({ suite: suite.name, success: false });
      continue;
    }

    if (!shouldContinue) {
      console.log(`\n⚠️  跳过 ${suite.name} - 前置测试失败`);
      results.push({ suite: suite.name, success: false });
      continue;
    }

    const success = await runTestSuite(suite);
    results.push({ suite: suite.name, success });
    
    if (!success) {
      shouldContinue = false;
    }
  }

  // 打印最终摘要
  console.log('\n');
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║                      最终测试摘要                          ║');
  console.log('╚════════════════════════════════════════════════════════════╝');
  
  for (const result of results) {
    const status = result.success ? '✅ 通过' : '❌ 失败';
    console.log(`  ${status} - ${result.suite}`);
  }
  
  const passed = results.filter(r => r.success).length;
  const total = results.length;
  
  console.log('\n' + '─'.repeat(60));
  console.log(`总计: ${total} 个测试套件 | 通过: ${passed} | 失败: ${total - passed}`);
  
  if (vaultId) {
    console.log('\n使用的 Vault ID:');
    console.log(`  VAULT_ID=${vaultId}`);
    console.log(`  OWNER_CAP_ID=${ownerCapId}`);
    console.log(`  TRADER_CAP_ID=${traderCapId}`);
  }
  
  console.log('═'.repeat(60) + '\n');

  process.exit(passed === total ? 0 : 1);
}

main().catch((error) => {
  console.error('测试运行器错误:', error);
  process.exit(1);
});
