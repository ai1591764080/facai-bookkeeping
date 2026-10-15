import { defineStore } from 'pinia' // Pinia：defineStore 定义响应式状态仓库
import { ref, computed } from 'vue' // Vue 响应式：ref 声明响应式数据，computed 派生计算值
import type { Ledger } from '../types' // 账本的类型定义
import { getLedgers, saveLedgers, getCurrentLedgerId, setCurrentLedgerId } from '../utils/db' // 本地存储封装：读取/保存账本、读写当前账本 ID
import { uuid } from '../utils/uuid' // 生成唯一 ID

// 标记默认账本是否已初始化过一次，用于区分「首次使用」与「用户删空」
const SEED_KEY = 'beecount_seeded_ledgers'

export const useLedgerStore = defineStore('ledger', () => {
  const ledgers = ref<Ledger[]>(loadLedgers())
  const currentId = ref<string>(getCurrentLedgerId() || (ledgers.value[0]?.id ?? ''))

  function loadLedgers(): Ledger[] {
    const existing = getLedgers()
    if (existing.length > 0) return existing
    // 已初始化过就说明是用户主动删空的，不再重建默认账本
    if (uni.getStorageSync(SEED_KEY)) return []
    const defaults: Ledger[] = [
      { id: uuid(), name: '日常账本', type: 'personal', currency: 'CNY', memberCount: 1, createdAt: new Date().toISOString() },
    ]
    saveLedgers(defaults)
    setCurrentLedgerId(defaults[0].id)
    uni.setStorageSync(SEED_KEY, '1')
    return defaults
  }

  const current = computed(() => ledgers.value.find((l) => l.id === currentId.value) || ledgers.value[0])

  function switchLedger(id: string) {
    currentId.value = id
    setCurrentLedgerId(id)
  }

  function add(name: string, type: 'personal' | 'shared' = 'personal'): Ledger {
    const l: Ledger = { id: uuid(), name, type, currency: 'CNY', memberCount: 1, createdAt: new Date().toISOString() }
    ledgers.value.push(l)
    saveLedgers(ledgers.value)
    return l
  }

  function update(l: Ledger) {
    const idx = ledgers.value.findIndex((x) => x.id === l.id)
    if (idx !== -1) ledgers.value[idx] = l
    saveLedgers(ledgers.value)
  }

  function remove(id: string) {
    // 至少保留一个账本，删光会导致没有当前账本、各页面取不到数据
    if (ledgers.value.length <= 1) return false
    ledgers.value = ledgers.value.filter((l) => l.id !== id)
    saveLedgers(ledgers.value)
    if (currentId.value === id && ledgers.value.length > 0) {
      switchLedger(ledgers.value[0].id)
    }
    return true
  }

  /** 从本地存储重新加载（导入备份后用于刷新内存数据与当前账本） */
  function reload() {
    ledgers.value = loadLedgers()
    currentId.value = getCurrentLedgerId() || (ledgers.value[0]?.id ?? '')
  }

  return { ledgers, currentId, current, switchLedger, add, update, remove, reload }
})
