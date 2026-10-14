/**
 * Voice command executor
 *
 * Takes a parsed VoiceAction and executes it against the Pinia stores.
 * Returns a human-readable result message.
 */
import type { VoiceAction } from './ai' // AI 解析出的语音动作类型
import {
  useTransactionStore,
  useCategoryStore,
  useAccountStore,
  useLedgerStore,
  useBudgetStore,
} from '../stores' // 交易/分类/账户/账本/预算状态仓库，执行命令时读写数据
import { uuid } from './uuid' // 生成唯一 ID

export interface CommandResult {
  success: boolean
  message: string
  navigateTo?: string
}

export function executeCommand(action: VoiceAction): CommandResult {
  const { action: type, params } = action

  try {
    switch (type) {
      case 'add_transaction':
        return execAddTransaction(params)
      case 'add_category':
        return execAddCategory(params)
      case 'delete_category':
        return execDeleteCategory(params)
      case 'add_account':
        return execAddAccount(params)
      case 'delete_account':
        return execDeleteAccount(params)
      case 'update_balance':
        return execUpdateBalance(params)
      case 'add_ledger':
        return execAddLedger(params)
      case 'switch_ledger':
        return execSwitchLedger(params)
      case 'set_budget':
        return execSetBudget(params)
      case 'query_spending':
        return execQuerySpending(params)
      case 'navigate':
        return execNavigate(params)
      case 'unknown':
        return { success: false, message: params.confirmation || action.confirmation || '抱歉，没听懂您的指令' }
      default:
        return { success: false, message: `未知操作: ${type}` }
    }
  } catch (e: any) {
    return { success: false, message: `执行失败: ${e.message || '未知错误'}` }
  }
}

export interface BatchResult {
  total: number
  successCount: number
  failCount: number
  /** 汇总后的展示文案，多笔时形如「已记录 3 笔，共 ¥65.00」 */
  message: string
  navigateTo?: string
  success: boolean
}

/**
 * 批量执行语音解析出的多个动作（支持一句话多笔账）
 * 单笔时沿用原有文案，多笔时汇总成功/失败数量，避免静默丢数据。
 */
export function executeCommands(actions: VoiceAction[]): BatchResult {
  const list = (actions || []).filter((a) => a && a.action)
  if (list.length === 0) {
    return { total: 0, successCount: 0, failCount: 0, message: '没有可执行的动作', success: false }
  }

  const results = list.map((a) => executeCommand(a))
  const oks = results.filter((r) => r.success)
  const fails = results.filter((r) => !r.success)

  // 取最后一个有效的跳转目标
  const navigateTo = results.map((r) => r.navigateTo).filter(Boolean).pop()

  if (list.length === 1) {
    return {
      total: 1,
      successCount: oks.length,
      failCount: fails.length,
      message: results[0].message,
      navigateTo,
      success: results[0].success,
    }
  }

  // 多笔：优先展示成功条数，失败原因一并列出
  const parts: string[] = []
  if (oks.length > 0) parts.push(`成功 ${oks.length} 笔`)
  if (fails.length > 0) parts.push(`失败 ${fails.length} 笔`)
  const summary = parts.join('，')

  const detail = [
    ...oks.map((r) => `✓ ${r.message}`),
    ...fails.map((r) => `✗ ${r.message}`),
  ].join('\n')

  return {
    total: list.length,
    successCount: oks.length,
    failCount: fails.length,
    message: `${summary}\n${detail}`,
    navigateTo,
    success: oks.length > 0,
  }
}

