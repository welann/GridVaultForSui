/**
 * GridVault 合约测试工具类
 * 封装与合约的交互操作
 * 使用 @mysten/sui v1.x API (与 src 目录一致)
 */
import { 
  SuiClient, 
  getFullnodeUrl,
} from '@mysten/sui/client';
import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519';
import { Transaction } from '@mysten/sui/transactions';
import type { 
  SuiTransactionBlockResponse,
} from '@mysten/sui/client';
import * as config from './config.js';

export interface VaultInfo {
  id: string;
  balanceA: bigint;
  balanceB: bigint;
  paused: boolean;
  maxInPerTrade: bigint;
  cooldownMs: bigint;
}

export interface TestResult {
  success: boolean;
  name: string;
  duration: number;
  error?: string;
  digest?: string;
}

export class ContractTester {
  client: SuiClient;
  keypair: Ed25519Keypair;
  packageId: string;
  sender: string;

  constructor() {
    // 初始化客户端
    this.client = new SuiClient({ url: config.SUI_RPC_URL });
    
    // 初始化密钥对
    if (!config.SUI_PRIVATE_KEY) {
      throw new Error('SUI_PRIVATE_KEY 未设置');
    }
    // 处理 suiprivkey1 格式的私钥
    this.keypair = this.parsePrivateKey(config.SUI_PRIVATE_KEY);
    this.sender = this.keypair.toSuiAddress();
    this.packageId = config.PACKAGE_ID;
  }

  /**
   * 解析私钥，支持多种格式
   * v1.x 中 fromSecretKey 可以直接接受 suiprivkey1 格式的字符串
   */
  private parsePrivateKey(privateKey: string): Ed25519Keypair {
    // v1.x API 可以直接处理 suiprivkey1 格式的字符串
    return Ed25519Keypair.fromSecretKey(privateKey);
  }

  /**
   * 获取当前账户地址
   */
  getAddress(): string {
    return this.sender;
  }

  /**
   * 检查配置是否完整
   */
  isConfigValid(): boolean {
    return !!this.packageId && !!config.SUI_PRIVATE_KEY;
  }

  /**
   * 等待交易确认
   */
  async waitForTransaction(digest: string): Promise<SuiTransactionBlockResponse> {
    return this.client.waitForTransaction({
      digest,
      options: {
        showEffects: true,
        showEvents: true,
        showObjectChanges: true,
      },
    });
  }

  /**
   * 执行交易并等待确认
   */
  async executeTransaction(tx: Transaction): Promise<SuiTransactionBlockResponse> {
    tx.setSender(this.sender);
    tx.setGasBudget(config.GAS_BUDGET);

    const result = await this.client.signAndExecuteTransaction({
      signer: this.keypair,
      transaction: tx,
      options: {
        showEffects: true,
        showEvents: true,
        showObjectChanges: true,
      },
    });

    const response = await this.waitForTransaction(result.digest);
    
    // 检查交易是否成功执行（ Move 合约是否 abort）
    const status = response.effects?.status;
    if (status?.status !== 'success') {
      const errorMessage = status?.error || '交易执行失败';
      throw new Error(errorMessage);
    }
    
    return response;
  }

  /**
   * 创建 Vault
   */
  async createVault(): Promise<{ vaultId: string; ownerCapId: string; traderCapId: string; digest: string }> {
    const tx = new Transaction();
    
    const [ownerCap, traderCap] = tx.moveCall({
      target: `${this.packageId}::${config.MODULE_NAME}::create_and_share`,
      typeArguments: [config.COIN_TYPE_A, config.COIN_TYPE_B],
    });

    // 转移 OwnerCap 和 TraderCap 给发送者
    tx.transferObjects([ownerCap, traderCap], this.sender);

    const result = await this.executeTransaction(tx);
    
    // 从结果中提取对象 ID
    const objectChanges = result.objectChanges || [];
    const createdObjects = objectChanges.filter(
      (change: any) => change.type === 'created'
    );

    let vaultId = '';
    let ownerCapId = '';
    let traderCapId = '';

    for (const obj of createdObjects) {
      const objectType = (obj as any).objectType as string;
      if (objectType.includes('Vault<')) {
        vaultId = (obj as any).objectId;
      } else if (objectType.includes('OwnerCap')) {
        ownerCapId = (obj as any).objectId;
      } else if (objectType.includes('TraderCap')) {
        traderCapId = (obj as any).objectId;
      }
    }

    if (!vaultId || !ownerCapId || !traderCapId) {
      throw new Error('无法从交易结果中提取 Vault 或 Cap IDs');
    }

    return { vaultId, ownerCapId, traderCapId, digest: result.digest };
  }

  /**
   * 获取 Vault 信息
   */
  async getVaultInfo(vaultId: string): Promise<VaultInfo> {
    const response = await this.client.getObject({
      id: vaultId,
      options: { showContent: true },
    });

    if (!response.data?.content) {
      throw new Error(`无法获取 Vault ${vaultId} 的信息`);
    }

    const content = response.data.content as any;
    const fields = content.fields;

    return {
      id: vaultId,
      balanceA: BigInt(fields.balance_a || 0),
      balanceB: BigInt(fields.balance_b || 0),
      paused: fields.paused || false,
      maxInPerTrade: BigInt(fields.risk?.fields?.max_in_per_trade || 0),
      cooldownMs: BigInt(fields.risk?.fields?.cooldown_ms || 0),
    };
  }

