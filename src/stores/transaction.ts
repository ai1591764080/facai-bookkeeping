import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { Transaction } from '../types'
import { getTransactions, saveTransactions, addTransaction as dbAdd, updateTransaction as dbUpdate, deleteTransaction as dbDelete } from '../utils/db'

export const useTransactionStore = defineStore('transaction', () => {
  const transactions = ref<Transaction[]>(getTransactions())

  const totalCount = computed(() => transactions.value.length)

  function add(t: Transaction) {
    dbAdd(t)
    transactions.value.unshift(t)
  }

  function update(t: Transaction) {
    dbUpdate(t)
    const idx = transactions.value.findIndex((x) => x.id === t.id)
    if (idx !== -1) transactions.value[idx] = t
  }

  function remove(id: string) {
    dbDelete(id)
    transactions.value = transactions.value.filter((x) => x.id !== id)
  }

  function reload() {
    transactions.value = getTransactions()
  }

  function getByLedger(ledgerId: string): Transaction[] {
    return transactions.value.filter((t) => t.ledgerId === ledgerId)
  }

  function getInRange(start: Date, end: Date, ledgerId: string): Transaction[] {
    return transactions.value.filter((t) => {
      if (t.ledgerId !== ledgerId) return false
      const d = new Date(t.happenedAt)
      return d >= start && d <= end
    })
  }

  function monthlyTotal(year: number, month: number, type: 'expense' | 'income', ledgerId: string): number {
    const start = new Date(year, month, 1)
    const end = new Date(year, month + 1, 0, 23, 59, 59, 999)
    return getInRange(start, end, ledgerId)
      .filter((t) => t.type === type && !t.excludeFromStats)
      .reduce((sum, t) => sum + t.amount, 0)
  }

  function dailyTotals(year: number, month: number, type: 'expense' | 'income', ledgerId: string): { date: string; amount: number }[] {
    const start = new Date(year, month, 1)
    const end = new Date(year, month + 1, 0, 23, 59, 59, 999)
    const filtered = getInRange(start, end, ledgerId).filter((t) => t.type === type && !t.excludeFromStats)
    const map = new Map<string, number>()
    filtered.forEach((t) => {
      const key = t.happenedAt.slice(0, 10)
      map.set(key, (map.get(key) || 0) + t.amount)
    })
    return Array.from(map.entries())
      .map(([date, amount]) => ({ date, amount }))
      .sort((a, b) => a.date.localeCompare(b.date))
  }

  function categoryTotals(start: Date, end: Date, type: 'expense' | 'income', ledgerId: string): { categoryId: string; amount: number }[] {
    const filtered = getInRange(start, end, ledgerId).filter((t) => t.type === type && !t.excludeFromStats)
    const map = new Map<string, number>()
    filtered.forEach((t) => {
      map.set(t.categoryId, (map.get(t.categoryId) || 0) + t.amount)
    })
    return Array.from(map.entries())
      .map(([categoryId, amount]) => ({ categoryId, amount }))
      .sort((a, b) => b.amount - a.amount)
  }

  return {
    transactions,
    totalCount,
    add,
    update,
    remove,
    reload,
    getByLedger,
    getInRange,
    monthlyTotal,
    dailyTotals,
    categoryTotals,
  }
})