// ---------- Transaction ----------
function execAddTransaction(p: Record<string, any>): CommandResult {
  const txStore = useTransactionStore()
  const catStore = useCategoryStore()
  const accStore = useAccountStore()
  const ledgerStore = useLedgerStore()

  const txType = p.type || 'expense'
  const amount = Number(p.amount)
  if (!amount || amount <= 0) return { success: false, message: '金额无效' }

  // Find category: exact match, then fuzzy
  let cat = catStore.categories.find(
    c => c.name === p.categoryName && c.kind === txType && c.level === 1
  )
  if (!cat && p.categoryName) {
    cat = catStore.categories.find(
      c => c.kind === txType && c.level === 1 &&
        (c.name.includes(p.categoryName) || p.categoryName.includes(c.name))
    )
  }
  if (!cat) {
    const available = catStore.categories
      .filter(c => c.kind === txType && c.level === 1)
      .map(c => c.name).join('、')
    return { success: false, message: `找不到${txType === 'expense' ? '支出' : '收入'}分类"${p.categoryName}"，可选: ${available}` }
  }

  // Find account: exact match, then fuzzy, fallback to first
  let acc = accStore.accounts.find(a => a.name === p.accountName)
  if (!acc && p.accountName) {
    acc = accStore.accounts.find(a => a.name.includes(p.accountName) || p.accountName.includes(a.name))
  }
  if (!acc) acc = accStore.accounts[0]
  if (!acc) return { success: false, message: '没有可用账户' }

  const now = new Date().toISOString()
  txStore.add({
    id: uuid(),
    ledgerId: ledgerStore.currentId,
    type: txType,
    amount,
    categoryId: cat.id,
    accountId: acc.id,
    happenedAt: p.date ? new Date(p.date).toISOString() : now,
    note: p.note || '',
    createdAt: now,
    updatedAt: now,
    excludeFromStats: false,
    excludeFromBudget: false,
  })

  const label = txType === 'expense' ? '支出' : '收入'
  return {
    success: true,
    message: `已记录${label} ¥${amount} ${cat.name}（${acc.name}）${p.note ? ` ${p.note}` : ''}`,
  }
}

// ---------- Category ----------
function execAddCategory(p: Record<string, any>): CommandResult {
  const catStore = useCategoryStore()
  const name = p.name
  const kind = p.kind || 'expense'
  if (!name) return { success: false, message: '分类名称为空' }

  // Check duplicate
  const exists = catStore.categories.find(c => c.name === name && c.kind === kind && c.level === 1)
  if (exists) return { success: false, message: `分类"${name}"已存在` }

  const sortOrder = catStore.categories
    .filter(c => c.kind === kind && c.level === 1)
    .reduce((max, c) => Math.max(max, c.sortOrder), 0) + 1

  catStore.addCategory({
    name,
    kind,
    icon: p.icon || (kind === 'expense' ? '📦' : '💰'),
    sortOrder,
    parentId: null,
    level: 1,
  })

  const label = kind === 'expense' ? '支出' : '收入'
  return { success: true, message: `已添加${label}分类"${name}"` }
}

function execDeleteCategory(p: Record<string, any>): CommandResult {
  const catStore = useCategoryStore()
  const cat = catStore.categories.find(c => c.name === p.name && c.level === 1)
  if (!cat) return { success: false, message: `找不到分类"${p.name}"` }

  catStore.removeCategory(cat.id)
  return { success: true, message: `已删除分类"${p.name}"` }
}

// ---------- Account ----------
function execAddAccount(p: Record<string, any>): CommandResult {
  const accStore = useAccountStore()
  const ledgerStore = useLedgerStore()
  const name = p.name
  if (!name) return { success: false, message: '账户名称为空' }

  const exists = accStore.accounts.find(a => a.name === name)
  if (exists) return { success: false, message: `账户"${name}"已存在` }

  const balance = Number(p.balance) || 0
  const type = p.type || 'other'
  const iconMap: Record<string, string> = {
    cash: '💵', bank_card: '💳', credit_card: '💳',
    alipay: '📱', wechat: '📱', investment: '📈', loan: '🏦', other: '💼',
  }

  const sortOrder = accStore.accounts.reduce((max, a) => Math.max(max, a.sortOrder), 0) + 1

  accStore.add({
    ledgerId: ledgerStore.currentId,
    name,
    type,
    initialBalance: balance,
    balance,
    icon: iconMap[type] || '💼',
    sortOrder,
    hidden: false,
  })

  return { success: true, message: `已添加账户"${name}"，余额 ¥${balance}` }
}

function execDeleteAccount(p: Record<string, any>): CommandResult {
  const accStore = useAccountStore()
  const acc = accStore.accounts.find(a => a.name === p.name)
  if (!acc) return { success: false, message: `找不到账户"${p.name}"` }

  accStore.remove(acc.id)
  return { success: true, message: `已删除账户"${p.name}"` }
}

function execUpdateBalance(p: Record<string, any>): CommandResult {
  const accStore = useAccountStore()
  const targetName = p.name || p.accountName
  if (!targetName) return { success: false, message: '未指定账户名称' }

  // Exact match first, then fuzzy (contains)
  let acc = accStore.accounts.find(a => a.name === targetName)
  if (!acc) {
    acc = accStore.accounts.find(a => a.name.includes(targetName) || targetName.includes(a.name))
  }
  if (!acc) {
    const available = accStore.accounts.map(a => a.name).join('、')
    return { success: false, message: `找不到账户"${targetName}"，现有账户: ${available}` }
  }

  const delta = Number(p.amount)
  if (isNaN(delta)) return { success: false, message: '金额无效' }

  accStore.adjustBalance(acc.id, delta)
  const verb = delta > 0 ? '充值' : '扣款'
  return { success: true, message: `"${acc.name}"已${verb} ¥${Math.abs(delta)}，当前余额 ¥${acc.balance.toFixed(2)}` }
}