  /**
   * 存款到 Vault (Coin A)
   * 
   * 注意：当 Coin A 是 SUI 时，需要特别处理 gas coin 和存款 coin 的分离
   */
  async depositA(vaultId: string, ownerCapId: string, amount: bigint): Promise<string> {
    const tx = new Transaction();
    const coins = await this.client.getCoins({
      owner: this.sender,
      coinType: config.COIN_TYPE_A,
    });

    if (coins.data.length === 0) {
      throw new Error('没有足够的 Coin A 用于存款');
    }

    // 计算总余额
    const totalBalance = coins.data.reduce((sum, coin) => sum + BigInt(coin.balance), BigInt(0));
    if (totalBalance < amount) {
      throw new Error(`Coin A 余额不足: 需要 ${amount}, 当前 ${totalBalance}`);
    }

    let coinToDeposit;

    if (config.COIN_TYPE_A === '0x2::sui::SUI') {
      // 当 Coin A 是 SUI 时，需要使用特殊处理
      // 保留足够的 gas（约 0.1 SUI = 100000000 MIST），其余用于存款
      const gasBuffer = BigInt(100000000); // 0.1 SUI for gas buffer
      
      if (coins.data.length === 1) {
        // 只有一个 SUI coin，直接从 gas 分割
        const coinBalance = BigInt(coins.data[0].balance);
        if (coinBalance < amount + gasBuffer) {
          throw new Error(`SUI 余额不足: 需要 ${amount} + ${gasBuffer}(gas), 当前 ${coinBalance}`);
        }
        // 使用 tx.gas 作为 source coin 进行分割
        coinToDeposit = tx.splitCoins(tx.gas, [tx.pure.u64(Number(amount))]);
      } else {
        // 有多个 SUI coins，合并所有非 gas coin
        const gasCoinId = coins.data[0].coinObjectId;
        const otherCoins = coins.data.slice(1);
        
        // 合并其他 coins
        tx.mergeCoins(
          tx.object(gasCoinId),
          otherCoins.map(c => tx.object(c.coinObjectId))
        );
        
        // 从合并后的 coin 分割（使用 tx.gas 引用）
        coinToDeposit = tx.splitCoins(tx.gas, [tx.pure.u64(Number(amount))]);
      }
    } else {
      // 非 SUI coin，正常处理
      const primaryCoin = coins.data[0];
      
      if (coins.data.length > 1) {
        // 合并所有 coins 到第一个 coin
        tx.mergeCoins(
          tx.object(primaryCoin.coinObjectId),
          coins.data.slice(1).map(c => tx.object(c.coinObjectId))
        );
      }
      
      // 从第一个 coin 分割出需要的金额
      coinToDeposit = tx.splitCoins(tx.object(primaryCoin.coinObjectId), [tx.pure.u64(Number(amount))]);
    }

    tx.moveCall({
      target: `${this.packageId}::${config.MODULE_NAME}::deposit_a`,
      typeArguments: [config.COIN_TYPE_A, config.COIN_TYPE_B],
      arguments: [
        tx.object(vaultId),
        tx.object(ownerCapId),
        coinToDeposit,
      ],
    });

    const result = await this.executeTransaction(tx);
    return result.digest;
  }

  /**
   * 存款到 Vault (Coin B)
   * 
   * 注意：当 Coin B 也是 SUI 时（罕见情况），需要特别处理
   */
  async depositB(vaultId: string, ownerCapId: string, amount: bigint): Promise<string> {
    const tx = new Transaction();
    const coins = await this.client.getCoins({
      owner: this.sender,
      coinType: config.COIN_TYPE_B,
    });

    if (coins.data.length === 0) {
      throw new Error('没有足够的 Coin B 用于存款');
    }

    // 计算总余额
    const totalBalance = coins.data.reduce((sum, coin) => sum + BigInt(coin.balance), BigInt(0));
    if (totalBalance < amount) {
      throw new Error(`Coin B 余额不足: 需要 ${amount}, 当前 ${totalBalance}`);
    }

    let coinToDeposit;

    // 检查 Coin B 是否也是 SUI（这种情况比较罕见，但理论上可能发生）
    if (config.COIN_TYPE_B === '0x2::sui::SUI') {
      const gasBuffer = BigInt(100000000); // 0.1 SUI for gas buffer
      
      if (coins.data.length === 1) {
        const coinBalance = BigInt(coins.data[0].balance);
        if (coinBalance < amount + gasBuffer) {
          throw new Error(`SUI 余额不足: 需要 ${amount} + ${gasBuffer}(gas), 当前 ${coinBalance}`);
        }
        coinToDeposit = tx.splitCoins(tx.gas, [tx.pure.u64(Number(amount))]);
      } else {
        const gasCoinId = coins.data[0].coinObjectId;
        const otherCoins = coins.data.slice(1);
        
        tx.mergeCoins(
          tx.object(gasCoinId),
          otherCoins.map(c => tx.object(c.coinObjectId))
        );
        
        coinToDeposit = tx.splitCoins(tx.gas, [tx.pure.u64(Number(amount))]);
      }
    } else {
      // 非 SUI coin，正常处理
      const primaryCoin = coins.data[0];
      
      if (coins.data.length > 1) {
        // 合并所有 coins 到第一个 coin
        tx.mergeCoins(
          tx.object(primaryCoin.coinObjectId),
          coins.data.slice(1).map(c => tx.object(c.coinObjectId))
        );
      }
      
      coinToDeposit = tx.splitCoins(tx.object(primaryCoin.coinObjectId), [tx.pure.u64(Number(amount))]);
    }

    tx.moveCall({
      target: `${this.packageId}::${config.MODULE_NAME}::deposit_b`,
      typeArguments: [config.COIN_TYPE_A, config.COIN_TYPE_B],
      arguments: [
        tx.object(vaultId),
        tx.object(ownerCapId),
        coinToDeposit,
      ],
    });

    const result = await this.executeTransaction(tx);
    return result.digest;
  }

