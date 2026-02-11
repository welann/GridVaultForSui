/**
 * Utility functions
 */

/**
 * Format amount display
 */
export function formatAmount(amount: bigint | string, decimals: number = 9): string {
  const amountStr = amount.toString()
  const padded = amountStr.padStart(decimals + 1, "0")
  const integer = padded.slice(0, -decimals) || "0"
  const fraction = padded.slice(-decimals).replace(/0+$/, "")
  return fraction ? `${integer}.${fraction}` : integer
}

/**
 * Shorten address display
 */
export function shortenAddress(address: string, chars: number = 6): string {
  if (address.length <= chars * 2) return address
  return `${address.slice(0, chars)}...${address.slice(-chars)}`
}

/**
 * Format timestamp
 */
export function formatTimestamp(timestamp: number): string {
  return new Date(timestamp).toLocaleString("en-US")
}

/**
 * Format price
 */
export function formatPrice(price: number): string {
  return price.toFixed(6)
}

/**
 * Compute grid lines
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
