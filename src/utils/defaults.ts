import type { Category } from '../types' // 分类的类型定义
import { uuid } from '../utils/uuid' // 生成唯一 ID

export const DEFAULT_EXPENSE_CATEGORIES: Omit<Category, 'id'>[] = [
  { name: '餐饮', kind: 'expense', icon: '🍜', sortOrder: 1, parentId: null, level: 1 },
  { name: '交通', kind: 'expense', icon: '🚗', sortOrder: 2, parentId: null, level: 1 },
  { name: '购物', kind: 'expense', icon: '🛒', sortOrder: 3, parentId: null, level: 1 },
  { name: '娱乐', kind: 'expense', icon: '🎬', sortOrder: 4, parentId: null, level: 1 },
  { name: '居住', kind: 'expense', icon: '🏠', sortOrder: 5, parentId: null, level: 1 },
  { name: '通讯', kind: 'expense', icon: '📱', sortOrder: 6, parentId: null, level: 1 },
  { name: '服饰', kind: 'expense', icon: '👕', sortOrder: 7, parentId: null, level: 1 },
  { name: '医疗', kind: 'expense', icon: '💊', sortOrder: 8, parentId: null, level: 1 },
  { name: '教育', kind: 'expense', icon: '📚', sortOrder: 9, parentId: null, level: 1 },
  { name: '旅行', kind: 'expense', icon: '✈️', sortOrder: 10, parentId: null, level: 1 },
  { name: '人情', kind: 'expense', icon: '🎁', sortOrder: 11, parentId: null, level: 1 },
  { name: '宠物', kind: 'expense', icon: '🐾', sortOrder: 12, parentId: null, level: 1 },
  { name: '数码', kind: 'expense', icon: '💻', sortOrder: 13, parentId: null, level: 1 },
  { name: '运动', kind: 'expense', icon: '⚽', sortOrder: 14, parentId: null, level: 1 },
  { name: '美容', kind: 'expense', icon: '💄', sortOrder: 15, parentId: null, level: 1 },
  { name: '日用', kind: 'expense', icon: '🧴', sortOrder: 16, parentId: null, level: 1 },
  { name: '水电', kind: 'expense', icon: '💡', sortOrder: 17, parentId: null, level: 1 },
  { name: '社交', kind: 'expense', icon: '🤝', sortOrder: 18, parentId: null, level: 1 },
  { name: '红包', kind: 'expense', icon: '🧧', sortOrder: 19, parentId: null, level: 1 },
  { name: '其他', kind: 'expense', icon: '📌', sortOrder: 20, parentId: null, level: 1 },
]

export const DEFAULT_INCOME_CATEGORIES: Omit<Category, 'id'>[] = [
  { name: '工资', kind: 'income', icon: '💰', sortOrder: 1, parentId: null, level: 1 },
  { name: '奖金', kind: 'income', icon: '🏆', sortOrder: 2, parentId: null, level: 1 },
  { name: '理财', kind: 'income', icon: '📈', sortOrder: 3, parentId: null, level: 1 },
  { name: '兼职', kind: 'income', icon: '💼', sortOrder: 4, parentId: null, level: 1 },
  { name: '红包', kind: 'income', icon: '🧧', sortOrder: 5, parentId: null, level: 1 },
  { name: '报销', kind: 'income', icon: '🧾', sortOrder: 6, parentId: null, level: 1 },
  { name: '退款', kind: 'income', icon: '↩️', sortOrder: 7, parentId: null, level: 1 },
  { name: '利息', kind: 'income', icon: '🏦', sortOrder: 8, parentId: null, level: 1 },
  { name: '其他', kind: 'income', icon: '📌', sortOrder: 9, parentId: null, level: 1 },
]

export function buildDefaultCategories(): Category[] {
  return [...DEFAULT_EXPENSE_CATEGORIES, ...DEFAULT_INCOME_CATEGORIES].map((c) => ({
    ...c,
    id: uuid(),
  }))
}
