import type { Transaction, Category, Account } from '../types' // 交易/分类/账户的类型定义
import { formatAmount } from './format' // 金额格式化工具

// ---------- Config ----------
// 说明：所有 AI 能力统一走「对话补全」接口。
// 主流厂商（DeepSeek / OpenAI / 通义千问 / 智谱 / Kimi / 豆包 / 硅基流动 / Groq / Ollama…）
// 都兼容 OpenAI 的 chat completions 协议；Anthropic（Claude）使用原生 messages 协议，已单独适配。
// 因此本项目可接入「任意 OpenAI 兼容」的服务或中转网关，也可直连 Claude。

export interface AIProvider {
  key: string
  name: string
  baseUrl: string
  model: string
  keyHint: string
  doc: string
  optionalKey?: boolean // 本地模型等场景可无需 Key
}

export const AI_PROVIDERS: AIProvider[] = [
  {
    key: 'deepseek',
    name: 'DeepSeek',
    baseUrl: 'https://api.deepseek.com/v1/chat/completions',
    model: 'deepseek-chat',
    keyHint: 'sk-',
    doc: 'platform.deepseek.com → API Keys',
  },
  {
    key: 'openai',
    name: 'OpenAI',
    baseUrl: 'https://api.openai.com/v1/chat/completions',
    model: 'gpt-4o-mini',
    keyHint: 'sk-',
    doc: 'platform.openai.com → API keys',
  },
  {
    key: 'qwen',
    name: '通义千问（阿里云）',
    baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions',
    model: 'qwen-plus',
    keyHint: 'sk-',
    doc: 'bailian.console.aliyun.com → API-KEY 管理',
  },
  {
    key: 'zhipu',
    name: '智谱 GLM',
    baseUrl: 'https://open.bigmodel.cn/api/paas/v4/chat/completions',
    model: 'glm-4-flash',
    keyHint: '可留空前缀',
    doc: 'open.bigmodel.cn → API Keys',
  },
  {
    key: 'moonshot',
    name: 'Kimi（月之暗面）',
    baseUrl: 'https://api.moonshot.cn/v1/chat/completions',
    model: 'moonshot-v1-8k',
    keyHint: 'sk-',
    doc: 'platform.moonshot.cn → API Key 管理',
  },
  {
    key: 'doubao',
    name: '豆包（火山方舟）',
    baseUrl: 'https://ark.cn-beijing.volces.com/api/v3/chat/completions',
    model: 'doubao-pro-32k',
    keyHint: '可留空前缀',
    doc: 'console.volcengine.com/ark → API Key',
  },
  {
    key: 'siliconflow',
    name: '硅基流动 SiliconFlow',
    baseUrl: 'https://api.siliconflow.cn/v1/chat/completions',
    model: 'Qwen/Qwen2.5-7B-Instruct',
    keyHint: 'sk-',
    doc: 'cloud.siliconflow.cn → API 密钥',
  },
  {
    key: 'groq',
    name: 'Groq',
    baseUrl: 'https://api.groq.com/openai/v1/chat/completions',
    model: 'llama-3.3-70b-versatile',
    keyHint: 'gsk_',
    doc: 'console.groq.com → API Keys',
  },
  {
    key: 'anthropic',
    name: 'Anthropic Claude',
    baseUrl: 'https://api.anthropic.com/v1/messages',
    model: 'claude-3-5-sonnet-latest',
    keyHint: 'sk-ant-',
    doc: 'console.anthropic.com → API keys',
  },
  {
    key: 'ollama',
    name: 'Ollama（本地）',
    baseUrl: 'http://localhost:11434/v1/chat/completions',
    model: 'qwen2.5:7b',
    keyHint: '本地无需 Key',
    doc: '本地部署，Key 可留空或填任意字符',
    optionalKey: true,
  },
  {
    key: 'custom',
    name: '自定义（OpenAI 兼容）',
    baseUrl: '',
    model: '',
    keyHint: '由服务商决定',
    doc: '填写任意 OpenAI 兼容的 /chat/completions 地址（含各类中转/网关）',
  },
]

export interface AIConfig {
  provider: string // AI_PROVIDERS 中的 key
  baseUrl: string // 完整的对话补全接口地址
  apiKey: string
  model: string
}

const CONFIG_KEY = 'beecount_ai_config'
const LEGACY_APIKEY_KEY = 'beecount_ai_apikey'
const LEGACY_MODEL_KEY = 'beecount_ai_model'

function defaultConfig(): AIConfig {
  const p = AI_PROVIDERS[0]
  return { provider: p.key, baseUrl: p.baseUrl, apiKey: '', model: p.model }
}

