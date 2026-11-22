import type { HistoryEntry } from './types'

export type SyncProvider = 'off' | 'http' | 'webdav' | 'gist'

export interface SyncSettings {
  provider: SyncProvider
  /** 局域网 / WebDAV 的地址；Gist 不需要 */
  endpoint: string
  /** WebDAV 用户名；HTTP 模式不用 */
  username: string
  /** WebDAV 密码 / HTTP 同步密钥 */
  password: string
  /** GitHub Token（Gist） */
  token: string
  /** 已有 Gist ID，留空首次同步会自动创建 */
  gistId: string
  auto: boolean
  lastSyncAt: number
  deviceId: string
}

export interface Settings {
  theme: {
    accent: string
    radius: number
    scale: number
    density: 'compact' | 'cozy' | 'roomy'
    blur: number
    dim: number
    font: number
    focus: 'ring' | 'glow' | 'minimal'
    motion: boolean
    glass: boolean
  }
  layout: {
    hero: boolean
    rotate: boolean
    showTitles: boolean
    autoHideBar: boolean
    safe: boolean
  }
  data: {
    configUrl: string
    proxy: string
    mode: 'auto' | 'demo'
    siteKey: string
    sourceIndex: number
  }
  play: {
    autoNext: boolean
    seekStep: number
    introEnd: number
    outroStart: number
  }
  sync: SyncSettings
}

export const ACCENTS: { name: string; value: string }[] = [
  { name: '月光白', value: '#f5f5f7' },
  { name: '珊瑚红', value: '#ff6b6b' },
  { name: '冰川蓝', value: '#5aa9ff' },
  { name: '薄荷绿', value: '#3ddc97' },
  { name: '暮光紫', value: '#b18cff' },
  { name: '暖金', value: '#f4c95d' },
]

export const DEFAULT_SETTINGS: Settings = {
  theme: {
    accent: '#f5f5f7',
    radius: 14,
    scale: 1,
    density: 'cozy',
    blur: 22,
    dim: 0.62,
    font: 1,
    focus: 'ring',
    motion: true,
    glass: true,
  },
  layout: {
    hero: true,
    rotate: true,
    showTitles: true,
    autoHideBar: true,
    safe: true,
  },
  data: {
    configUrl:
      'https://cdn.jsdelivr.net/gh/othellllo/tvbox-multi@main/tvbox-multi.json',
    proxy: 'http://127.0.0.1:8787',
    mode: 'auto',
    siteKey: '',
    sourceIndex: 0,
  },
  play: {
    autoNext: true,
    seekStep: 10,
    introEnd: 0,
    outroStart: 0,
  },
  sync: {
    provider: 'off',
    endpoint: '',
    username: '',
    password: '',
    token: '',
    gistId: '',
    auto: true,
    lastSyncAt: 0,
    deviceId: '',
  },
}

const SETTINGS_KEY = 'aurora.settings.v1'
const HISTORY_KEY = 'aurora.history.v1'

export function merge<T>(base: T, patch: unknown): T {
  if (!patch || typeof patch !== 'object') return base
  const out: Record<string, unknown> = { ...(base as Record<string, unknown>) }
  for (const [k, v] of Object.entries(patch as Record<string, unknown>)) {
    const current = out[k]
    if (
      current &&
      typeof current === 'object' &&
      !Array.isArray(current) &&
      v &&
      typeof v === 'object' &&
      !Array.isArray(v)
    ) {
      out[k] = merge(current, v)
    } else if (v !== undefined) {
      out[k] = v
    }
  }
  return out as T
}

export function loadSettings(): Settings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY)
    if (!raw) return withDeviceId(structuredClone(DEFAULT_SETTINGS))
    const merged = merge(structuredClone(DEFAULT_SETTINGS), JSON.parse(raw))
    return withDeviceId(merged)
  } catch {
    return withDeviceId(structuredClone(DEFAULT_SETTINGS))
  }
}

function withDeviceId(settings: Settings): Settings {
  if (settings.sync.deviceId) return settings
  const id =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : `device-${Date.now().toString(36)}`
  return { ...settings, sync: { ...settings.sync, deviceId: id } }
}

/** 导出同步码时不要把同步凭证带出去（连 sync 整段都省略，导入时不会覆盖本机同步配置） */
export function stripSyncSecrets(settings: Settings): Settings {
  const { sync: _sync, ...rest } = settings
  return rest as Settings
}

export function saveSettings(settings: Settings) {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings))
  } catch {
    /* 隐私模式等场景忽略 */
  }
}

export function loadHistory(): HistoryEntry[] {
  try {
    const raw = localStorage.getItem(HISTORY_KEY)
    if (!raw) return []
    const list = JSON.parse(raw)
    return Array.isArray(list) ? list : []
  } catch {
    return []
  }
}

export function saveHistory(list: HistoryEntry[]) {
  try {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(list.slice(0, 60)))
  } catch {
    /* ignore */
  }
}

export function upsertHistory(entry: HistoryEntry): HistoryEntry[] {
  const list = loadHistory().filter((h) => h.mediaKey !== entry.mediaKey)
  list.unshift(entry)
  const next = list.slice(0, 60)
  saveHistory(next)
  return next
}

/** 供“同步码”使用的可移植快照 */
export interface SyncPayload {
  app: 'aurora-tv'
  version: 1
  settings?: Partial<Settings>
  history?: HistoryEntry[]
  exportedAt: number
}

export function encodeSync(payload: SyncPayload): string {
  const json = JSON.stringify(payload)
  return btoa(unescape(encodeURIComponent(json)))
}

export function decodeSync(code: string): SyncPayload {
  const json = decodeURIComponent(escape(atob(code.trim())))
  const payload = JSON.parse(json)
  if (payload?.app !== 'aurora-tv') throw new Error('不是 Aurora TV 的同步码')
  return payload
}

export const DENSITY_WIDTH: Record<Settings['theme']['density'], number> = {
  compact: 168,
  cozy: 192,
  roomy: 220,
}
