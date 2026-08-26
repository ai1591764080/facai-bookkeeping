<script setup lang="ts">
import { ref, computed } from 'vue' // Vue 响应式：ref 声明响应式数据，computed 派生计算值
import { useBudgetStore, useTransactionStore, useCategoryStore, useLedgerStore } from '../../stores' // 预算/交易/分类/账本状态仓库
import { onLoad } from '@dcloudio/uni-app' // uni-app 生命周期钩子：onLoad 页面加载时触发
import type { Budget, BudgetPeriod } from '../../types' // 预算及其周期的类型定义

const budgetStore = useBudgetStore()
const transactionStore = useTransactionStore()
const categoryStore = useCategoryStore()
const ledgerStore = useLedgerStore()

const showAddModal = ref(false)

// Add form state
const formType = ref<'total' | 'category'>('total')
const formCategoryId = ref('')
const formAmount = ref('')
const formPeriod = ref<BudgetPeriod>('monthly')

const currentLedgerId = computed(() => ledgerStore.currentId)

// Get budgets for current ledger
const ledgerBudgets = computed(() => budgetStore.getByLedger(currentLedgerId.value))

const totalBudget = computed(() => ledgerBudgets.value.find(b => b.type === 'total'))
const categoryBudgets = computed(() => ledgerBudgets.value.filter(b => b.type === 'category'))

// Calculate current month's date range
const now = new Date()
const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999)

// Calculate spent amounts
function getSpent(budget: Budget): number {
  const txns = transactionStore.getInRange(monthStart, monthEnd, currentLedgerId.value)
  if (budget.type === 'total') {
    return txns
      .filter(t => t.type === 'expense' && !t.excludeFromBudget)
      .reduce((sum, t) => sum + t.amount, 0)
  }
  return txns
    .filter(t => t.type === 'expense' && !t.excludeFromBudget && t.categoryId === budget.categoryId)
    .reduce((sum, t) => sum + t.amount, 0)
}

function getProgressPercent(spent: number, total: number): number {
  if (total <= 0) return 0
  return Math.min(100, Math.round((spent / total) * 100))
}

function getProgressColor(percent: number): string {
  if (percent >= 100) return '#EF4444'
  if (percent >= 80) return '#F59E0B'
  return 'var(--primary)'
}

function getCategoryName(categoryId?: string): string {
  if (!categoryId) return '总预算'
  const cat = categoryStore.getById(categoryId)
  return cat?.name || '未知分类'
}

function getCategoryIcon(categoryId?: string): string {
  if (!categoryId) return '💰'
  const cat = categoryStore.getById(categoryId)
  return cat?.icon || '📌'
}

// Add modal
function onOpenAdd() {
  formType.value = 'total'
  formCategoryId.value = ''
  formAmount.value = ''
  formPeriod.value = 'monthly'
  showAddModal.value = true
}

function onCloseModal() {
  showAddModal.value = false
}

const periodLabels: Record<BudgetPeriod, string> = {
  monthly: '每月',
  weekly: '每周',
  yearly: '每年',
}

function onConfirmAdd() {
  const amount = parseFloat(formAmount.value)
  if (!amount || amount <= 0) {
    uni.showToast({ title: '请输入有效金额', icon: 'none' })
    return
  }

  if (formType.value === 'category' && !formCategoryId.value) {
    uni.showToast({ title: '请选择分类', icon: 'none' })
    return
  }

  budgetStore.add({
    ledgerId: currentLedgerId.value,
    type: formType.value,
    categoryId: formType.value === 'category' ? formCategoryId.value : undefined,
    amount,
    period: formPeriod.value,
    enabled: true,
  })

  showAddModal.value = false
  uni.showToast({ title: '添加成功', icon: 'success' })
}

function onDeleteBudget(budget: Budget) {
  uni.showModal({
    title: '确认删除',
    content: '确定要删除此预算吗？',
    success(res) {
      if (res.confirm) {
        budgetStore.remove(budget.id)
        uni.showToast({ title: '已删除', icon: 'success' })
      }
    }
  })
}

function formatAmount(val: number): string {
  return val.toFixed(2)
}
</script>

