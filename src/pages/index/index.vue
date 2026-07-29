<template>
  <view class="page">
    <!-- Custom Navigation Bar -->
    <view class="nav-bar" :style="{ paddingTop: statusBarHeight + 'px' }">
      <view class="nav-bar-inner">
        <view class="ledger-switcher" @tap="toggleLedgerPicker">
          <text class="ledger-name">{{ ledgerStore.current?.name || '账本' }}</text>
          <text class="arrow-down">&#9662;</text>
        </view>
      </view>
    </view>

    <!-- Spacer for fixed nav -->
    <view :style="{ height: (statusBarHeight + 44) + 'px' }"></view>

    <!-- Scrollable Content -->
    <scroll-view
      scroll-y
      class="scroll-area"
      refresher-enabled
      :refresher-triggered="isRefreshing"
      @refresherrefresh="onRefresh"
    >
      <!-- Monthly Summary Card -->
      <view class="summary-card card">
        <view class="summary-month">
          <text class="summary-month-text">{{ currentYear }}年{{ currentMonth + 1 }}月</text>
        </view>
        <view class="summary-row">
          <view class="summary-item">
            <text class="summary-label">支出</text>
            <text class="summary-value text-expense">{{ formatAmount(monthExpense) }}</text>
          </view>
          <view class="summary-divider"></view>
          <view class="summary-item">
            <text class="summary-label">收入</text>
            <text class="summary-value text-income">{{ formatAmount(monthIncome) }}</text>
          </view>
          <view class="summary-divider"></view>
          <view class="summary-item">
            <text class="summary-label">结余</text>
            <text class="summary-value">{{ formatAmount(monthIncome - monthExpense) }}</text>
          </view>
        </view>
      </view>

      <!-- AI Quick Actions -->
      <view class="ai-bar card" @tap="goAiInsights">
        <view class="ai-bar-left">
          <text class="ai-bar-icon">🤖</text>
          <view class="ai-bar-text">
            <text class="ai-bar-title">AI 消费洞察</text>
            <text class="ai-bar-desc">查看智能分析报告</text>
          </view>
        </view>
        <text class="ai-bar-arrow">›</text>
      </view>

      <!-- Transaction List -->
      <view v-if="groupedTransactions.length > 0" class="tx-list">
        <view v-for="group in groupedTransactions" :key="group.date" class="tx-group">
          <!-- Group Header -->
          <view class="tx-group-header">
            <text class="tx-group-date">{{ group.dateLabel }}</text>
            <view class="tx-group-totals">
              <text v-if="group.expense > 0" class="tx-group-total text-expense">支出 {{ formatAmount(group.expense) }}</text>
              <text v-if="group.income > 0" class="tx-group-total text-income">收入 {{ formatAmount(group.income) }}</text>
            </view>
          </view>
          <!-- Transactions -->
          <view class="tx-group-body card">
            <view
              v-for="tx in group.items"
              :key="tx.id"
              class="list-item"
              @longpress="onDeleteTx(tx.id)"
            >
              <view class="list-icon">
                <text>{{ getCategoryIcon(tx.categoryId) }}</text>
              </view>
              <view class="list-content">
                <text class="list-title">{{ getCategoryName(tx.categoryId) }}</text>
                <text v-if="tx.note" class="list-subtitle">{{ tx.note }}</text>
              </view>
              <text
                class="list-amount"
                :class="tx.type === 'expense' ? 'text-expense' : tx.type === 'income' ? 'text-income' : 'text-transfer'"
              >
                {{ tx.type === 'expense' ? '-' : tx.type === 'income' ? '+' : '' }}{{ formatAmount(tx.amount) }}
              </text>
            </view>
          </view>
        </view>
      </view>

      <!-- Empty State -->
      <view v-else class="empty-state">
        <text class="empty-icon">📝</text>
        <text class="empty-text">暂无记录</text>
        <text class="empty-hint">点击下方按钮开始记账</text>
      </view>

      <!-- Bottom padding for FAB -->
      <view style="height: 160rpx;"></view>
    </scroll-view>

    <!-- Floating Add Button -->
    <view class="fab" @tap="goAdd">
      <text class="fab-icon">+</text>
    </view>

    <!-- Floating AI Chat Button -->
    <view class="fab-ai" @tap="goAiChat">
      <text class="fab-ai-icon">🤖</text>
    </view>

    <!-- Ledger Picker Popup -->
    <view v-if="showLedgerPicker" class="overlay" @tap="toggleLedgerPicker">
      <view class="ledger-picker" @tap.stop>
        <view class="ledger-picker-title">切换账本</view>
        <view
          v-for="ledger in ledgerStore.ledgers"
          :key="ledger.id"
          class="ledger-option"
          :class="{ active: ledger.id === ledgerStore.currentId }"
          @tap="onSwitchLedger(ledger.id)"
        >
          <text class="ledger-option-name">{{ ledger.name }}</text>
          <text v-if="ledger.id === ledgerStore.currentId" class="ledger-option-check">&#10003;</text>
        </view>
      </view>
    </view>

    <VoiceCommander />
  </view>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import VoiceCommander from '../../components/VoiceCommander.vue'
