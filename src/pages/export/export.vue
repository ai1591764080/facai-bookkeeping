<script setup lang="ts">
import { ref, computed, onMounted } from 'vue' // Vue 响应式与生命周期：ref/computed 响应式，onMounted 组件挂载后触发
import {
  useTransactionStore,
  useCategoryStore,
  useAccountStore,
  useLedgerStore,
  useBudgetStore,
  useScanStore,
} from '../../stores' // 交易/分类/账户/账本/预算/扫描状态仓库
import type { Transaction } from '../../types' // 交易记录的类型定义
import {
  collectBackup,
  validateBackup,
  applyBackup,
  backupSummary,
  backupFileName,
  saveTextFile,
  pickTextFile,
  type BackupFile,
} from '../../utils/backup' // 备份与恢复：全量导出、格式校验、写入恢复及跨平台文件存取

const transactionStore = useTransactionStore()
const categoryStore = useCategoryStore()
const accountStore = useAccountStore()
const ledgerStore = useLedgerStore()
const budgetStore = useBudgetStore()
const scanStore = useScanStore()

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

// ---------- 备份与恢复 ----------
// 数据全部存在设备本地，清理缓存或换设备会丢失，因此提供完整备份与恢复能力
const importMode = ref<'replace' | 'merge'>('replace')
const stats = ref<{ key: string; label: string; count: number }[]>([])
const pending = ref<BackupFile | null>(null)

function refreshStats() {
  stats.value = backupSummary(collectBackup().data)
}

/** 导出全量备份文件（不受上方日期范围影响） */
async function onBackup() {
  try {
    const file = collectBackup()
    const total = backupSummary(file.data).reduce((a, b) => a + b.count, 0)
    if (total === 0) {
      uni.showToast({ title: '当前没有可备份的数据', icon: 'none' })
      return
    }
    await saveTextFile(JSON.stringify(file, null, 2), backupFileName())
    uni.showToast({ title: `已备份 ${total} 条数据`, icon: 'success', duration: 2500 })
  } catch (e: any) {
    uni.showToast({ title: e?.message || '备份失败', icon: 'none', duration: 2500 })
  }
}

/** 选择备份文件并解析校验 */
async function onPickFile() {
  let text = ''
  try {
    text = await pickTextFile()
  } catch (e: any) {
    const msg = e?.message || ''
    // 用户主动取消时不提示错误
    if (msg === '未选择文件' || msg === '已取消') return
    uni.showToast({ title: msg || '读取文件失败', icon: 'none', duration: 2500 })
    return
  }

  let raw: unknown
  try {
    raw = JSON.parse(text)
  } catch (e) {
    uni.showToast({ title: '文件不是有效的 JSON 格式', icon: 'none', duration: 2500 })
    return
  }

  const result = validateBackup(raw)
  if (!result.ok) {
    uni.showToast({ title: result.msg, icon: 'none', duration: 3000 })
    return
  }

  pending.value = result.file
  const list = backupSummary(result.file.data).filter((x) => x.count > 0)
  const detail = list.length ? list.map((x) => `${x.label} ${x.count}`).join('、') : '无数据'
  const modeText = importMode.value === 'replace' ? '覆盖' : '合并'

  const warn =
    importMode.value === 'replace' ? '\n\n⚠️ 覆盖导入会清空当前所有数据，且无法撤销' : ''

  uni.showModal({
    title: `确认${modeText}导入？`,
    content: `备份内容：${detail}\n\n导入方式：${modeText}导入${warn}`,
    confirmText: '确认导入',
    cancelText: '取消',
    success: (r) => {
      if (r.confirm) doImport()
    },
  })
}

/** 执行导入并刷新全部内存数据 */
function doImport() {
  const file = pending.value
  if (!file) return

  try {
    const r = applyBackup(file, importMode.value)
    // 写入存储后同步刷新各 store，保证页面立即展示新数据
    transactionStore.reload()
    categoryStore.reload()
    accountStore.reload()
    ledgerStore.reload()
    budgetStore.reload()
    scanStore.reload()

    pending.value = null
    refreshStats()
    uni.showModal({
      title: '导入成功',
      content: `已导入 ${r.total} 条数据，页面数据已刷新`,
      showCancel: false,
    })
  } catch (e) {
    uni.showModal({
      title: '导入失败',
      content: '写入本地存储时出错，请重试或检查存储空间',
      showCancel: false,
    })
  }
}

