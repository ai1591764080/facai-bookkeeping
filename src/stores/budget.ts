import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { Budget } from '../types'
import { getBudgets, saveBudgets } from '../utils/db'
import { uuid } from '../utils/uuid'

export const useBudgetStore = defineStore('budget', () => {
  const budgets = ref<Budget[]>(getBudgets())

  function getByLedger(ledgerId: string): Budget[] {
    return budgets.value.filter((b) => b.ledgerId === ledgerId && b.enabled)
  }

  function add(b: Omit<Budget, 'id' | 'createdAt'>): Budget {
    const newBudget: Budget = { ...b, id: uuid(), createdAt: new Date().toISOString() }
    budgets.value.push(newBudget)
    saveBudgets(budgets.value)
    return newBudget
  }

  function update(b: Budget) {
    const idx = budgets.value.findIndex((x) => x.id === b.id)
    if (idx !== -1) budgets.value[idx] = b
    saveBudgets(budgets.value)
  }

  function remove(id: string) {
    budgets.value = budgets.value.filter((b) => b.id !== id)
    saveBudgets(budgets.value)
  }

  return { budgets, getByLedger, add, update, remove }
})
