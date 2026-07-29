import type { Transaction, Category, Account, Ledger, Budget, Tag, AABill } from '../types'

const KEYS = {
  TRANSACTIONS: 'beecount_transactions',
  CATEGORIES: 'beecount_categories',
  ACCOUNTS: 'beecount_accounts',
  LEDGERS: 'beecount_ledgers',
  BUDGETS: 'beecount_budgets',
  TAGS: 'beecount_tags',
  AA_BILLS: 'beecount_aa_bills',
  CURRENT_LEDGER: 'beecount_current_ledger',
} as const

function get<T>(key: string, fallback: T): T {
  try {
    const raw = uni.getStorageSync(key)
    if (!raw) return fallback
    return typeof raw === 'string' ? JSON.parse(raw) : raw
  } catch {
    return fallback
  }
}

function set<T>(key: string, value: T): void {
  uni.setStorageSync(key, JSON.stringify(value))
}

// ---------- Transactions ----------
export function getTransactions(): Transaction[] {
  return get<Transaction[]>(KEYS.TRANSACTIONS, [])
}

export function saveTransactions(list: Transaction[]): void {
  set(KEYS.TRANSACTIONS, list)
}

export function addTransaction(t: Transaction): void {
  const list = getTransactions()
  list.unshift(t)
  saveTransactions(list)
}

export function updateTransaction(t: Transaction): void {
  const list = getTransactions().map((x) => (x.id === t.id ? t : x))
  saveTransactions(list)
}

export function deleteTransaction(id: string): void {
  saveTransactions(getTransactions().filter((x) => x.id !== id))
}

// ---------- Categories ----------
export function getCategories(): Category[] {
  return get<Category[]>(KEYS.CATEGORIES, [])
}

export function saveCategories(list: Category[]): void {
  set(KEYS.CATEGORIES, list)
}

// ---------- Accounts ----------
export function getAccounts(): Account[] {
  return get<Account[]>(KEYS.ACCOUNTS, [])
}

export function saveAccounts(list: Account[]): void {
  set(KEYS.ACCOUNTS, list)
}

export function addAccount(a: Account): void {
  const list = getAccounts()
  list.push(a)
  saveAccounts(list)
}

export function updateAccount(a: Account): void {
  saveAccounts(getAccounts().map((x) => (x.id === a.id ? a : x)))
}

export function deleteAccount(id: string): void {
  saveAccounts(getAccounts().filter((x) => x.id !== id))
}

// ---------- Ledgers ----------
export function getLedgers(): Ledger[] {
  return get<Ledger[]>(KEYS.LEDGERS, [])
}

export function saveLedgers(list: Ledger[]): void {
  set(KEYS.LEDGERS, list)
}

export function getCurrentLedgerId(): string {
  return get<string>(KEYS.CURRENT_LEDGER, '')
}

export function setCurrentLedgerId(id: string): void {
  set(KEYS.CURRENT_LEDGER, id)
}

// ---------- Budgets ----------
export function getBudgets(): Budget[] {
  return get<Budget[]>(KEYS.BUDGETS, [])
}

export function saveBudgets(list: Budget[]): void {
  set(KEYS.BUDGETS, list)
}

// ---------- Tags ----------
export function getTags(): Tag[] {
  return get<Tag[]>(KEYS.TAGS, [])
}

export function saveTags(list: Tag[]): void {
  set(KEYS.TAGS, list)
}

// ---------- AA Bills ----------
export function getAABills(): AABill[] {
  return get<AABill[]>(KEYS.AA_BILLS, [])
}

export function saveAABills(list: AABill[]): void {
  set(KEYS.AA_BILLS, list)
}