onMounted(() => {
  refreshStats()
})
</script>

<template>
  <view class="export-page">
    <!-- 数据备份与恢复 -->
    <view class="section">
      <text class="section-label">💾 数据备份与恢复</text>
      <text class="backup-tip">数据仅保存在本机，清理缓存或更换设备会丢失。建议定期导出备份文件自行保存。</text>

      <view class="card stat-card">
        <view class="stat-grid">
          <view class="stat-item" v-for="s in stats" :key="s.key">
            <text class="stat-num">{{ s.count }}</text>
            <text class="stat-label">{{ s.label }}</text>
          </view>
        </view>
      </view>

      <view class="backup-actions">
        <view class="backup-btn primary" @tap="onBackup">
          <text class="backup-btn-text">📤 导出备份</text>
        </view>
        <view class="backup-btn" @tap="onPickFile">
          <text class="backup-btn-text">📥 导入恢复</text>
        </view>
      </view>

      <view class="mode-row">
        <text class="mode-label">导入方式</text>
        <view class="mode-options">
          <view
            class="mode-option"
            :class="{ active: importMode === 'replace' }"
            @tap="importMode = 'replace'"
          >
            <text class="mode-text">覆盖导入</text>
          </view>
          <view
            class="mode-option"
            :class="{ active: importMode === 'merge' }"
            @tap="importMode = 'merge'"
          >
            <text class="mode-text">合并导入</text>
          </view>
        </view>
      </view>
      <text class="mode-hint">
        {{ importMode === 'replace' ? '覆盖：清空现有数据，完全替换为备份内容' : '合并：保留现有数据，备份中相同 ID 的记录覆盖本地' }}
      </text>
    </view>

    <!-- Export type -->
    <view class="section">
      <text class="section-label">导出为文件</text>
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

.backup-tip {
  font-size: 22rpx;
  color: var(--text-tertiary);
  line-height: 1.7;
  margin-bottom: 16rpx;
  display: block;
}

.stat-card {
  padding: 20rpx 16rpx;
}

.stat-grid {
  display: flex;
  flex-direction: row;
  flex-wrap: wrap;
}

.stat-item {
  width: 25%;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 12rpx 0;
}

.stat-num {
  font-size: 32rpx;
  font-weight: 700;
  color: var(--primary);
}

.stat-label {
  font-size: 22rpx;
  color: var(--text-secondary);
  margin-top: 4rpx;
}

.backup-actions {
  display: flex;
  flex-direction: row;
  gap: 16rpx;
  margin-top: 16rpx;
}

.backup-btn {
  flex: 1;
  padding: 24rpx 0;
  border-radius: var(--radius);
  background: var(--card);
  border: 2rpx solid var(--border);
  display: flex;
  align-items: center;
  justify-content: center;
}

.backup-btn.primary {
  background: var(--primary);
  border-color: var(--primary);
}

.backup-btn.primary .backup-btn-text {
  color: #fff;
}

.backup-btn-text {
  font-size: 28rpx;
  font-weight: 600;
  color: var(--text-primary);
}

.mode-row {
  display: flex;
  flex-direction: row;
  align-items: center;
  margin-top: 24rpx;
}

.mode-label {
  font-size: 26rpx;
  color: var(--text-secondary);
  margin-right: 16rpx;
}

.mode-options {
  display: flex;
  flex-direction: row;
  gap: 12rpx;
  flex: 1;
}

.mode-option {
  flex: 1;
  padding: 14rpx 0;
  text-align: center;
  border-radius: 12rpx;
  background: var(--card);
  border: 2rpx solid var(--border);
}

.mode-option.active {
  border-color: var(--primary);
  background: var(--primary-light);
}

.mode-text {
  font-size: 24rpx;
  color: var(--text-secondary);
}

.mode-option.active .mode-text {
  color: var(--primary);
  font-weight: 600;
}

.mode-hint {
  font-size: 22rpx;
  color: var(--text-tertiary);
  margin-top: 12rpx;
  display: block;
  line-height: 1.6;
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
