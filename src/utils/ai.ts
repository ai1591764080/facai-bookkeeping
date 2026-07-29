import type { Transaction, Category, Account } from '../types'
import { formatAmount } from './format'

// ---------- Config ----------
const DEEPSEEK_URL = 'https://api.deepseek.com/chat/completions'

function getApiKey(): string {
  return uni.getStorageSync('beecount_ai_apikey') || ''
}

export function setApiKey(key: string) {
  uni.setStorageSync('beecount_ai_apikey', key)
}

export function hasApiKey(): boolean {
  return !!getApiKey()
}

// ---------- Core request ----------
interface ChatMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

interface DeepSeekResponse {
  choices: { message: { role: string; content: string } }[]
}

async function chat(
  messages: ChatMessage[],
  opts: { model?: string; temperature?: number } = {}
): Promise<string> {
  const apiKey = getApiKey()
  if (!apiKey) throw new Error('请先在设置中配置 DeepSeek API Key')

  const res = await new Promise<DeepSeekResponse>((resolve, reject) => {
    uni.request({
      url: DEEPSEEK_URL,
      method: 'POST',
      header: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      data: {
        model: opts.model || 'deepseek-v4-pro',
        messages,
        temperature: opts.temperature ?? 0.7,
      },
      success: (r) => {
        if (r.statusCode === 200) resolve(r.data as DeepSeekResponse)
        else reject(new Error(`API 错误 ${r.statusCode}: ${JSON.stringify(r.data)}`))
      },
      fail: (e) => reject(new Error(`网络错误: ${e.errMsg}`)),
    })
  })

  return res.choices?.[0]?.message?.content || ''
}

// ---------- Build financial context ----------
function buildFinancialContext(
  transactions: Transaction[],
  categories: Category[],
  accounts: Account[]
): string {
  const catMap = new Map(categories.map((c) => [c.id, c]))
  const accMap = new Map(accounts.map((a) => [a.id, a]))

  // Monthly summary
  const now = new Date()
  const thisMonth = transactions.filter((t) => {
    const d = new Date(t.happenedAt)
    return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth()
  })

  const monthExpense = thisMonth.filter((t) => t.type === 'expense').reduce((s, t) => s + t.amount, 0)
  const monthIncome = thisMonth.filter((t) => t.type === 'income').reduce((s, t) => s + t.amount, 0)

  // Category breakdown this month
  const catTotals = new Map<string, number>()
  thisMonth
    .filter((t) => t.type === 'expense')
    .forEach((t) => catTotals.set(t.categoryId, (catTotals.get(t.categoryId) || 0) + t.amount))

  const catRank = [...catTotals.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([cid, amt]) => {
      const cat = catMap.get(cid)
      return `${cat?.name || '未分类'}: ¥${formatAmount(amt)}`
    })
    .join(', ')

  // Recent 20 transactions
  const recentTx = transactions
    .slice(0, 20)
    .map((t) => {
      const cat = catMap.get(t.categoryId)
      const acc = accMap.get(t.accountId)
      return `${t.happenedAt.slice(0, 10)} ${t.type === 'expense' ? '支出' : t.type === 'income' ? '收入' : '转账'} ${cat?.name || '未分类'} ¥${formatAmount(t.amount)} ${acc?.name || ''} ${t.note || ''}`
    })
    .join('\n')

  // Last month comparison
  const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1)
  const lastMonthTx = transactions.filter((t) => {
    const d = new Date(t.happenedAt)
    return d.getFullYear() === lastMonth.getFullYear() && d.getMonth() === lastMonth.getMonth()
  })
  const lastMonthExpense = lastMonthTx.filter((t) => t.type === 'expense').reduce((s, t) => s + t.amount, 0)

  return `
当前日期: ${now.toISOString().slice(0, 10)}
本月支出: ¥${formatAmount(monthExpense)}
本月收入: ¥${formatAmount(monthIncome)}
上月支出: ¥${formatAmount(lastMonthExpense)}
本月支出分类排行: ${catRank}
账户余额: ${accounts.map((a) => `${a.name}: ¥${formatAmount(a.balance)}`).join(', ')}

最近20条记录:
${recentTx}
`
}

// ---------- Feature: Smart Text Parsing ----------
interface ParsedTransaction {
  type: 'expense' | 'income' | 'transfer'
  amount: number
  categoryName: string
  accountName: string
  note: string
  date: string
}