/** 读取当前 AI 配置；无配置时自动迁移旧版仅存 API Key 的数据 */
export function getAIConfig(): AIConfig {
  const raw = uni.getStorageSync(CONFIG_KEY)
  if (raw) {
    try {
      const cfg = typeof raw === 'string' ? JSON.parse(raw) : raw
      if (cfg && typeof cfg === 'object') {
        return { ...defaultConfig(), ...cfg }
      }
    } catch (e) {
      // 存储内容损坏时回退到默认配置
    }
  }
  // 兼容旧版本：只有 API Key（默认 DeepSeek）
  const legacyKey: string = uni.getStorageSync(LEGACY_APIKEY_KEY) || ''
  if (legacyKey) {
    const legacyModel: string = uni.getStorageSync(LEGACY_MODEL_KEY) || ''
    const base = AI_PROVIDERS[0]
    return {
      provider: base.key,
      baseUrl: base.baseUrl,
      apiKey: legacyKey,
      model: legacyModel || base.model,
    }
  }
  return defaultConfig()
}

/** 写入 AI 配置（局部更新，未传字段保持原值） */
export function setAIConfig(patch: Partial<AIConfig>) {
  const next = { ...getAIConfig(), ...patch }
  uni.setStorageSync(CONFIG_KEY, JSON.stringify(next))
  // 同步一份到旧存储键，便于旧版本逻辑读取
  uni.setStorageSync(LEGACY_APIKEY_KEY, next.apiKey)
  return next
}

export function getApiKey(): string {
  return getAIConfig().apiKey
}

export function setApiKey(key: string) {
  setAIConfig({ apiKey: key })
}

export function hasApiKey(): boolean {
  const cfg = getAIConfig()
  const p = AI_PROVIDERS.find((x) => x.key === cfg.provider)
  if (p?.optionalKey) return !!cfg.baseUrl
  return !!cfg.apiKey
}

/** 补全接口地址：用户可只填根域名或 /v1，自动补齐为完整对话补全地址 */
export function normalizeUrl(raw: string): string {
  let u = (raw || '').trim().replace(/\/+$/, '')
  if (!u) return ''
  if (/\/chat\/completions$/i.test(u)) return u
  if (/\/messages$/i.test(u)) return u // Anthropic 原生端点
  if (/\/v\d+$/i.test(u)) return `${u}/chat/completions`
  return `${u}/v1/chat/completions`
}

/** 根据地址判断协议：Anthropic 走原生 messages 协议，其余按 OpenAI 兼容处理 */
function detectProtocol(url: string): 'openai' | 'anthropic' {
  return /anthropic\.com|\/v1\/messages$/i.test(url) ? 'anthropic' : 'openai'
}

// ---------- Core request ----------
interface ChatMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

interface ChatCompletionResponse {
  choices: { message: { role: string; content: string } }[]
}

interface AnthropicResponse {
  content: { type: string; text?: string }[]
}

/** 从各家不同格式的错误响应中提取可读信息 */
function extractError(data: any): string {
  if (!data) return '无响应内容'
  if (typeof data === 'string') return data.slice(0, 200)
  const err = data.error
  if (err) return typeof err === 'string' ? err : err.message || JSON.stringify(err)
  return JSON.stringify(data).slice(0, 200)
}

function request<T>(opts: {
  url: string
  header: Record<string, string>
  data: unknown
}): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    uni.request({
      url: opts.url,
      method: 'POST',
      header: opts.header,
      data: opts.data as any,
      success: (r: any) => {
        if (r.statusCode >= 200 && r.statusCode < 300) resolve(r.data as T)
        else reject(new Error(`API 错误 ${r.statusCode}：${extractError(r.data)}`))
      },
      fail: (e: any) => reject(new Error(`网络错误：${e.errMsg}`)),
    })
  })
}

async function chatOpenAI(
  url: string,
  apiKey: string,
  model: string,
  messages: ChatMessage[],
  temperature?: number
): Promise<string> {
  const res = await request<ChatCompletionResponse>({
    url,
    header: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    data: {
      model,
      messages,
      temperature: temperature ?? 0.7,
      max_tokens: 2048,
    },
  })
  return res.choices?.[0]?.message?.content || ''
}

async function chatAnthropic(
  url: string,
  apiKey: string,
  model: string,
  messages: ChatMessage[],
  temperature?: number
): Promise<string> {
  // Anthropic 将 system 独立成字段，且 messages 不接受 system 角色
  const system = messages
    .filter((m) => m.role === 'system')
    .map((m) => m.content)
    .join('\n\n')
  const rest = messages
    .filter((m) => m.role !== 'system')
    .map((m) => ({ role: m.role, content: m.content }))

  const res = await request<AnthropicResponse>({
    url,
    header: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    data: {
      model,
      max_tokens: 2048,
      system: system || undefined,
      messages: rest.length ? rest : [{ role: 'user', content: '你好' }],
      temperature: temperature ?? 0.7,
    },
  })

  return (res.content || [])
    .filter((b) => b.type === 'text')
    .map((b) => b.text || '')
    .join('')
}

