"use client"

import { useCurrentAccount, useDAppKit } from "@mysten/dapp-kit-react"
import { Transaction } from "@mysten/sui/transactions"
import { SuiClient } from "@mysten/sui/client"
import { useState, useCallback, useMemo } from "react"
import { PACKAGE_ID, COIN_TYPE_SUI, COIN_TYPE_USDC, NETWORK, RPC_URL } from "@/lib/constants"
import { shortenAddress } from "@/lib/utils"

interface VaultManagerProps {
  onVaultCreated?: (vaultId: string, ownerCapId: string, traderCapId: string) => void
}

export function VaultManager({ onVaultCreated }: VaultManagerProps) {
  const account = useCurrentAccount()
  const dAppKit = useDAppKit()
  
  // 创建独立的 SuiClient
  const suiClient = useMemo(() => {
    return new SuiClient({ 
      url: RPC_URL 
    })
  }, [])
  
  const [creating, setCreating] = useState(false)
  const [vaultId, setVaultId] = useState("")
  const [ownerCapId, setOwnerCapId] = useState("")
  const [traderCapId, setTraderCapId] = useState("")
  const [depositAmount, setDepositAmount] = useState("")
  const [userVaults, setUserVaults] = useState<Array<{id: string, balanceA: string, balanceB: string}>>([])

  /**
   * 查询用户的 Vault 列表
   */
  const fetchUserVaults = useCallback(async () => {
    if (!account) return
    
    try {
      // 查询用户拥有的 OwnerCap 对象
      const ownerCaps = await suiClient.getOwnedObjects({
        owner: account.address,
        filter: {
          StructType: `${PACKAGE_ID}::grid_vault::OwnerCap`,
        },
        options: {
          showContent: true,
        },
      })
      
      // 获取每个 OwnerCap 对应的 Vault
      const vaults = await Promise.all(
        ownerCaps.data.map(async (cap) => {
          const capData = cap.data?.content as any
          const vaultId = capData?.fields?.vault_id
          
          if (vaultId) {
            try {
              const vaultObj = await suiClient.getObject({
                id: vaultId,
                options: { showContent: true },
              })
              const vaultData = vaultObj.data?.content as any
              return {
                id: vaultId,
                balanceA: vaultData?.fields?.balance_a || "0",
                balanceB: vaultData?.fields?.balance_b || "0",
              }
            } catch {
              return null
            }
          }
          return null
        })
      )
      
      setUserVaults(vaults.filter(Boolean) as any)
    } catch (error) {
      console.error("Failed to fetch vaults:", error)
    }
  }, [account, suiClient])

  const createVault = async () => {
    if (!account || !PACKAGE_ID) return

    setCreating(true)
    try {
      const tx = new Transaction()
      
      // 调用 create_and_share 创建 Vault
      const [ownerCap, traderCap] = tx.moveCall({
        target: `${PACKAGE_ID}::grid_vault::create_and_share`,
        typeArguments: [COIN_TYPE_SUI, COIN_TYPE_USDC],
      })

      // 转移 OwnerCap 和 TraderCap 给用户
      tx.transferObjects([ownerCap, traderCap], account.address)

      const result = await dAppKit.signAndExecuteTransaction({ transaction: tx })

      if (result.FailedTransaction) {
        throw new Error(`Transaction failed: ${result.FailedTransaction.status.error?.message}`)
      }

      console.log("Vault created:", result)
      
      // 等待一下让对象索引更新
      setTimeout(async () => {
        await fetchUserVaults()
      }, 2000)
      
      onVaultCreated?.(vaultId, ownerCapId, traderCapId)
    } catch (error: any) {
      console.error("Create vault error:", error)
      alert(`创建 Vault 失败: ${error.message}`)
    } finally {
      setCreating(false)
    }
  }

  const depositSUI = async () => {
    if (!account || !vaultId || !depositAmount || !ownerCapId) {
      alert("请填写 Vault ID、OwnerCap ID 和存款金额")
      return
    }

    const tx = new Transaction()
    const amount = BigInt(Math.floor(parseFloat(depositAmount) * 1e9))

    if (amount <= 0) {
      alert("金额必须大于 0")
      return
    }

    // 分币
    const [coin] = tx.splitCoins(tx.gas, [tx.pure.u64(amount)])

    // 存入 Vault
    tx.moveCall({
      target: `${PACKAGE_ID}::grid_vault::deposit_a`,
      typeArguments: [COIN_TYPE_SUI, COIN_TYPE_USDC],
      arguments: [
        tx.object(vaultId),
        tx.object(ownerCapId),
        coin,
      ],
    })

    try {
      const result = await dAppKit.signAndExecuteTransaction({ transaction: tx })
      
      if (result.FailedTransaction) {
        throw new Error(`Transaction failed: ${result.FailedTransaction.status.error?.message}`)
      }

      alert("存款成功！")
      setDepositAmount("")
      fetchUserVaults()
    } catch (error: any) {
      console.error("Deposit error:", error)
      alert(`存款失败: ${error.message}`)
    }
  }

  const withdrawSUI = async () => {
    if (!account || !vaultId || !depositAmount || !ownerCapId) {
      alert("请填写 Vault ID、OwnerCap ID 和取款金额")
      return
    }

    const tx = new Transaction()
    const amount = BigInt(Math.floor(parseFloat(depositAmount) * 1e9))

    if (amount <= 0) {
      alert("金额必须大于 0")
      return
    }

    // 取款
    const coin = tx.moveCall({
      target: `${PACKAGE_ID}::grid_vault::withdraw_a`,
      typeArguments: [COIN_TYPE_SUI, COIN_TYPE_USDC],
      arguments: [
        tx.object(vaultId),
        tx.object(ownerCapId),
        tx.pure.u64(amount),
      ],
    })

    // 将取出的币转给用户
    tx.transferObjects([coin], account.address)

    try {
      const result = await dAppKit.signAndExecuteTransaction({ transaction: tx })
      
      if (result.FailedTransaction) {
        throw new Error(`Transaction failed: ${result.FailedTransaction.status.error?.message}`)
      }

      alert("取款成功！")
      setDepositAmount("")
      fetchUserVaults()
    } catch (error: any) {
      console.error("Withdraw error:", error)
      alert(`取款失败: ${error.message}`)
    }
  }

  const setPaused = async (paused: boolean) => {
    if (!account || !vaultId || !ownerCapId) {
      alert("请填写 Vault ID 和 OwnerCap ID")
      return
    }

    const tx = new Transaction()
    
    tx.moveCall({
      target: `${PACKAGE_ID}::grid_vault::set_paused`,
      typeArguments: [COIN_TYPE_SUI, COIN_TYPE_USDC],
      arguments: [
        tx.object(vaultId),
        tx.object(ownerCapId),
        tx.pure.bool(paused),
      ],
    })

    try {
      const result = await dAppKit.signAndExecuteTransaction({ transaction: tx })
      
      if (result.FailedTransaction) {
        throw new Error(`Transaction failed: ${result.FailedTransaction.status.error?.message}`)
      }

      alert(paused ? "Vault 已暂停" : "Vault 已恢复")
      fetchUserVaults()
    } catch (error: any) {
      console.error("Set paused error:", error)
      alert(`操作失败: ${error.message}`)
    }
  }

  if (!account) {
    return (
      <div className="card">
        <p>请先连接钱包</p>
      </div>
    )
  }

  return (
    <div className="vault-manager">
      <div className="card">
        <h2>🏦 Vault 管理</h2>
        
        <div className="section">
          <h3>创建 Vault</h3>
          <button 
            onClick={createVault} 
            disabled={creating || !PACKAGE_ID}
            className="btn btn-primary"
          >
            {creating ? "创建中..." : "创建新 Vault"}
          </button>
          <button 
            onClick={fetchUserVaults}
            className="btn btn-secondary"
            style={{ marginLeft: 12 }}
          >
            刷新列表
          </button>
          {!PACKAGE_ID && (
            <p className="hint">请先在环境变量中配置 PACKAGE_ID</p>
          )}
        </div>

        {userVaults.length > 0 && (
          <div className="section">
            <h3>我的 Vault</h3>
            {userVaults.map((vault) => (
              <div key={vault.id} className="vault-item">
                <p>ID: {shortenAddress(vault.id)}</p>
                <p>SUI: {(BigInt(vault.balanceA) / BigInt(1e9)).toString()}</p>
                <p>USDC: {(BigInt(vault.balanceB) / BigInt(1e6)).toString()}</p>
              </div>
            ))}
          </div>
        )}

        <div className="section">
          <h3>资金操作</h3>
          <input
            type="text"
            placeholder="Vault ID"
            value={vaultId}
            onChange={(e) => setVaultId(e.target.value)}
            className="input"
          />
          <input
            type="text"
            placeholder="OwnerCap ID"
            value={ownerCapId}
            onChange={(e) => setOwnerCapId(e.target.value)}
            className="input"
          />
          <input
            type="number"
            placeholder="金额 (SUI)"
            value={depositAmount}
            onChange={(e) => setDepositAmount(e.target.value)}
            className="input"
          />
          <div className="button-row">
            <button onClick={depositSUI} className="btn btn-primary">
              存入 SUI
            </button>
            <button onClick={withdrawSUI} className="btn btn-secondary">
              取出 SUI
            </button>
          </div>
        </div>

        <div className="section">
          <h3>暂停控制</h3>
          <div className="button-row">
            <button onClick={() => setPaused(true)} className="btn btn-danger">
              暂停交易
            </button>
            <button onClick={() => setPaused(false)} className="btn btn-success">
              恢复交易
            </button>
          </div>
        </div>
      </div>

      <style jsx>{`
        .vault-manager {
          margin-bottom: 24px;
        }
        .card {
          background: white;
          border-radius: 12px;
          padding: 24px;
          box-shadow: 0 2px 8px rgba(0,0,0,0.1);
        }
        h2 {
          margin-bottom: 16px;
          font-size: 20px;
        }
        h3 {
          margin: 16px 0 8px;
          font-size: 16px;
          color: #666;
        }
        .section {
          margin-bottom: 20px;
          padding-bottom: 20px;
          border-bottom: 1px solid #eee;
        }
        .section:last-child {
          border-bottom: none;
          margin-bottom: 0;
          padding-bottom: 0;
        }
        .vault-item {
          padding: 12px;
          background: #f5f5f5;
          border-radius: 8px;
          margin-bottom: 8px;
          font-size: 13px;
        }
        .vault-item p {
          margin: 4px 0;
        }
        .input {
          width: 100%;
          padding: 10px 12px;
          margin-bottom: 12px;
          border: 1px solid #ddd;
          border-radius: 8px;
          font-size: 14px;
        }
        .button-row {
          display: flex;
          gap: 12px;
        }
        .btn {
          padding: 10px 20px;
          border-radius: 8px;
          font-size: 14px;
          font-weight: 500;
          transition: opacity 0.2s;
        }
        .btn:hover:not(:disabled) {
          opacity: 0.9;
        }
        .btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }
        .btn-primary {
          background: #0070f3;
          color: white;
        }
        .btn-secondary {
          background: #f3f4f6;
          color: #374151;
        }
        .btn-success {
          background: #22c55e;
          color: white;
        }
        .btn-danger {
          background: #ef4444;
          color: white;
        }
        .hint {
          margin-top: 8px;
          font-size: 12px;
          color: #666;
        }
      `}</style>
    </div>
  )
}