  /**
   * 从 Vault 取款 (Coin A)
   */
  async withdrawA(vaultId: string, ownerCapId: string, amount: bigint): Promise<string> {
    const tx = new Transaction();

    const [coin] = tx.moveCall({
      target: `${this.packageId}::${config.MODULE_NAME}::withdraw_a`,
      typeArguments: [config.COIN_TYPE_A, config.COIN_TYPE_B],
      arguments: [
        tx.object(vaultId),
        tx.object(ownerCapId),
        tx.pure.u64(Number(amount)),
      ],
    });

    tx.transferObjects([coin], this.sender);

    const result = await this.executeTransaction(tx);
    return result.digest;
  }

  /**
   * 从 Vault 取款 (Coin B)
   */
  async withdrawB(vaultId: string, ownerCapId: string, amount: bigint): Promise<string> {
    const tx = new Transaction();

    const [coin] = tx.moveCall({
      target: `${this.packageId}::${config.MODULE_NAME}::withdraw_b`,
      typeArguments: [config.COIN_TYPE_A, config.COIN_TYPE_B],
      arguments: [
        tx.object(vaultId),
        tx.object(ownerCapId),
        tx.pure.u64(Number(amount)),
      ],
    });

    tx.transferObjects([coin], this.sender);

    const result = await this.executeTransaction(tx);
    return result.digest;
  }

  /**
   * 设置暂停状态
   */
  async setPaused(vaultId: string, ownerCapId: string, paused: boolean): Promise<string> {
    const tx = new Transaction();

    tx.moveCall({
      target: `${this.packageId}::${config.MODULE_NAME}::set_paused`,
      typeArguments: [config.COIN_TYPE_A, config.COIN_TYPE_B],
      arguments: [
        tx.object(vaultId),
        tx.object(ownerCapId),
        tx.pure.bool(paused),
      ],
    });

    const result = await this.executeTransaction(tx);
    return result.digest;
  }

  /**
   * 设置风险参数
   */
  async setRiskParams(
    vaultId: string, 
    ownerCapId: string, 
    maxInPerTrade: bigint, 
    cooldownMs: bigint
  ): Promise<string> {
    const tx = new Transaction();

    tx.moveCall({
      target: `${this.packageId}::${config.MODULE_NAME}::set_risk_params`,
      typeArguments: [config.COIN_TYPE_A, config.COIN_TYPE_B],
      arguments: [
        tx.object(vaultId),
        tx.object(ownerCapId),
        tx.pure.u64(Number(maxInPerTrade)),
        tx.pure.u64(Number(cooldownMs)),
      ],
    });

    const result = await this.executeTransaction(tx);
    return result.digest;
  }

  /**
   * 获取账户余额
   */
  async getBalances() {
    const balances = await this.client.getAllBalances({
      owner: this.sender,
    });
    return balances;
  }

  /**
   * 获取特定代币余额
   */
  async getCoinBalance(coinType: string): Promise<bigint> {
    try {
      const balance = await this.client.getBalance({
        owner: this.sender,
        coinType,
      });
      return BigInt(balance.totalBalance);
    } catch {
      return BigInt(0);
    }
  }

  /**
   * 请求测试币（仅 testnet/devnet）
   */
  async requestFaucet(coinType: string = '0x2::sui::SUI'): Promise<void> {
    if (config.SUI_NETWORK === 'mainnet') {
      throw new Error('主网无法使用水龙头');
    }

    const response = await fetch(`https://faucet.${config.SUI_NETWORK}.sui.io/gas`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        FixedAmountRequest: {
          recipient: this.sender,
        },
      }),
    });

    if (!response.ok) {
      throw new Error(`水龙头请求失败: ${response.statusText}`);
    }

    // 等待交易确认
    const result: any = await response.json();
    if (result.transferredGasObjects && result.transferredGasObjects.length > 0) {
      const digest = result.transferredGasObjects[0].transferTxDigest;
      await this.waitForTransaction(digest);
    }
  }
}