export async function parseNaturalLanguage(
  input: string,
  categories: Category[],
  accounts: Account[]
): Promise<ParsedTransaction> {
  const catNames = categories.filter((c) => c.level === 1).map((c) => c.name).join('、')
  const accNames = accounts.map((a) => a.name).join('、')

  const messages: ChatMessage[] = [
    {
      role: 'system',
      content: `你是一个记账助手。用户会用自然语言描述一笔消费，你需要解析为 JSON 格式。

可用分类: ${catNames}
可用账户: ${accNames}
今天日期: ${new Date().toISOString().slice(0, 10)}

返回格式（纯 JSON，不要其他文字）:
{
  "type": "expense" | "income" | "transfer",
  "amount": 数字,
  "categoryName": "分类名",
  "accountName": "账户名",
  "note": "备注",
  "date": "YYYY-MM-DD"
}

如果用户没有指定账户，默认用第一个可用账户。如果没指定日期，用今天。`,
    },
    { role: 'user', content: input },
  ]

  const reply = await chat(messages, { temperature: 0.1 })
  const jsonStr = reply.replace(/```json?\s*/g, '').replace(/```/g, '').trim()
  return JSON.parse(jsonStr) as ParsedTransaction
}

// ---------- Feature: Chat-based Accounting ----------
export async function chatAboutFinance(
  history: ChatMessage[],
  userMessage: string,
  transactions: Transaction[],
  categories: Category[],
  accounts: Account[]
): Promise<string> {
  const ctx = buildFinancialContext(transactions, categories, accounts)

  const systemMsg: ChatMessage = {
    role: 'system',
    content: `你是"发财记账"的 AI 财务助手。根据以下用户的财务数据回答用户问题。
回答要简洁、有洞察力，使用中文。如果涉及金额请带上 ¥ 符号。
如果用户的问题需要具体数据，请从下面的财务数据中提取。

${ctx}`,
  }

  const msgs: ChatMessage[] = [systemMsg, ...history, { role: 'user', content: userMessage }]
  return chat(msgs, { temperature: 0.7 })
}

// ---------- Feature: Smart Spending Insights ----------
export async function generateSpendingInsights(
  transactions: Transaction[],
  categories: Category[],
  accounts: Account[]
): Promise<string> {
  const ctx = buildFinancialContext(transactions, categories, accounts)

  const messages: ChatMessage[] = [
    {
      role: 'system',
      content: `你是一位专业的个人财务顾问。请根据以下用户的财务数据，生成一份简洁的月度消费洞察报告。

报告结构：
1. 本月消费总览（一句话总结）
2. 消费趋势分析（和上月对比）
3. 消费习惯洞察（哪个分类花得最多，有什么特点）
4. 省钱建议（2-3 条具体可行的建议）
5. 下月关注点（需要特别注意的方面）

语气友好专业，使用 emoji 让内容更生动，但要克制。`,
    },
    { role: 'user', content: `请分析我的消费数据:\n${ctx}` },
  ]

  return chat(messages, { temperature: 0.7 })
}

// ---------- Feature: Budget Prediction ----------
export async function predictBudget(
  transactions: Transaction[],
  categories: Category[],
  currentBudget: number
): Promise<string> {
  const now = new Date()
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()
  const daysPassed = now.getDate()

  // Historical monthly expenses (last 3 months)
  const historyData: { month: string; total: number; catTotals: Map<string, number> }[] = []
  for (let i = 0; i < 3; i++) {
    const m = new Date(now.getFullYear(), now.getMonth() - i, 1)
    const mEnd = new Date(now.getFullYear(), now.getMonth() - i + 1, 0, 23, 59, 59, 999)
    const mTx = transactions.filter((t) => {
      if (t.type !== 'expense' || t.excludeFromStats) return false
      const d = new Date(t.happenedAt)
      return d >= m && d <= mEnd
    })
    const total = mTx.reduce((s, t) => s + t.amount, 0)
    const catTotals = new Map<string, number>()
    mTx.forEach((t) => catTotals.set(t.categoryId, (catTotals.get(t.categoryId) || 0) + t.amount))
    historyData.push({ month: `${m.getFullYear()}-${m.getMonth() + 1}`, total, catTotals })
  }

  const catMap = new Map(categories.map((c) => [c.id, c]))
  const historyText = historyData
    .map((h) => {
      const catRank = [...h.catTotals.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([cid, amt]) => `${catMap.get(cid)?.name || '未分类'}: ¥${formatAmount(amt)}`)
        .join(', ')
      return `${h.month}: 总支出 ¥${formatAmount(h.total)}，分类: ${catRank}`
    })
    .join('\n')

  // Current month spent so far
  const thisMonthTx = transactions.filter((t) => {
    if (t.type !== 'expense' || t.excludeFromStats) return false
    const d = new Date(t.happenedAt)
    return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth()
  })
  const monthSpent = thisMonthTx.reduce((s, t) => s + t.amount, 0)

  const messages: ChatMessage[] = [
    {
      role: 'system',
      content: `你是一位预算规划专家。根据用户的历史消费数据和当前预算，给出智能预测和建议。

分析要点：
1. 预测本月最终支出（基于已过去天数和历史趋势）
2. 判断是否会超预算
3. 给出每日可用额度建议
4. 对比历史月份给出趋势判断
5. 如果有分类消费异常，特别指出

回答要简洁、数据驱动、有可操作性。`,
    },
    {
      role: 'user',
      content: `当前预算: ¥${formatAmount(currentBudget)}
本月已支出: ¥${formatAmount(monthSpent)}
本月已过去: ${daysPassed}/${daysInMonth} 天
历史数据:
${historyText}`,
    },
  ]

  return chat(messages, { temperature: 0.5 })
}

