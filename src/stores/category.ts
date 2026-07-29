import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { Category } from '../types'
import { getCategories, saveCategories } from '../utils/db'
import { buildDefaultCategories } from '../utils/defaults'
import { uuid } from '../utils/uuid'

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
