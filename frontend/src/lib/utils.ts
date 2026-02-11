/**
 * 工具函数
 */

/**
 * 格式化金额显示
 */
export function formatAmount(amount: bigint | string, decimals: number = 9): string {
  const amountStr = amount.toString()
  const padded = amountStr.padStart(decimals + 1, "0")
  const integer = padded.slice(0, -decimals) || "0"
  const fraction = padded.slice(-decimals).replace(/0+$/, "")
  return fraction ? `${integer}.${fraction}` : integer
}

/**
 * 缩短地址显示
 */
export function shortenAddress(address: string, chars: number = 6): string {
  if (address.length <= chars * 2) return address
  return `${address.slice(0, chars)}...${address.slice(-chars)}`
}

/**
 * 格式化时间戳
 */
export function formatTimestamp(timestamp: number): string {
  return new Date(timestamp).toLocaleString("zh-CN")
}

/**
 * 格式化价格
 */
export function formatPrice(price: number): string {
  return price.toFixed(6)
}

/**
 * 计算网格线
 */
export function computeGridLines(
  lowerPrice: number,
  upperPrice: number,
  levels: number
): number[] {
  const step = (upperPrice - lowerPrice) / levels
  const lines: number[] = []
  for (let i = 0; i <= levels; i++) {
    lines.push(lowerPrice + step * i)
  }
  return lines
}
