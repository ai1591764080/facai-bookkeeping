import { defineStore } from 'pinia' // Pinia：defineStore 定义响应式状态仓库
import { ref } from 'vue' // Vue 响应式：ref 声明响应式数据
import type { Budget } from '../types' // 预算的类型定义
import { getBudgets, saveBudgets } from '../utils/db' // 本地存储封装：读取/保存预算
import { uuid } from '../utils/uuid' // 生成唯一 ID

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

  /** 从本地存储重新加载（导入备份后用于刷新内存数据） */
  function reload() {
    budgets.value = getBudgets()
  }

  return { budgets, getByLedger, add, update, remove, reload }
})