// ---------- Feature: Voice Command Parser ----------
export interface VoiceAction {
  action: string
  params: Record<string, any>
  confirmation: string
}

export async function parseVoiceCommand(
  text: string,
  state: {
    categories: Category[]
    accounts: Account[]
    ledgers: { id: string; name: string }[]
    currentLedgerId: string
    budgetAmounts: { name: string; amount: number }[]
  }
): Promise<VoiceAction> {
  const expCats = state.categories.filter(c => c.kind === 'expense' && c.level === 1).map(c => c.name)
  const incCats = state.categories.filter(c => c.kind === 'income' && c.level === 1).map(c => c.name)
  const accNames = state.accounts.map(a => `${a.name}(${a.type})`)
  const ledgerNames = state.ledgers.map(l => l.name)

  const messages: ChatMessage[] = [
    {
      role: 'system',
      content: `你是记账App的语音控制AI。用户说一句话，你解析为JSON动作。

【当前数据】
支出分类: ${expCats.join('、') || '无'}
收入分类: ${incCats.join('、') || '无'}
账户: ${accNames.join('、') || '无'}
账本: ${ledgerNames.join('、') || '无'}
当前账本ID: ${state.currentLedgerId}
预算: ${state.budgetAmounts.length > 0 ? state.budgetAmounts.map(b => `${b.name}:¥${b.amount}`).join(', ') : '无'}
今天: ${new Date().toISOString().slice(0, 10)}

【支持动作】
1. add_transaction — 记录一笔消费或收入（花了钱、收到钱）
   {type:"expense"|"income", amount:number, categoryName:string, accountName:string, note:string, date:"YYYY-MM-DD"}
2. query_spending — 查询消费
   {period:"this_month"|"last_month"|"today", categoryName?}
3. add_category — 添加分类 {name, kind:"expense"|"income", icon:emoji}
4. delete_category — 删除分类 {name}
5. add_account — 添加账户 {name, type:"cash"|"bank_card"|"credit_card"|"alipay"|"wechat"|"investment"|"loan"|"other", balance:number}
6. delete_account — 删除账户 {name}
7. update_balance — 调整账户余额（充值、转入、存钱到某账户、给账户加钱）
   {name:"账户名", amount:number} 正数=充值/转入，负数=扣款/转出
8. add_ledger — 创建账本 {name}
9. switch_ledger — 切换账本 {name}
10. set_budget — 设预算 {amount:number, categoryName?:string}
11. navigate — 跳转页面 {page:"add"|"stats"|"assets"|"mine"|"chat"|"insights"}

【重要区分规则】
• "给XX账户充100"、"XX卡转入500"、"往XX加钱" → update_balance（不是 add_transaction）
• "午饭花了30"、"打车15块"、"收到工资8000" → add_transaction
• 关键词"充值/转入/存入/加钱到账户/给账户添加" → update_balance
• 关键词"花了/消费/买了/收到/赚了" → add_transaction

【返回格式】
只返回JSON：{"action":"动作名","params":{参数},"confirmation":"中文确认语"}
如果听不懂，action用"unknown"，confirmation说明原因`,
    },
    { role: 'user', content: text },
  ]

  const reply = await chat(messages, { temperature: 0.1 })
  const jsonStr = reply.replace(/```json?\s*/g, '').replace(/```/g, '').trim()
  return JSON.parse(jsonStr) as VoiceAction
}