<template>
  <view class="budget-page">
    <!-- Total budget -->
    <view v-if="totalBudget" class="card total-card">
      <view class="card-header">
        <view class="card-title-row">
          <text class="card-title-icon">💰</text>
          <text class="card-title">总预算</text>
        </view>
        <view class="delete-action" @tap="onDeleteBudget(totalBudget)">
          <text class="delete-text">删除</text>
        </view>
      </view>
      <view class="budget-amounts">
        <text class="spent" :class="{ warning: getProgressPercent(getSpent(totalBudget), totalBudget.amount) >= 80 }">
          {{ formatAmount(getSpent(totalBudget)) }}
        </text>
        <text class="separator"> / </text>
        <text class="total">{{ formatAmount(totalBudget.amount) }}</text>
        <text class="unit"> 元</text>
      </view>
      <view class="progress-bar">
        <view
          class="progress-fill"
          :style="{
            width: getProgressPercent(getSpent(totalBudget), totalBudget.amount) + '%',
            background: getProgressColor(getProgressPercent(getSpent(totalBudget), totalBudget.amount))
          }"
        ></view>
      </view>
      <view class="progress-info">
        <text class="progress-label">{{ periodLabels[totalBudget.period] }}</text>
        <text class="progress-percent">{{ getProgressPercent(getSpent(totalBudget), totalBudget.amount) }}%</text>
      </view>
    </view>

    <!-- No total budget hint -->
    <view v-else class="card hint-card" @tap="onOpenAdd">
      <text class="hint-text">+ 设置总预算</text>
    </view>

    <!-- Category budgets -->
    <view class="section-title">分类预算</view>

    <view v-if="categoryBudgets.length > 0" class="card category-card">
      <view
        v-for="budget in categoryBudgets"
        :key="budget.id"
        class="category-budget-item"
      >
        <view class="cb-header">
          <view class="cb-title-row">
            <text class="cb-icon">{{ getCategoryIcon(budget.categoryId) }}</text>
            <text class="cb-name">{{ getCategoryName(budget.categoryId) }}</text>
          </view>
          <view class="delete-action" @tap="onDeleteBudget(budget)">
            <text class="delete-text">删除</text>
          </view>
        </view>
        <view class="cb-amounts">
          <text class="cb-spent" :class="{ warning: getProgressPercent(getSpent(budget), budget.amount) >= 80 }">
            {{ formatAmount(getSpent(budget)) }}
          </text>
          <text class="cb-separator"> / </text>
          <text class="cb-total">{{ formatAmount(budget.amount) }}</text>
        </view>
        <view class="progress-bar">
          <view
            class="progress-fill"
            :style="{
              width: getProgressPercent(getSpent(budget), budget.amount) + '%',
              background: getProgressColor(getProgressPercent(getSpent(budget), budget.amount))
            }"
          ></view>
        </view>
        <text class="cb-percent">{{ getProgressPercent(getSpent(budget), budget.amount) }}%</text>
      </view>
    </view>

    <view v-else class="empty-hint">
      <text class="empty-hint-text">暂无分类预算</text>
    </view>

    <!-- Add button -->
    <view class="fab-area">
      <view class="fab-btn" @tap="onOpenAdd">
        <text class="fab-text">+ 添加预算</text>
      </view>
    </view>

    <!-- Add modal -->
    <view v-if="showAddModal" class="modal-mask" @tap="onCloseModal">
      <view class="modal-content" @tap.stop>
        <text class="modal-title">添加预算</text>

        <view class="modal-field">
          <text class="field-label">预算类型</text>
          <view class="type-row">
            <view
              class="type-option"
              :class="{ active: formType === 'total' }"
              @tap="formType = 'total'"
            >
              <text class="type-option-text">总预算</text>
            </view>
            <view
              class="type-option"
              :class="{ active: formType === 'category' }"
              @tap="formType = 'category'"
            >
              <text class="type-option-text">分类预算</text>
            </view>
          </view>
        </view>

        <!-- Category picker for category budget -->
        <view v-if="formType === 'category'" class="modal-field">
          <text class="field-label">选择分类</text>
          <scroll-view scroll-y class="category-scroll">
            <view
              v-for="cat in categoryStore.expenseCategories"
              :key="cat.id"
              class="category-option"
              :class="{ active: formCategoryId === cat.id }"
              @tap="formCategoryId = cat.id"
            >
              <text class="category-option-icon">{{ cat.icon }}</text>
              <text class="category-option-name">{{ cat.name }}</text>
            </view>
          </scroll-view>
        </view>

        <view class="modal-field">
          <text class="field-label">预算金额</text>
          <view class="field-input-wrap">
            <input
              class="field-input"
              v-model="formAmount"
              type="digit"
              placeholder="请输入金额"
              placeholder-class="placeholder"
            />
          </view>
        </view>

        <view class="modal-field">
          <text class="field-label">周期</text>
          <view class="type-row">
            <view
              v-for="(label, key) in periodLabels"
              :key="key"
              class="type-option small"
              :class="{ active: formPeriod === key }"
              @tap="formPeriod = key"
            >
              <text class="type-option-text">{{ label }}</text>
            </view>
          </view>
        </view>

        <view class="modal-actions">
          <view class="modal-btn cancel" @tap="onCloseModal">
            <text class="modal-btn-text cancel-text">取消</text>
          </view>
          <view class="modal-btn confirm" @tap="onConfirmAdd">
            <text class="modal-btn-text confirm-text">确定</text>
          </view>
        </view>
      </view>
    </view>
  </view>
