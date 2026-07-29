export type TransactionType = 'expense' | 'income' | 'transfer'

export type AccountType =
  | 'cash'
  | 'bank_card'
  | 'credit_card'
  | 'alipay'
  | 'wechat'
  | 'investment'
  | 'loan'
  | 'other'

export type BudgetPeriod = 'monthly' | 'weekly' | 'yearly'
export type LedgerType = 'personal' | 'shared'

export interface Transaction {
  id: string
  ledgerId: string
  type: TransactionType
  amount: number
  categoryId: string
  accountId: string
  toAccountId?: string // for transfer
  happenedAt: string // ISO date
  note: string
  createdAt: string
  updatedAt: string
  excludeFromStats: boolean
  excludeFromBudget: boolean
}

export interface Category {
  id: string
  name: string
  kind: TransactionType
  icon: string
  sortOrder: number
  parentId: string | null
  level: number // 1 or 2
}

export interface Account {
  id: string
  ledgerId: string
  name: string
  type: AccountType
  initialBalance: number
  balance: number
  icon: string
  sortOrder: number
  hidden: boolean
  createdAt: string
}

export interface Ledger {
  id: string
  name: string
  type: LedgerType
  currency: string
  memberCount: number
  createdAt: string
}

export interface Budget {
  id: string
  ledgerId: string
  type: 'total' | 'category'
  categoryId?: string
  amount: number
  period: BudgetPeriod
  enabled: boolean
  createdAt: string
}

export interface Tag {
  id: string
  name: string
  color: string
}

export interface Member {
  id: string
  ledgerId: string
  name: string
  avatar: string
  role: 'owner' | 'editor'
}

export interface AABill {
  id: string
  ledgerId: string
  title: string
  totalAmount: number
  payerId: string
  memberIds: string[]
  splitType: 'equal' | 'custom'
  splits: { memberId: string; amount: number; settled: boolean }[]
  createdAt: string
}
