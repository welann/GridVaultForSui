import { BOT_API_URL } from "@/lib/constants"

const BOT_API_URL_STORAGE_KEY = "gridvault.bot_api_url"
const BOT_API_URL_CHANGE_EVENT = "gridvault:bot-api-url-changed"

function ensureProtocol(url: string): string {
  if (/^https?:\/\//i.test(url)) return url
  return `http://${url}`
}

export function normalizeBotApiUrl(url: string): string {
  const trimmed = url.trim()
  if (!trimmed) {
    return BOT_API_URL.replace(/\/+$/, "")
  }
  return ensureProtocol(trimmed).replace(/\/+$/, "")
}

export function getBotApiUrl(): string {
  if (typeof window === "undefined") {
    return normalizeBotApiUrl(BOT_API_URL)
  }

  const saved = window.localStorage.getItem(BOT_API_URL_STORAGE_KEY)
  if (!saved) {
    return normalizeBotApiUrl(BOT_API_URL)
  }

  return normalizeBotApiUrl(saved)
}

export function setBotApiUrl(url: string): string {
  const normalized = normalizeBotApiUrl(url)
  if (typeof window !== "undefined") {
    window.localStorage.setItem(BOT_API_URL_STORAGE_KEY, normalized)
    window.dispatchEvent(new CustomEvent(BOT_API_URL_CHANGE_EVENT, { detail: normalized }))
  }
  return normalized
}

export function resetBotApiUrl(): string {
  const normalized = normalizeBotApiUrl(BOT_API_URL)
  if (typeof window !== "undefined") {
    window.localStorage.removeItem(BOT_API_URL_STORAGE_KEY)
    window.dispatchEvent(new CustomEvent(BOT_API_URL_CHANGE_EVENT, { detail: normalized }))
  }
  return normalized
}

export { BOT_API_URL_STORAGE_KEY, BOT_API_URL_CHANGE_EVENT }
