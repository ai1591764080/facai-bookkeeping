import { defineStore } from 'pinia' // Pinia：defineStore 定义响应式状态仓库
import { ref, computed } from 'vue' // Vue 响应式：ref 声明响应式数据，computed 派生计算值
import type { Category } from '../types' // 分类的类型定义
import { getCategories, saveCategories } from '../utils/db' // 本地存储封装：读取/保存分类
import { buildDefaultCategories } from '../utils/defaults' // 生成内置默认分类数据
import { uuid } from '../utils/uuid' // 生成唯一 ID

export const useCategoryStore = defineStore('category', () => {
  const categories = ref<Category[]>(loadCategories())

  function loadCategories(): Category[] {
    const existing = getCategories()
    if (existing.length > 0) return existing
    const defaults = buildDefaultCategories()
    saveCategories(defaults)
    return defaults
  }

  const expenseCategories = computed(() =>
    categories.value.filter((c) => c.kind === 'expense' && c.level === 1).sort((a, b) => a.sortOrder - b.sortOrder)
  )

  const incomeCategories = computed(() =>
    categories.value.filter((c) => c.kind === 'income' && c.level === 1).sort((a, b) => a.sortOrder - b.sortOrder)
  )

  function getById(id: string): Category | undefined {
    return categories.value.find((c) => c.id === id)
  }

  function getChildren(parentId: string): Category[] {
    return categories.value.filter((c) => c.parentId === parentId).sort((a, b) => a.sortOrder - b.sortOrder)
  }

  function addCategory(c: Omit<Category, 'id'>): Category {
    const newCat: Category = { ...c, id: uuid() }
    categories.value.push(newCat)
    saveCategories(categories.value)
    return newCat
  }

  function updateCategory(c: Category) {
    const idx = categories.value.findIndex((x) => x.id === c.id)
    if (idx !== -1) categories.value[idx] = c
    saveCategories(categories.value)
  }

  function removeCategory(id: string) {
    categories.value = categories.value.filter((c) => c.id !== id && c.parentId !== id)
    saveCategories(categories.value)
  }

  return {
    categories,
    expenseCategories,
    incomeCategories,
    getById,
    getChildren,
    addCategory,
    updateCategory,
    removeCategory,
  }
})