</template>

<style scoped>
.budget-page {
  min-height: 100vh;
  background: var(--bg);
  padding: 24rpx;
  padding-bottom: 140rpx;
}

.total-card {
  padding: 32rpx 28rpx;
}

.card-header {
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 20rpx;
}

.card-title-row {
  display: flex;
  flex-direction: row;
  align-items: center;
}

.card-title-icon {
  font-size: 36rpx;
  margin-right: 12rpx;
}

.card-title {
  font-size: 30rpx;
  font-weight: 600;
  color: var(--text-primary);
}

.delete-action {
  padding: 8rpx 16rpx;
}

.delete-text {
  font-size: 24rpx;
  color: #EF4444;
}

.budget-amounts {
  display: flex;
  flex-direction: row;
  align-items: baseline;
  margin-bottom: 16rpx;
}

.spent {
  font-size: 40rpx;
  font-weight: 700;
  color: var(--text-primary);
}

.spent.warning {
  color: #EF4444;
}

.separator {
  font-size: 28rpx;
  color: var(--text-tertiary);
  margin: 0 4rpx;
}

.total {
  font-size: 28rpx;
  color: var(--text-secondary);
}

.unit {
  font-size: 24rpx;
  color: var(--text-tertiary);
  margin-left: 4rpx;
}

.progress-bar {
  height: 14rpx;
  background: var(--border);
  border-radius: 7rpx;
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  border-radius: 7rpx;
  transition: width 0.3s ease;
}

.progress-info {
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: space-between;
  margin-top: 12rpx;
}

.progress-label {
  font-size: 24rpx;
  color: var(--text-secondary);
}

.progress-percent {
  font-size: 24rpx;
  color: var(--text-secondary);
  font-weight: 500;
}

.hint-card {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 32rpx;
  border: 2rpx dashed var(--border);
}

.hint-text {
  font-size: 28rpx;
  color: var(--primary);
  font-weight: 500;
}

.section-title {
  font-size: 30rpx;
  font-weight: 600;
  color: var(--text-primary);
  margin: 32rpx 4rpx 16rpx;
}

.category-card {
  padding: 0 28rpx;
}

.category-budget-item {
  padding: 24rpx 0;
  border-bottom: 1rpx solid var(--border);
}

.category-budget-item:last-child {
  border-bottom: none;
}

.cb-header {
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12rpx;
}

.cb-title-row {
  display: flex;
  flex-direction: row;
  align-items: center;
}

.cb-icon {
  font-size: 32rpx;
  margin-right: 12rpx;
}

.cb-name {
  font-size: 28rpx;
  font-weight: 500;
  color: var(--text-primary);
}

