import type { Transaction, Category, Account, Ledger, Budget, Tag, AABill, ScanRecord } from '../types' // 各业务实体类型定义
import {
  getTransactions,
  saveTransactions,
  getCategories,
  saveCategories,
  getAccounts,
  saveAccounts,
  getLedgers,
  saveLedgers,
  getCurrentLedgerId,
  setCurrentLedgerId,
  getBudgets,
  saveBudgets,
  getTags,
  saveTags,
  getAABills,
  saveAABills,
  getScanRecords,
  saveScanRecords,
} from './db' // 本地存储读写：数据全部存在设备本地，靠备份文件实现跨设备迁移与恢复

// ---------- 备份格式 ----------
export const BACKUP_APP_ID = 'facai-bookkeeping'
export const BACKUP_VERSION = 1

export interface BackupData {
  transactions: Transaction[]
  categories: Category[]
  accounts: Account[]
  ledgers: Ledger[]
  budgets: Budget[]
  tags: Tag[]
  aaBills: AABill[]
  scanRecords: ScanRecord[]
  currentLedgerId: string
}

export interface BackupFile {
  app: string
  version: number
  exportedAt: string
  data: BackupData
}

const EMPTY_DATA: BackupData = {
  transactions: [],
  categories: [],
  accounts: [],
  ledgers: [],
  budgets: [],
  tags: [],
  aaBills: [],
  scanRecords: [],
  currentLedgerId: '',
}

function arr<T>(v: unknown): T[] {
  return Array.isArray(v) ? (v as T[]) : []
}

/** 收集当前设备上的全部数据，生成备份对象（不受日期范围影响，始终全量） */
export function collectBackup(): BackupFile {
  return {
    app: BACKUP_APP_ID,
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    data: {
      transactions: getTransactions(),
      categories: getCategories(),
      accounts: getAccounts(),
      ledgers: getLedgers(),
      budgets: getBudgets(),
      tags: getTags(),
      aaBills: getAABills(),
      scanRecords: getScanRecords(),
      currentLedgerId: getCurrentLedgerId(),
    },
  }
}

/** 生成备份文件的默认文件名 */
export function backupFileName(date = new Date()): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  const hh = String(date.getHours()).padStart(2, '0')
  const mm = String(date.getMinutes()).padStart(2, '0')
  return `发财记账_完整备份_${y}${m}${d}_${hh}${mm}.json`
}

/** 校验备份内容，兼容「仅含 data 字段」与「完整备份文件」两种格式 */
export function validateBackup(
  raw: unknown
): { ok: true; file: BackupFile } | { ok: false; msg: string } {
  if (!raw || typeof raw !== 'object') return { ok: false, msg: '文件内容不是有效的 JSON 对象' }

  const f = raw as Record<string, any>
  // 旧版导出的 JSON 只有 data 内容，没有 app/version 头，这里放宽处理
  const hasEnvelope = f.app !== undefined

  if (hasEnvelope) {
    if (f.app !== BACKUP_APP_ID) return { ok: false, msg: '这不是发财记账的备份文件' }
    if (typeof f.version !== 'number') return { ok: false, msg: '备份文件缺少版本信息' }
    if (f.version > BACKUP_VERSION) {
      return { ok: false, msg: `备份版本（${f.version}）高于当前应用支持的最高版本（${BACKUP_VERSION}），请升级应用后再导入` }
    }
  }

  if (!f.data || typeof f.data !== 'object') return { ok: false, msg: '备份文件缺少数据内容' }

  const d = f.data as Record<string, any>
  const knownKeys = Object.keys(EMPTY_DATA)
  const hasAnyData = knownKeys.some((k) => Array.isArray(d[k]) || k === 'currentLedgerId')
  if (!hasAnyData) return { ok: false, msg: '备份文件中没有识别到任何可导入的数据' }

  const file: BackupFile = {
    app: BACKUP_APP_ID,
    version: typeof f.version === 'number' ? f.version : 0,
    exportedAt: typeof f.exportedAt === 'string' ? f.exportedAt : '',
    data: { ...EMPTY_DATA, ...d } as BackupData,
  }
  // 规整字段类型，避免脏数据写入存储
  file.data.transactions = arr<Transaction>(d.transactions)
  file.data.categories = arr<Category>(d.categories)
  file.data.accounts = arr<Account>(d.accounts)
  file.data.ledgers = arr<Ledger>(d.ledgers)
  file.data.budgets = arr<Budget>(d.budgets)
  file.data.tags = arr<Tag>(d.tags)
  file.data.aaBills = arr<AABill>(d.aaBills)
  file.data.scanRecords = arr<ScanRecord>(d.scanRecords)
  file.data.currentLedgerId = typeof d.currentLedgerId === 'string' ? d.currentLedgerId : ''

  return { ok: true, file }
}

/** 按 id 合并两条列表，后传入的（备份数据）优先 */
function mergeList<T extends { id: string }>(local: T[], incoming: T[]): T[] {
  const map = new Map<string, T>()
  local.forEach((x) => x && x.id && map.set(x.id, x))
  incoming.forEach((x) => x && x.id && map.set(x.id, x))
  return Array.from(map.values())
}

export interface ImportResult {
  mode: 'replace' | 'merge'
  counts: Record<string, number>
  total: number
}

