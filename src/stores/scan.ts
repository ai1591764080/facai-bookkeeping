import { defineStore } from 'pinia' // Pinia：defineStore 定义响应式状态仓库
import { ref } from 'vue' // Vue 响应式：ref 声明响应式数据
import type { ScanRecord, ScanCandidate, Transaction, Category, Account } from '../types' // 扫描记录/候选账单/交易/分类/账户类型定义
import { getScanRecords, saveScanRecords } from '../utils/db' // 本地存储封装：读取/保存扫描记录
import { uuid } from '../utils/uuid' // 生成唯一 ID

function buildTransaction(candidate: ScanCandidate, category: Category, account: Account, ledgerId: string): Transaction {
  const now = new Date().toISOString()
  return {
    id: uuid(),
    ledgerId,
    type: candidate.type,
    amount: Math.abs(candidate.amount),
    categoryId: category.id,
    accountId: account.id,
    happenedAt: candidate.date || now.slice(0, 10),
    note: candidate.note || '',
    createdAt: now,
    updatedAt: now,
    excludeFromStats: false,
    excludeFromBudget: false,
  }
}

export const useScanStore = defineStore('scan', () => {
  const records = ref<ScanRecord[]>(getScanRecords())

  function persist() {
    saveScanRecords(records.value)
  }

  function addRecord(rec: Omit<ScanRecord, 'id' | 'createdAt'>): ScanRecord {
    const r: ScanRecord = {
      ...rec,
      id: uuid(),
      createdAt: new Date().toISOString(),
    }
    records.value.unshift(r)
    persist()
    return r
  }

  function updateRecord(id: string, patch: Partial<ScanRecord>) {
    const idx = records.value.findIndex((x) => x.id === id)
    if (idx !== -1) {
      records.value[idx] = { ...records.value[idx], ...patch }
      persist()
    }
  }

  function removeRecord(id: string) {
    records.value = records.value.filter((x) => x.id !== id)
    persist()
  }

  /**
   * 归档：用户确认同意后，才把候选账单写入真实账本并计入统计。
   * 未调用此方法前，记录保持 pending 状态，不影响任何统计。
   */
  function archive(
    id: string,
    categories: Category[],
    accounts: Account[],
    ledgerId: string,
    onAddTransaction: (tx: Transaction) => void,
    onAdjustBalance: (accountId: string, delta: number) => void
  ): { created: number } {
    const rec = records.value.find((x) => x.id === id)
    if (!rec || rec.status !== 'pending') return { created: 0 }

    const catMap = new Map<string, Category>()
    categories.forEach((c) => catMap.set(`${c.kind}:${c.name}`, c))
    const accMap = new Map<string, Account>()
    accounts.forEach((a) => accMap.set(a.name, a))

    const txIds: string[] = []
    for (const cand of rec.candidates) {
      const cat = catMap.get(`${cand.type}:${cand.categoryName}`) || categories.find((c) => c.level === 1 && c.kind === cand.type && c.name === '其他') || categories[0]
      const acc = accMap.get(cand.accountName) || accounts[0]
      if (!cat || !acc) continue

      const tx = buildTransaction(cand, cat, acc, ledgerId)
      onAddTransaction(tx)
      txIds.push(tx.id)
      // 同步账户余额：支出减少、收入增加
      onAdjustBalance(acc.id, cand.type === 'expense' ? -Math.abs(cand.amount) : Math.abs(cand.amount))
    }

    updateRecord(id, {
      status: 'archived',
      transactionIds: txIds,
      archivedAt: new Date().toISOString(),
    })

    return { created: txIds.length }
  }

  function reject(id: string) {
    updateRecord(id, { status: 'rejected' })
  }

  function pendingCount() {
    return records.value.filter((r) => r.status === 'pending').length
  }

  return { records, addRecord, updateRecord, removeRecord, archive, reject, pendingCount }
})