.cb-amounts {
  display: flex;
  flex-direction: row;
  align-items: baseline;
  margin-bottom: 12rpx;
}

.cb-spent {
  font-size: 30rpx;
  font-weight: 600;
  color: var(--text-primary);
}

.cb-spent.warning {
  color: #EF4444;
}

.cb-separator {
  font-size: 24rpx;
  color: var(--text-tertiary);
  margin: 0 4rpx;
}

.cb-total {
  font-size: 24rpx;
  color: var(--text-secondary);
}

.cb-percent {
  font-size: 22rpx;
  color: var(--text-tertiary);
  margin-top: 8rpx;
}

.empty-hint {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 40rpx;
}

.empty-hint-text {
  font-size: 26rpx;
  color: var(--text-tertiary);
}

.fab-area {
  position: fixed;
  bottom: 60rpx;
  left: 24rpx;
  right: 24rpx;
}

.fab-btn {
  background: var(--primary);
  border-radius: var(--radius);
  padding: 28rpx 0;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 8rpx 24rpx rgba(79, 110, 247, 0.3);
}

.fab-text {
  color: #fff;
  font-size: 30rpx;
  font-weight: 600;
}

/* Modal */
.modal-mask {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.modal-content {
  width: 620rpx;
  max-height: 80vh;
  overflow-y: auto;
  background: var(--card);
  border-radius: var(--radius-lg);
  padding: 40rpx;
}

.modal-title {
  font-size: 34rpx;
  font-weight: 600;
  color: var(--text-primary);
  text-align: center;
  margin-bottom: 32rpx;
  display: block;
}

.modal-field {
  margin-bottom: 24rpx;
}

.field-label {
  font-size: 26rpx;
  color: var(--text-secondary);
  margin-bottom: 12rpx;
  display: block;
}

.field-input-wrap {
  background: var(--bg);
  border-radius: var(--radius);
  padding: 0 20rpx;
  border: 2rpx solid var(--border);
}

.field-input {
  height: 80rpx;
  font-size: 28rpx;
  color: var(--text-primary);
}

.placeholder {
  color: var(--text-tertiary);
}

.type-row {
  display: flex;
  flex-direction: row;
  gap: 16rpx;
}

.type-option {
  flex: 1;
  padding: 20rpx 0;
  border-radius: var(--radius);
  background: var(--bg);
  border: 2rpx solid var(--border);
  display: flex;
  align-items: center;
  justify-content: center;
}

.type-option.small {
  padding: 16rpx 0;
}

.type-option.active {
  border-color: var(--primary);
  background: var(--primary-light);
}

.type-option-text {
  font-size: 26rpx;
  color: var(--text-secondary);
  font-weight: 500;
}

.type-option.active .type-option-text {
  color: var(--primary);
}

.category-scroll {
  max-height: 300rpx;
  background: var(--bg);
  border-radius: var(--radius);
  border: 2rpx solid var(--border);
  padding: 8rpx;
}

.category-option {
  display: flex;
  flex-direction: row;
  align-items: center;
  padding: 18rpx 16rpx;
  border-radius: 8rpx;
}

.category-option.active {
  background: var(--primary-light);
}

.category-option-icon {
  font-size: 28rpx;
  margin-right: 12rpx;
}

.category-option-name {
  font-size: 26rpx;
  color: var(--text-primary);
}

.category-option.active .category-option-name {
  color: var(--primary);
  font-weight: 500;
}

.modal-actions {
  display: flex;
  flex-direction: row;
  gap: 20rpx;
  margin-top: 32rpx;
}

.modal-btn {
  flex: 1;
  padding: 22rpx 0;
  border-radius: var(--radius);
  display: flex;
  align-items: center;
  justify-content: center;
}

.modal-btn.cancel {
  background: var(--bg);
  border: 2rpx solid var(--border);
}

.modal-btn.confirm {
  background: var(--primary);
}

.cancel-text {
  color: var(--text-secondary);
  font-size: 28rpx;
  font-weight: 500;
}

.confirm-text {
  color: #fff;
  font-size: 28rpx;
  font-weight: 600;
}
</style>
