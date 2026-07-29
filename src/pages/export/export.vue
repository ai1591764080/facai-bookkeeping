<script setup lang="ts">
import { ref, computed } from 'vue'
import { useTransactionStore, useCategoryStore, useAccountStore, useLedgerStore } from '../../stores'
import type { Transaction } from '../../types'

const transactionStore = useTransactionStore()
const categoryStore = useCategoryStore()
const accountStore = useAccountStore()
const ledgerStore = useLedgerStore()

// Date range
const now = new Date()
const startDate = ref(formatDateStr(new Date(now.getFullYear(), now.getMonth(), 1)))
const endDate = ref(formatDateStr(now))

const exportType = ref<'csv' | 'json'>('csv')

function formatDateStr(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function onStartDateChange(e: any) {
  startDate.value = e.detail.value
}

function onEndDateChange(e: any) {
  endDate.value = e.detail.value
}

// Filter transactions in range
const filteredTransactions = computed(() => {
  const start = new Date(startDate.value + 'T00:00:00')
  const end = new Date(endDate.value + 'T23:59:59')
  return transactionStore.getInRange(start, end, ledgerStore.currentId)
})

const recordCount = computed(() => filteredTransactions.value.length)

const typeLabels: Record<string, string> = {
  expense: '支出',
  income: '收入',
  transfer: '转账',
}

function getCategoryName(id: string): string {
  const cat = categoryStore.getById(id)
  return cat?.name || '未分类'
}

function getAccountName(id: string): string {
  const acc = accountStore.getById(id)
  return acc?.name || '未知账户'
}

function formatDate(iso: string): string {
  const d = new Date(iso)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

// Generate CSV
function generateCSV(): string {
  const header = '日期,类型,分类,金额,账户,备注'
  const rows = filteredTransactions.value.map(t => {
    const date = formatDate(t.happenedAt)
    const type = typeLabels[t.type] || t.type
    const category = getCategoryName(t.categoryId)
    const amount = t.amount.toFixed(2)
    const account = getAccountName(t.accountId)
    const note = (t.note || '').replace(/,/g, '，').replace(/\n/g, ' ')
    return `${date},${type},${category},${amount},${account},${note}`
  })
  return [header, ...rows].join('\n')
}

// Generate JSON backup
function generateJSON(): string {
  return JSON.stringify({
    exportDate: new Date().toISOString(),
    ledger: ledgerStore.current,
    transactions: filteredTransactions.value,
    categories: categoryStore.categories,
    accounts: accountStore.accounts,
  }, null, 2)
}

function onExport() {
  if (recordCount.value === 0) {
    uni.showToast({ title: '所选范围内无数据', icon: 'none' })
    return
  }

  let content: string
  let fileName: string

  if (exportType.value === 'csv') {
    content = generateCSV()
    fileName = `发财记账_${startDate.value}_${endDate.value}.csv`
  } else {
    content = generateJSON()
    fileName = `发财记账_备份_${formatDateStr(new Date())}.json`
  }

  // Write to temp file and share
  const filePath = `${uni.env.USER_DATA_PATH || '/tmp'}/${fileName}`

  try {
    // #ifdef MP-WEIXIN
    const fs = wx.getFileSystemManager()
    fs.writeFile({
      filePath,
      data: content,
      encoding: 'utf8',
      success() {
        wx.shareFileMessage({
          filePath,
          fileName,
          success() {},
          fail() {
            uni.showToast({ title: '分享失败', icon: 'none' })
          }
        })
      },
      fail() {
        // Fallback: copy to clipboard
        uni.setClipboardData({
          data: content,
          success() {
            uni.showToast({ title: '已复制到剪贴板', icon: 'success' })
          }
        })
      }
    })
    // #endif

    // #ifdef H5
    const blob = new Blob([content], { type: exportType.value === 'csv' ? 'text/csv;charset=utf-8' : 'application/json;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = fileName
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
    uni.showToast({ title: '导出成功', icon: 'success' })
    // #endif

    // #ifdef APP-PLUS
    uni.setClipboardData({
      data: content,
      success() {
        uni.showToast({ title: '已复制到剪贴板', icon: 'success' })
      }
    })
    // #endif
  } catch (e) {
    // Fallback: copy to clipboard
    uni.setClipboardData({
      data: content,
      success() {
        uni.showToast({ title: '已复制到剪贴板', icon: 'success' })
      },
      fail() {
        uni.showToast({ title: '导出失败', icon: 'none' })
      }
    })
  }
}

// Preview data
const showPreview = ref(false)

function togglePreview() {
  showPreview.value = !showPreview.value
}
</script>

<template>
  <view class="export-page">
    <!-- Export type -->
    <view class="section">
      <text class="section-label">导出格式</text>
      <view class="type-row">
        <view
          class="type-option"
          :class="{ active: exportType === 'csv' }"
          @tap="exportType = 'csv'"
        >
          <text class="type-icon">📊</text>
          <text class="type-name">CSV</text>
          <text class="type-desc">表格文件，可用Excel打开</text>
        </view>
        <view
          class="type-option"
          :class="{ active: exportType === 'json' }"
          @tap="exportType = 'json'"
        >
          <text class="type-icon">📋</text>
          <text class="type-name">JSON</text>
          <text class="type-desc">完整备份，含所有数据</text>
        </view>
      </view>
    </view>

    <!-- Date range -->
    <view class="section">
      <text class="section-label">日期范围</text>
      <view class="date-row">
        <picker mode="date" :value="startDate" @change="onStartDateChange">
          <view class="date-picker">
            <text class="date-text">{{ startDate }}</text>
            <text class="date-arrow">▼</text>
          </view>
        </picker>
        <text class="date-separator">至</text>
        <picker mode="date" :value="endDate" @change="onEndDateChange">
          <view class="date-picker">
            <text class="date-text">{{ endDate }}</text>
            <text class="date-arrow">▼</text>
          </view>
        </picker>
      </view>
    </view>

    <!-- Record count -->
    <view class="card preview-card">
      <view class="preview-row">
        <view class="preview-info">
          <text class="preview-label">当前账本</text>
          <text class="preview-value">{{ ledgerStore.current?.name || '未选择' }}</text>
        </view>
        <view class="preview-count-area">
          <text class="preview-count">{{ recordCount }}</text>
          <text class="preview-unit">条记录</text>
        </view>
      </view>
      <view class="preview-toggle" @tap="togglePreview">
        <text class="preview-toggle-text">{{ showPreview ? '收起预览' : '展开预览' }}</text>
      </view>

      <!-- Preview list -->
      <scroll-view v-if="showPreview" scroll-y class="preview-list">
        <view
          v-for="txn in filteredTransactions.slice(0, 20)"
          :key="txn.id"
          class="preview-item"
        >
          <text class="preview-date">{{ formatDate(txn.happenedAt) }}</text>
          <text class="preview-cat">{{ getCategoryName(txn.categoryId) }}</text>
          <text class="preview-amount" :class="txn.type">{{ txn.amount.toFixed(2) }}</text>
        </view>
        <view v-if="recordCount > 20" class="preview-more">
          <text class="preview-more-text">... 还有 {{ recordCount - 20 }} 条记录</text>
        </view>
        <view v-if="recordCount === 0" class="preview-empty">
          <text class="preview-empty-text">所选日期范围内无记录</text>
        </view>
      </scroll-view>
    </view>

    <!-- Export button -->
    <view class="export-area">
      <view class="export-btn" @tap="onExport">
        <text class="export-btn-text">导出 {{ recordCount }} 条记录</text>
      </view>
    </view>

    <!-- Info -->
    <view class="info-area">
      <text class="info-text">CSV格式包含: 日期、类型、分类、金额、账户、备注</text>
      <text class="info-text">JSON格式包含: 账本、交易记录、分类、账户完整数据</text>
    </view>
  </view>
</template>

<style scoped>
.export-page {
  min-height: 100vh;
  background: var(--bg);
  padding: 24rpx;
  padding-bottom: 140rpx;
}

.section {
  margin-bottom: 28rpx;
}

.section-label {
  font-size: 28rpx;
  font-weight: 600;
  color: var(--text-primary);
  margin-bottom: 16rpx;
  display: block;
}

.type-row {
  display: flex;
  flex-direction: row;
  gap: 16rpx;
}

.type-option {
  flex: 1;
  padding: 28rpx 20rpx;
  border-radius: var(--radius);
  background: var(--card);
  border: 2rpx solid var(--border);
  display: flex;
  flex-direction: column;
  align-items: center;
}

.type-option.active {
  border-color: var(--primary);
  background: var(--primary-light);
}

.type-icon {
  font-size: 48rpx;
  margin-bottom: 12rpx;
}

.type-name {
  font-size: 30rpx;
  font-weight: 600;
  color: var(--text-primary);
  margin-bottom: 6rpx;
}

.type-option.active .type-name {
  color: var(--primary);
}

.type-desc {
  font-size: 22rpx;
  color: var(--text-tertiary);
  text-align: center;
}

.date-row {
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: 16rpx;
}

.date-picker {
  flex: 1;
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: space-between;
  background: var(--card);
  border-radius: var(--radius);
  padding: 20rpx 24rpx;
  border: 2rpx solid var(--border);
}

.date-text {
  font-size: 28rpx;
  color: var(--text-primary);
}

.date-arrow {
  font-size: 20rpx;
  color: var(--text-tertiary);
  margin-left: 8rpx;
}

.date-separator {
  font-size: 26rpx;
  color: var(--text-secondary);
}

.preview-card {
  padding: 28rpx;
}

.preview-row {
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 16rpx;
}

.preview-info {
  display: flex;
  flex-direction: column;
}

.preview-label {
  font-size: 24rpx;
  color: var(--text-secondary);
}

.preview-value {
  font-size: 28rpx;
  color: var(--text-primary);
  font-weight: 500;
  margin-top: 4rpx;
}

.preview-count-area {
  display: flex;
  flex-direction: row;
  align-items: baseline;
}

.preview-count {
  font-size: 48rpx;
  font-weight: 700;
  color: var(--primary);
}

.preview-unit {
  font-size: 24rpx;
  color: var(--text-secondary);
  margin-left: 8rpx;
}

.preview-toggle {
  padding: 16rpx 0 8rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  border-top: 1rpx solid var(--border);
}

.preview-toggle-text {
  font-size: 24rpx;
  color: var(--primary);
  font-weight: 500;
}

.preview-list {
  max-height: 400rpx;
  margin-top: 12rpx;
}

.preview-item {
  display: flex;
  flex-direction: row;
  align-items: center;
  padding: 14rpx 0;
  border-bottom: 1rpx solid var(--border);
}

.preview-item:last-child {
  border-bottom: none;
}

.preview-date {
  font-size: 24rpx;
  color: var(--text-secondary);
  width: 160rpx;
}

.preview-cat {
  font-size: 24rpx;
  color: var(--text-primary);
  flex: 1;
}

.preview-amount {
  font-size: 26rpx;
  font-weight: 600;
  min-width: 140rpx;
  text-align: right;
}

.preview-amount.expense {
  color: var(--expense);
}

.preview-amount.income {
  color: var(--income);
}

.preview-amount.transfer {
  color: var(--transfer);
}

.preview-more {
  padding: 16rpx 0;
  display: flex;
  align-items: center;
  justify-content: center;
}

.preview-more-text {
  font-size: 22rpx;
  color: var(--text-tertiary);
}

.preview-empty {
  padding: 24rpx 0;
  display: flex;
  align-items: center;
  justify-content: center;
}

.preview-empty-text {
  font-size: 24rpx;
  color: var(--text-tertiary);
}

.export-area {
  margin-top: 32rpx;
}

.export-btn {
  background: var(--primary);
  border-radius: var(--radius);
  padding: 30rpx 0;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 8rpx 24rpx rgba(79, 110, 247, 0.3);
}

.export-btn-text {
  color: #fff;
  font-size: 32rpx;
  font-weight: 600;
}

.info-area {
  margin-top: 32rpx;
  padding: 0 8rpx;
}

.info-text {
  font-size: 22rpx;
  color: var(--text-tertiary);
  line-height: 1.8;
  display: block;
}
</style>