import { useTransactionStore, useCategoryStore, useLedgerStore, useAccountStore } from '../../stores'
import { getDateLabel, formatAmount } from '../../utils/format'

const txStore = useTransactionStore()
const catStore = useCategoryStore()
const ledgerStore = useLedgerStore()
const accountStore = useAccountStore()

// Status bar height for custom nav
const statusBarHeight = ref(0)
const isRefreshing = ref(false)
const showLedgerPicker = ref(false)

// Current month
const now = new Date()
const currentYear = ref(now.getFullYear())
const currentMonth = ref(now.getMonth())

// Get status bar height
uni.getSystemInfo({
  success(res) {
    statusBarHeight.value = res.statusBarHeight || 0
  }
})

// Monthly totals
const monthExpense = computed(() =>
  txStore.monthlyTotal(currentYear.value, currentMonth.value, 'expense', ledgerStore.currentId)
)

const monthIncome = computed(() =>
  txStore.monthlyTotal(currentYear.value, currentMonth.value, 'income', ledgerStore.currentId)
)

// Get current month's transactions grouped by date
interface DateGroup {
  date: string
  dateLabel: string
  expense: number
  income: number
  items: typeof txStore.transactions
}

const groupedTransactions = computed<DateGroup[]>(() => {
  const start = new Date(currentYear.value, currentMonth.value, 1)
  const end = new Date(currentYear.value, currentMonth.value + 1, 0, 23, 59, 59, 999)
  const txs = txStore.getInRange(start, end, ledgerStore.currentId)

  // Sort by happenedAt descending
  txs.sort((a, b) => new Date(b.happenedAt).getTime() - new Date(a.happenedAt).getTime())

  // Group by date
  const map = new Map<string, typeof txs>()
  for (const tx of txs) {
    const dateKey = tx.happenedAt.slice(0, 10)
    if (!map.has(dateKey)) map.set(dateKey, [])
    map.get(dateKey)!.push(tx)
  }

  const groups: DateGroup[] = []
  for (const [date, items] of map.entries()) {
    const expense = items
      .filter(t => t.type === 'expense' && !t.excludeFromStats)
      .reduce((s, t) => s + t.amount, 0)
    const income = items
      .filter(t => t.type === 'income' && !t.excludeFromStats)
      .reduce((s, t) => s + t.amount, 0)
    groups.push({
      date,
      dateLabel: getDateLabel(date),
      expense,
      income,
      items
    })
  }

  // Sort groups by date descending
  groups.sort((a, b) => b.date.localeCompare(a.date))
  return groups
})

// Helpers
function getCategoryIcon(categoryId: string): string {
  return catStore.getById(categoryId)?.icon || '📦'
}

function getCategoryName(categoryId: string): string {
  return catStore.getById(categoryId)?.name || '未分类'
}

// Navigation
function goAdd() {
  uni.navigateTo({ url: '/pages/add/add' })
}

function goAiChat() {
  uni.navigateTo({ url: '/pages/ai/chat' })
}

function goAiInsights() {
  uni.navigateTo({ url: '/pages/ai/insights' })
}

// Ledger picker
function toggleLedgerPicker() {
  showLedgerPicker.value = !showLedgerPicker.value
}

function onSwitchLedger(id: string) {
  ledgerStore.switchLedger(id)
  showLedgerPicker.value = false
}

// Delete transaction
function onDeleteTx(id: string) {
  uni.showModal({
    title: '提示',
    content: '确定删除这条记录吗？',
    success(res) {
      if (res.confirm) {
        txStore.remove(id)
      }
    }
  })
}

// Pull-down refresh
function onRefresh() {
  isRefreshing.value = true
  txStore.reload()
  setTimeout(() => {
    isRefreshing.value = false
  }, 500)
}
</script>

<style scoped>
.page {
  min-height: 100vh;
  background: var(--bg);
}

/* Navigation Bar */
.nav-bar {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  z-index: 100;
  background: var(--card);
  box-shadow: 0 2rpx 12rpx var(--shadow);
}

.nav-bar-inner {
  height: 88rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0 24rpx;
}

.ledger-switcher {
  display: flex;
  align-items: center;
  padding: 8rpx 20rpx;
  border-radius: 40rpx;
  background: var(--bg);
}

.ledger-name {
  font-size: 30rpx;
  font-weight: 600;
  color: var(--text-primary);
  margin-right: 8rpx;
}

.arrow-down {
  font-size: 22rpx;
  color: var(--text-secondary);
}

/* Scroll Area */
.scroll-area {
  height: 100vh;
  padding: 24rpx;
  box-sizing: border-box;
}