async function chat(
  messages: ChatMessage[],
  opts: { model?: string; temperature?: number } = {}
): Promise<string> {
  const cfg = getAIConfig()
  const url = normalizeUrl(cfg.baseUrl)
  if (!url) throw new Error('请先在「我的 → AI 设置」中配置接口地址')
  if (!cfg.apiKey && !AI_PROVIDERS.find((x) => x.key === cfg.provider)?.optionalKey) {
    throw new Error('请先在「我的 → AI 设置」中配置 API Key')
  }

  const model = opts.model || cfg.model || AI_PROVIDERS[0].model
  const protocol = detectProtocol(url)

  return protocol === 'anthropic'
    ? chatAnthropic(url, cfg.apiKey, model, messages, opts.temperature)
    : chatOpenAI(url, cfg.apiKey, model, messages, opts.temperature)
}

/** 设置页用于验证配置是否可用 */
export async function testAIConnection(
  patch?: Partial<AIConfig>
): Promise<{ ok: boolean; msg: string }> {
  const cfg = patch ? { ...getAIConfig(), ...patch } : getAIConfig()
  const url = normalizeUrl(cfg.baseUrl)
  if (!url) return { ok: false, msg: '请先填写接口地址' }
  if (!cfg.apiKey && !AI_PROVIDERS.find((x) => x.key === cfg.provider)?.optionalKey) {
    return { ok: false, msg: '请先填写 API Key' }
  }
  if (!cfg.model) return { ok: false, msg: '请先填写模型名称' }

  try {
    const reply = await chat(
      [{ role: 'user', content: '你好，请只回复两个字：正常' }],
      { temperature: 0 }
    )
    const brief = (reply || '').trim().slice(0, 40)
    return { ok: true, msg: brief ? `连接成功：${brief}` : '连接成功' }
  } catch (e: any) {
    return { ok: false, msg: e?.message || '连接失败' }
  }
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

// ---------- Feature: Receipt OCR Parsing ----------
export interface ReceiptItem {
  type: 'expense' | 'income' | 'transfer'
  amount: number
  categoryName: string
  accountName: string
  note: string
  date: string
  confidence: number // 0-1, 识别置信度
}

export async function parseReceiptText(
  ocrText: string,
  categories: Category[],
  accounts: Account[]
): Promise<ReceiptItem[]> {
  const catNames = categories.filter((c) => c.level === 1).map((c) => c.name).join('、')
  const accNames = accounts.map((a) => a.name).join('、')

  const messages: ChatMessage[] = [
    {
      role: 'system',
      content: `你是一个智能记账归档助手。用户会给你一张票据/小票/账单截图通过 OCR 识别出的文字，你需要把这些文字整理成多条结构化记账记录。

可用支出/收入分类: ${catNames}
可用账户: ${accNames}
今天日期: ${new Date().toISOString().slice(0, 10)}

识别原则：
1. 从文字中提取金额（¥、￥、金额数字）、消费项目/商品名、日期（可能是"2025-08-01"、"8月1日"等）、商户名称
2. 一条小票可能有多个项目，尽量整理成一条汇总记录（note 里写主要商品），不要过度拆分
3. 收入类（工资、报销、退款、利息等）用 type: "income"，其余支出用 type: "expense"
4. categoryName 必须从可用分类中选择最贴近的，若没有合适分类用"其他"
5. accountName 若识别不到，用第一个可用账户
6. 金额必须为正数。note 写商户名 + 主要消费内容
7. confidence 表示你对这条整理结果的把握程度：能明确金额和分类给 0.9，只有金额给 0.7，金额都不确定给 0.3

返回格式（纯 JSON 数组，不要其他文字）:
[
  {
    "type": "expense" | "income" | "transfer",
    "amount": 数字(正数),
    "categoryName": "分类名",
    "accountName": "账户名",
    "note": "商户 + 内容",
    "date": "YYYY-MM-DD",
    "confidence": 0.1到1之间的数字
  }
]

如果完全无法识别出任何有效金额，返回空数组 []。`,
    },
    { role: 'user', content: `OCR 识别出的票据文字如下：\n"""\n${ocrText}\n"""` },
  ]

  const reply = await chat(messages, { temperature: 0.1 })
  const jsonStr = reply.replace(/```json?\s*/g, '').replace(/```/g, '').trim()
  const data = JSON.parse(jsonStr)
  const list: ReceiptItem[] = Array.isArray(data) ? data : []
  return list.filter((it) => it && it.amount > 0)
}