// ---------- Ledger ----------
function execAddLedger(p: Record<string, any>): CommandResult {
  const ledgerStore = useLedgerStore()
  const name = p.name
  if (!name) return { success: false, message: '账本名称为空' }

  ledgerStore.add(name)
  return { success: true, message: `已创建账本"${name}"` }
}

function execSwitchLedger(p: Record<string, any>): CommandResult {
  const ledgerStore = useLedgerStore()
  const ledger = ledgerStore.ledgers.find(l => l.name === p.name)
  if (!ledger) return { success: false, message: `找不到账本"${p.name}"` }

  ledgerStore.switchLedger(ledger.id)
  return { success: true, message: `已切换到账本"${p.name}"` }
}

// ---------- Budget ----------
function execSetBudget(p: Record<string, any>): CommandResult {
  const budgetStore = useBudgetStore()
  const ledgerStore = useLedgerStore()
  const catStore = useCategoryStore()
  const amount = Number(p.amount)
  if (!amount || amount <= 0) return { success: false, message: '预算金额无效' }

  if (p.categoryName) {
    const cat = catStore.categories.find(c => c.name === p.categoryName && c.level === 1)
    if (!cat) return { success: false, message: `找不到分类"${p.categoryName}"` }
    budgetStore.add({
      ledgerId: ledgerStore.currentId,
      type: 'category',
      categoryId: cat.id,
      amount,
      period: 'monthly',
      enabled: true,
    })
    return { success: true, message: `已设置"${p.categoryName}"月度预算 ¥${amount}` }
  } else {
    budgetStore.add({
      ledgerId: ledgerStore.currentId,
      type: 'total',
      amount,
      period: 'monthly',
      enabled: true,
    })
    return { success: true, message: `已设置月度总预算 ¥${amount}` }
  }
}

// ---------- Query ----------
function execQuerySpending(p: Record<string, any>): CommandResult {
  const txStore = useTransactionStore()
  const catStore = useCategoryStore()
  const ledgerStore = useLedgerStore()

  const now = new Date()
  let start: Date, end: Date, label: string

  switch (p.period) {
    case 'today':
      start = new Date(now.getFullYear(), now.getMonth(), now.getDate())
      end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59)
      label = '今天'
      break
    case 'last_month':
      start = new Date(now.getFullYear(), now.getMonth() - 1, 1)
      end = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59)
      label = '上月'
      break
    default:
      start = new Date(now.getFullYear(), now.getMonth(), 1)
      end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59)
      label = '本月'
  }

  let txs = txStore.getInRange(start, end, ledgerStore.currentId).filter(t => t.type === 'expense')

  if (p.categoryName) {
    const cat = catStore.categories.find(c => c.name === p.categoryName && c.level === 1)
    if (cat) txs = txs.filter(t => t.categoryId === cat.id)
    label += ` ${p.categoryName}`
  }

  const total = txs.reduce((s, t) => s + t.amount, 0)
  return { success: true, message: `${label}支出: ¥${total.toFixed(2)}（${txs.length}笔）` }
}

// ---------- Navigation ----------
const PAGE_MAP: Record<string, string> = {
  add: '/pages/add/add',
  stats: '/pages/stats/stats',
  assets: '/pages/assets/assets',
  mine: '/pages/mine/mine',
  chat: '/pages/ai/chat',
  insights: '/pages/ai/insights',
}

function execNavigate(p: Record<string, any>): CommandResult {
  const page = PAGE_MAP[p.page]
  if (!page) return { success: false, message: `未知页面: ${p.page}` }

  // Tab pages need switchTab, others use navigateTo
  const tabPages = ['/pages/index/index', '/pages/add/add', '/pages/stats/stats', '/pages/assets/assets', '/pages/mine/mine']
  if (tabPages.includes(page)) {
    uni.switchTab({ url: page })
  } else {
    uni.navigateTo({ url: page })
  }

  const pageNames: Record<string, string> = {
    add: '记账', stats: '统计', assets: '资产', mine: '我的', chat: 'AI 聊天', insights: 'AI 分析',
  }
  return { success: true, message: `正在跳转到${pageNames[p.page] || p.page}...`, navigateTo: page }
}