/* Summary Card */
.summary-card {
  background: linear-gradient(135deg, var(--primary), var(--primary-dark));
  border-radius: var(--radius-lg);
  padding: 36rpx 32rpx;
  margin-bottom: 32rpx;
  box-shadow: 0 8rpx 24rpx rgba(79, 110, 247, 0.25);
}

.summary-month {
  margin-bottom: 24rpx;
}

.summary-month-text {
  font-size: 26rpx;
  color: rgba(255, 255, 255, 0.8);
  font-weight: 500;
}

.summary-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.summary-item {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.summary-label {
  font-size: 24rpx;
  color: rgba(255, 255, 255, 0.7);
  margin-bottom: 8rpx;
}

.summary-value {
  font-size: 36rpx;
  font-weight: 700;
  color: #ffffff;
  letter-spacing: -0.5rpx;
}

.summary-divider {
  width: 1rpx;
  height: 60rpx;
  background: rgba(255, 255, 255, 0.2);
}

/* Transaction List */
.tx-list {
  padding-bottom: 24rpx;
}

.tx-group {
  margin-bottom: 24rpx;
}

.tx-group-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16rpx 8rpx;
}

.tx-group-date {
  font-size: 26rpx;
  font-weight: 600;
  color: var(--text-primary);
}

.tx-group-totals {
  display: flex;
  align-items: center;
  gap: 20rpx;
}

.tx-group-total {
  font-size: 22rpx;
  font-weight: 500;
}

.tx-group-body {
  margin-bottom: 0;
}

/* Override list-item last-child border */
.tx-group-body .list-item:last-child {
  border-bottom: none;
}

/* Floating Action Button */
.fab {
  position: fixed;
  right: 40rpx;
  bottom: 200rpx;
  width: 112rpx;
  height: 112rpx;
  border-radius: 50%;
  background: var(--primary);
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 8rpx 28rpx rgba(79, 110, 247, 0.4);
  z-index: 90;
}

.fab:active {
  transform: scale(0.92);
}

.fab-icon {
  font-size: 56rpx;
  color: #ffffff;
  font-weight: 300;
  line-height: 1;
  margin-top: -4rpx;
}

/* AI FAB */
.fab-ai {
  position: fixed;
  right: 40rpx;
  bottom: 340rpx;
  width: 96rpx;
  height: 96rpx;
  border-radius: 50%;
  background: linear-gradient(135deg, #667eea, #764ba2);
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 8rpx 28rpx rgba(102, 126, 234, 0.4);
  z-index: 90;
}

.fab-ai:active {
  transform: scale(0.92);
}

.fab-ai-icon {
  font-size: 44rpx;
}

/* AI Quick Bar */
.ai-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: linear-gradient(135deg, #667eea22, #764ba222);
  border: 2rpx solid #667eea33;
}

.ai-bar:active {
  opacity: 0.85;
}

.ai-bar-left {
  display: flex;
  align-items: center;
}

.ai-bar-icon {
  font-size: 48rpx;
  margin-right: 20rpx;
}

.ai-bar-text {
  display: flex;
  flex-direction: column;
}

.ai-bar-title {
  font-size: 28rpx;
  font-weight: 600;
  color: var(--text-primary);
}

.ai-bar-desc {
  font-size: 22rpx;
  color: var(--text-secondary);
  margin-top: 4rpx;
}

.ai-bar-arrow {
  font-size: 36rpx;
  color: var(--text-tertiary);
}

/* Empty State */
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 120rpx 40rpx;
}

.empty-icon {
  font-size: 120rpx;
  margin-bottom: 20rpx;
}

.empty-text {
  font-size: 30rpx;
  color: var(--text-tertiary);
  margin-bottom: 8rpx;
}

.empty-hint {
  font-size: 24rpx;
  color: var(--text-tertiary);
}

/* Ledger Picker Overlay */
.overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.4);
  z-index: 200;
  display: flex;
  align-items: flex-start;
  justify-content: center;
  padding-top: 200rpx;
}

.ledger-picker {
  background: var(--card);
  border-radius: var(--radius-lg);
  padding: 32rpx;
  width: 560rpx;
  box-shadow: 0 16rpx 48rpx rgba(0, 0, 0, 0.15);
}

.ledger-picker-title {
  font-size: 32rpx;
  font-weight: 600;
  color: var(--text-primary);
  margin-bottom: 24rpx;
  text-align: center;
}

.ledger-option {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 24rpx 16rpx;
  border-radius: var(--radius);
  margin-bottom: 8rpx;
}

.ledger-option:active {
  background: var(--bg);
}

.ledger-option.active {
  background: var(--primary-light);
}

.ledger-option-name {
  font-size: 30rpx;
  color: var(--text-primary);
}

.ledger-option-check {
  font-size: 30rpx;
  color: var(--primary);
  font-weight: 600;
}
</style>
