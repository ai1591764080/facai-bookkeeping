/**
 * 配置备份：把「设置项」与「记账数据」分开备份
 *
 * 数据备份（utils/backup.ts）导出的是交易/分类/账户等账目数据；
 * 这里导出的是 AI 服务、语音引擎、讯飞凭证、OCR、偏好等配置，
 * 目的是换设备或重装后一次导入就能恢复全部设置，不用一项项重填。
 */

export const CONFIG_APP_ID = 'facai-bookkeeping'
export const CONFIG_VERSION = 1

/** 参与备份的配置项：key 为本地存储键，sensitive 表示含密钥等敏感信息 */
export const CONFIG_KEYS: { key: string; label: string; sensitive: boolean }[] = [
  { key: 'beecount_ai_config', label: 'AI 服务配置', sensitive: true },
  { key: 'beecount_asr_config', label: '语音识别引擎配置', sensitive: true },
  { key: 'beecount_xfyun_appid', label: '讯飞 AppID', sensitive: true },
  { key: 'beecount_xfyun_apikey', label: '讯飞 API Key', sensitive: true },
  { key: 'beecount_xfyun_secret', label: '讯飞 API Secret', sensitive: true },
  { key: 'beecount_ocr_url', label: 'OCR 接口地址', sensitive: false },
  { key: 'beecount_ocr_token', label: 'OCR Token', sensitive: true },
  { key: 'beecount_theme', label: '主题', sensitive: false },
  { key: 'beecount_currency', label: '货币', sensitive: false },
  { key: 'beecount_month_start', label: '每月起始日', sensitive: false },
  { key: 'beecount_aa_members', label: 'AA 成员', sensitive: false },
]

export interface ConfigFile {
  app: string
  version: number
  type: 'config'
  exportedAt: string
  /** key -> 存储中的原始字符串值 */
  config: Record<string, string>
}

/** 收集当前设备上已配置的项（未配置过的键不写入备份） */
export function collectConfigFile(): ConfigFile {
  const config: Record<string, string> = {}
  CONFIG_KEYS.forEach((item) => {
    const raw = uni.getStorageSync(item.key)
    if (raw === '' || raw === null || raw === undefined) return
    config[item.key] = typeof raw === 'string' ? raw : JSON.stringify(raw)
  })
  return {
    app: CONFIG_APP_ID,
    version: CONFIG_VERSION,
    type: 'config',
    exportedAt: new Date().toISOString(),
    config,
  }
}

/** 生成配置文件名 */
export function configFileName(date = new Date()): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `发财记账_配置备份_${y}${m}${d}.json`
}

/** 校验配置文件 */
export function validateConfigFile(
  raw: unknown
): { ok: true; file: ConfigFile } | { ok: false; msg: string } {
  if (!raw || typeof raw !== 'object') return { ok: false, msg: '文件内容不是有效的 JSON 对象' }
  const f = raw as Record<string, any>

  if (f.app && f.app !== CONFIG_APP_ID) return { ok: false, msg: '这不是发财记账的配置文件' }
  if (f.type && f.type !== 'config') return { ok: false, msg: '这是数据备份文件，请在「导出」页导入' }
  if (!f.config || typeof f.config !== 'object') return { ok: false, msg: '配置文件缺少内容' }

  const known = new Set(CONFIG_KEYS.map((k) => k.key))
  const config: Record<string, string> = {}
  Object.keys(f.config).forEach((k) => {
    if (!known.has(k)) return // 忽略未知键，避免脏数据写入
    const v = (f.config as Record<string, any>)[k]
    if (v === '' || v === null || v === undefined) return
    config[k] = typeof v === 'string' ? v : JSON.stringify(v)
  })

  if (Object.keys(config).length === 0) return { ok: false, msg: '没有识别到任何可导入的配置项' }

  return {
    ok: true,
    file: {
      app: CONFIG_APP_ID,
      version: typeof f.version === 'number' ? f.version : 0,
      type: 'config',
      exportedAt: typeof f.exportedAt === 'string' ? f.exportedAt : '',
      config,
    },
  }
}

/** 将配置写入本地存储，返回写入的项数 */
export function applyConfigFile(file: ConfigFile): number {
  let n = 0
  Object.keys(file.config).forEach((key) => {
    uni.setStorageSync(key, file.config[key])
    n++
  })
  return n
}

/** 导入前展示：这个文件里有哪些配置项 */
export function configSummary(file: ConfigFile): { key: string; label: string }[] {
  return CONFIG_KEYS.filter((k) => file.config[k.key] !== undefined)
}
