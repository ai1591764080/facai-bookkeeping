import { defineStore } from 'pinia' // Pinia：defineStore 定义响应式状态仓库
import { ref, computed } from 'vue' // Vue 响应式：ref 声明响应式数据，computed 派生计算值
import type { Account } from '../types' // 账户的类型定义
import { getAccounts, saveAccounts, addAccount as dbAdd, updateAccount as dbUpdate, deleteAccount as dbDelete } from '../utils/db' // 本地存储封装：读取/保存/增删账户
import { uuid } from '../utils/uuid' // 生成唯一 ID

// 标记默认账户是否已初始化过一次，用于区分「首次使用」与「用户删空」
const SEED_KEY = 'beecount_seeded_accounts'

export const useAccountStore = defineStore('account', () => {
  const accounts = ref<Account[]>(loadAccounts())

  function loadAccounts(): Account[] {
    const existing = getAccounts()
    if (existing.length > 0) return existing
    // 已初始化过就说明是用户主动删空的，不再重建默认账户
    if (uni.getStorageSync(SEED_KEY)) return []
    const defaults: Account[] = [
      { id: uuid(), ledgerId: '', name: '现金', type: 'cash', initialBalance: 0, balance: 0, icon: '💵', sortOrder: 1, hidden: false, createdAt: new Date().toISOString() },
      { id: uuid(), ledgerId: '', name: '银行卡', type: 'bank_card', initialBalance: 0, balance: 0, icon: '💳', sortOrder: 2, hidden: false, createdAt: new Date().toISOString() },
      { id: uuid(), ledgerId: '', name: '支付宝', type: 'alipay', initialBalance: 0, balance: 0, icon: '📱', sortOrder: 3, hidden: false, createdAt: new Date().toISOString() },
      { id: uuid(), ledgerId: '', name: '微信', type: 'wechat', initialBalance: 0, balance: 0, icon: '💬', sortOrder: 4, hidden: false, createdAt: new Date().toISOString() },
    ]
    saveAccounts(defaults)
    uni.setStorageSync(SEED_KEY, '1')
    return defaults
  }

  const visibleAccounts = computed(() => accounts.value.filter((a) => !a.hidden).sort((a, b) => a.sortOrder - b.sortOrder))
  const totalAssets = computed(() => accounts.value.filter((a) => a.type !== 'credit_card' && a.type !== 'loan').reduce((s, a) => s + a.balance, 0))
  const totalLiabilities = computed(() => accounts.value.filter((a) => a.type === 'credit_card' || a.type === 'loan').reduce((s, a) => s + Math.abs(a.balance), 0))
  const netWorth = computed(() => totalAssets.value - totalLiabilities.value)

  function getById(id: string): Account | undefined {
    return accounts.value.find((a) => a.id === id)
  }

  function add(a: Omit<Account, 'id' | 'createdAt'>): Account {
    const newAcc: Account = { ...a, id: uuid(), createdAt: new Date().toISOString() }
    dbAdd(newAcc)
    accounts.value.push(newAcc)
    return newAcc
  }

  function update(a: Account) {
    dbUpdate(a)
    const idx = accounts.value.findIndex((x) => x.id === a.id)
    if (idx !== -1) accounts.value[idx] = a
  }

  function remove(id: string) {
    dbDelete(id)
    accounts.value = accounts.value.filter((a) => a.id !== id)
  }

  function adjustBalance(id: string, delta: number) {
    const acc = accounts.value.find((a) => a.id === id)
    if (acc) {
      acc.balance += delta
      saveAccounts(accounts.value)
    }
  }

  /** 从本地存储重新加载（导入备份后用于刷新内存数据） */
  function reload() {
    accounts.value = loadAccounts()
  }

  return { accounts, visibleAccounts, totalAssets, totalLiabilities, netWorth, getById, add, update, remove, adjustBalance, reload }
})