/** 将备份数据写入本地存储。replace=覆盖全部，merge=按 id 合并（备份优先） */
export function applyBackup(file: BackupFile, mode: 'replace' | 'merge'): ImportResult {
  const d = file.data

  if (mode === 'replace') {
    saveTransactions(d.transactions)
    saveCategories(d.categories)
    saveAccounts(d.accounts)
    saveLedgers(d.ledgers)
    saveBudgets(d.budgets)
    saveTags(d.tags)
    saveAABills(d.aaBills)
    saveScanRecords(d.scanRecords)
    if (d.currentLedgerId) setCurrentLedgerId(d.currentLedgerId)
  } else {
    saveTransactions(mergeList(getTransactions(), d.transactions))
    saveCategories(mergeList(getCategories(), d.categories))
    saveAccounts(mergeList(getAccounts(), d.accounts))
    saveLedgers(mergeList(getLedgers(), d.ledgers))
    saveBudgets(mergeList(getBudgets(), d.budgets))
    saveTags(mergeList(getTags(), d.tags))
    saveAABills(mergeList(getAABills(), d.aaBills))
    saveScanRecords(mergeList(getScanRecords(), d.scanRecords))
    // 合并模式下当前账本保持不变，除非本地尚未设置
    if (!getCurrentLedgerId() && d.currentLedgerId) setCurrentLedgerId(d.currentLedgerId)
  }

  const counts: Record<string, number> = {
    transactions: d.transactions.length,
    categories: d.categories.length,
    accounts: d.accounts.length,
    ledgers: d.ledgers.length,
    budgets: d.budgets.length,
    tags: d.tags.length,
    aaBills: d.aaBills.length,
    scanRecords: d.scanRecords.length,
  }

  return {
    mode,
    counts,
    total: Object.values(counts).reduce((a, b) => a + b, 0),
  }
}

/** 备份内容概览，用于导入前展示 */
export function backupSummary(d: BackupData): { key: string; label: string; count: number }[] {
  return [
    { key: 'transactions', label: '交易记录', count: d.transactions?.length || 0 },
    { key: 'categories', label: '分类', count: d.categories?.length || 0 },
    { key: 'accounts', label: '账户', count: d.accounts?.length || 0 },
    { key: 'ledgers', label: '账本', count: d.ledgers?.length || 0 },
    { key: 'budgets', label: '预算', count: d.budgets?.length || 0 },
    { key: 'tags', label: '标签', count: d.tags?.length || 0 },
    { key: 'aaBills', label: 'AA 账单', count: d.aaBills?.length || 0 },
    { key: 'scanRecords', label: '扫描记录', count: d.scanRecords?.length || 0 },
  ]
}

// ---------- 跨平台文件存取 ----------
/** 保存文本内容为文件（H5 下载、小程序转发文件、App 走剪贴板兜底） */
export function saveTextFile(content: string, filename: string): Promise<void> {
  return new Promise((resolve, reject) => {
    // #ifdef H5
    try {
      const blob = new Blob([content], { type: 'application/json;charset=utf-8' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = filename
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      setTimeout(() => URL.revokeObjectURL(url), 1000)
      resolve()
    } catch (e) {
      reject(new Error('当前浏览器不支持文件下载'))
    }
    // #endif

    // #ifdef MP-WEIXIN
    try {
      const wxAny = wx as any
      const fs = wxAny.getFileSystemManager()
      const filePath = `${wxAny.env.USER_DATA_PATH}/${filename}`
      fs.writeFile({
        filePath,
        data: content,
        encoding: 'utf8',
        success: () => {
          wxAny.shareFileMessage({
            filePath,
            fileName: filename,
            success: () => resolve(),
            fail: () => reject(new Error('已取消分享，备份文件已保存到本地')),
          })
        },
        fail: () => reject(new Error('文件写入失败')),
      })
    } catch (e) {
      reject(new Error('保存失败'))
    }
    // #endif

    // #ifdef APP-PLUS
    uni.setClipboardData({
      data: content,
      success: () => resolve(),
      fail: () => reject(new Error('保存失败')),
    })
    // #endif
  })
}

/** 选择并读取备份文件内容 */
export function pickTextFile(): Promise<string> {
  return new Promise((resolve, reject) => {
    // #ifdef H5
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = '.json,application/json,.txt'
    input.style.display = 'none'
    input.onchange = () => {
      const file = input.files && input.files[0]
      if (!file) return reject(new Error('未选择文件'))
      const reader = new FileReader()
      reader.onload = () => resolve(String(reader.result || ''))
      reader.onerror = () => reject(new Error('文件读取失败'))
      reader.readAsText(file, 'utf-8')
    }
    document.body.appendChild(input)
    input.click()
    setTimeout(() => {
      if (input.parentNode) input.parentNode.removeChild(input)
    }, 0)
    // #endif

    // #ifdef MP-WEIXIN
    try {
      ;(wx as any).chooseMessageFile({
        count: 1,
        type: 'file',
        extension: ['json', 'txt'],
        success: (res: any) => {
          const f = res.tempFiles && res.tempFiles[0]
          if (!f) return reject(new Error('未选择文件'))
          const fs = (wx as any).getFileSystemManager()
          fs.readFile({
            filePath: f.path,
            encoding: 'utf8',
            success: (r: any) => resolve(String(r.data || '')),
            fail: () => reject(new Error('文件读取失败')),
          })
        },
        fail: () => reject(new Error('未选择文件')),
      })
    } catch (e) {
      reject(new Error('当前环境不支持选择文件'))
    }
    // #endif

    // #ifdef APP-PLUS
    uni.showModal({
      title: '导入备份',
      content: '',
      editable: true,
      placeholderText: '请粘贴备份文件的 JSON 内容',
      success: (r: any) => {
        if (r.confirm && r.content) resolve(String(r.content))
        else reject(new Error('已取消'))
      },
      fail: () => reject(new Error('已取消')),
    })
    // #endif
  })
}
