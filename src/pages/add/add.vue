<template>
  <view class="page">
    <!-- Custom Navigation Bar -->
    <view class="nav-bar" :style="{ paddingTop: statusBarHeight + 'px' }">
      <view class="nav-bar-inner">
        <view class="nav-back" @tap="goBack">
          <text class="nav-back-icon">&#10094;</text>
        </view>
        <text class="nav-title">记一笔</text>
        <view class="nav-placeholder"></view>
      </view>
    </view>

    <!-- Spacer for fixed nav -->
    <view :style="{ height: (statusBarHeight + 44) + 'px' }"></view>

    <!-- AI Quick Input Bar -->
    <view class="ai-input-bar">
      <view class="ai-mic-btn" :class="{ recording: isRecording }" @tap="toggleVoice">
        <text v-if="isRecording" class="ai-mic-icon recording">🔴</text>
        <text v-else class="ai-mic-icon">🎙️</text>
      </view>
      <input
        class="ai-input"
        v-model="aiText"
        placeholder="说一笔消费，如：午饭花了30块"
        :confirm-type="'send'"
        @confirm="onAiParse"
      />
      <view class="ai-send-btn" :class="{ disabled: !aiText.trim() || aiParsing }" @tap="onAiParse">
        <text v-if="aiParsing" class="ai-loading">...</text>
        <text v-else class="ai-send-text">识别</text>
      </view>
    </view>

    <!-- Scan Receipt Entry -->
    <view class="scan-entry" @tap="goScan">
      <text class="scan-entry-icon">📷</text>
      <text class="scan-entry-text">扫描小票 / 账单，AI 智能归档</text>
      <text class="scan-entry-arrow">›</text>
    </view>

    <!-- Voice Recording Overlay -->
    <view v-if="isRecording" class="voice-overlay">
      <view class="voice-panel">
        <view class="voice-waves">
          <view class="voice-wave" /><view class="voice-wave" /><view class="voice-wave" />
          <view class="voice-wave" /><view class="voice-wave" />
        </view>
        <text class="voice-text">{{ voiceInterimText || '正在聆听...' }}</text>
        <text class="voice-hint">说出消费内容，如"午饭花了30块"</text>
        <view class="voice-stop-btn" @tap="stopVoiceInput">
          <text class="voice-stop-text">完成</text>
        </view>
      </view>
    </view>

    <!-- AI Parse Result -->
    <view v-if="aiResult" class="ai-result-bar card">
      <view class="ai-result-row">
        <text class="ai-result-label">AI 识别结果：</text>
        <view class="ai-result-confirm" @tap="applyAiResult">
          <text>确认填入</text>
        </view>
      </view>
      <view class="ai-result-detail">
        <text class="ai-result-tag">{{ aiResult.type === 'expense' ? '支出' : '收入' }}</text>
        <text class="ai-result-tag">{{ aiResult.categoryName }}</text>
        <text class="ai-result-amount">¥{{ aiResult.amount }}</text>
        <text class="ai-result-tag">{{ aiResult.accountName }}</text>
        <text v-if="aiResult.note" class="ai-result-note">{{ aiResult.note }}</text>
      </view>
    </view>

    <!-- Type Tabs -->
    <view class="type-tabs">
      <view
        v-for="tab in typeTabs"
        :key="tab.value"
        class="type-tab"
        :class="{ active: currentType === tab.value }"
        @tap="currentType = tab.value"
      >
        <text>{{ tab.label }}</text>
      </view>
    </view>

    <!-- Category Grid -->
    <scroll-view scroll-y class="category-scroll">
      <view class="category-grid">
        <view
          v-for="cat in currentCategories"
          :key="cat.id"
          class="category-item"
          :class="{ selected: selectedCategoryId === cat.id }"
          @tap="selectedCategoryId = cat.id"
        >
          <view class="category-icon-wrap" :class="{ selected: selectedCategoryId === cat.id }">
            <text class="category-icon">{{ cat.icon }}</text>
          </view>
          <text class="category-label" :class="{ selected: selectedCategoryId === cat.id }">{{ cat.name }}</text>
        </view>
      </view>
    </scroll-view>

    <!-- Amount Display -->
    <view class="amount-section">
      <view class="amount-row">
        <text class="amount-symbol">&#165;</text>
        <text class="amount-display" :class="{ placeholder: amountStr === '0' }">
          {{ amountStr }}
        </text>
      </view>
    </view>

    <!-- Note & Date & Account Row -->
    <view class="info-row">
      <view class="info-item note-item">
        <input
          class="note-input"
          v-model="noteStr"
          placeholder="添加备注..."
          placeholder-class="note-placeholder"
          maxlength="50"
        />
      </view>
      <picker mode="date" :value="dateStr" @change="onDateChange">
        <view class="info-item">
          <text class="info-icon">📅</text>
          <text class="info-text">{{ displayDate }}</text>
        </view>
      </picker>
      <view class="info-item" @tap="toggleAccountPicker">
        <text class="info-icon">💳</text>
        <text class="info-text">{{ selectedAccountName }}</text>
      </view>
    </view>

    <!-- Account Picker Popup -->
    <view v-if="showAccountPicker" class="overlay" @tap="toggleAccountPicker">
      <view class="account-picker" @tap.stop>
        <view class="picker-title">选择账户</view>
        <view
          v-for="acc in accountStore.visibleAccounts"
          :key="acc.id"
          class="account-option"
          :class="{ active: selectedAccountId === acc.id }"
          @tap="onSelectAccount(acc.id)"
        >
          <text class="account-option-icon">{{ acc.icon }}</text>
          <text class="account-option-name">{{ acc.name }}</text>
          <text v-if="selectedAccountId === acc.id" class="account-option-check">&#10003;</text>
        </view>
      </view>
    </view>

    <!-- Numeric Keypad -->
    <view class="keypad-wrapper">
      <view class="keypad">
        <button
          v-for="key in keypadKeys"
          :key="key"
          class="keypad-btn"
          :class="{
            'confirm': key === 'OK',
            'func': key === 'back'
          }"
          @tap="onKeypadPress(key)"
        >
          <text v-if="key === 'back'" class="keypad-back-icon">&#9003;</text>
          <text v-else-if="key === 'OK'" class="keypad-confirm-text">确定</text>
          <text v-else>{{ key }}</text>
        </button>
      </view>
    </view>

    <VoiceCommander />
  </view>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue' // Vue 响应式与侦听器：ref/computed 响应式，watch 监听变化
import VoiceCommander from '../../components/VoiceCommander.vue' // 语音记账组件
import { useTransactionStore, useCategoryStore, useAccountStore, useLedgerStore } from '../../stores' // 交易/分类/账户/账本状态仓库
import { uuid } from '../../utils/uuid' // 生成唯一 ID
import { parseNaturalLanguage, hasApiKey } from '../../utils/ai' // 自然语言解析为记账信息、检查 API Key
import { startVoice, stopVoice, isSupported as isVoiceSupported } from '../../utils/voice' // 语音识别控制与能力检测
import type { TransactionType } from '../../types' // 交易类型（支出/收入）类型定义

const txStore = useTransactionStore()
const catStore = useCategoryStore()
const accountStore = useAccountStore()
const ledgerStore = useLedgerStore()

// Status bar height
const statusBarHeight = ref(0)
uni.getSystemInfo({
  success(res) {
    statusBarHeight.value = res.statusBarHeight || 0
  }
})

// Type tabs
const typeTabs = [
  { label: '支出', value: 'expense' as TransactionType },
  { label: '收入', value: 'income' as TransactionType },
  { label: '转账', value: 'transfer' as TransactionType }
]

const currentType = ref<TransactionType>('expense')

// Categories based on current type
const currentCategories = computed(() => {
  if (currentType.value === 'expense') return catStore.expenseCategories
  if (currentType.value === 'income') return catStore.incomeCategories
  // For transfer, show expense categories as fallback
  return catStore.expenseCategories
})

// Selected category - auto-select first when type changes
const selectedCategoryId = ref<string>('')

// Watch type change and reset category
watch(currentType, () => {
  const cats = currentCategories.value
  if (cats.length > 0) {
    selectedCategoryId.value = cats[0].id
  }
})

// Initialize with first expense category
if (catStore.expenseCategories.length > 0) {
  selectedCategoryId.value = catStore.expenseCategories[0].id
}

// Amount
const amountStr = ref('0')

// Note
const noteStr = ref('')

// Date
const selectedDate = ref(new Date())

const dateStr = computed(() => {
  const d = selectedDate.value
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
})

const displayDate = computed(() => {
  const d = selectedDate.value
  const m = d.getMonth() + 1
  const day = d.getDate()
  return `${m}月${day}日`
})

function onDateChange(e: any) {
  const val = e.detail.value as string
  if (val) {
    selectedDate.value = new Date(val)
  }
}

// Account
const selectedAccountId = ref(accountStore.visibleAccounts[0]?.id || '')
const showAccountPicker = ref(false)

const selectedAccountName = computed(() => {
  const acc = accountStore.getById(selectedAccountId.value)
  return acc?.name || '账户'
})

function toggleAccountPicker() {
  showAccountPicker.value = !showAccountPicker.value
}

function onSelectAccount(id: string) {
  selectedAccountId.value = id
  showAccountPicker.value = false
}

// Keypad
const keypadKeys = ['1', '2', '3', 'back', '4', '5', '6', '+', '7', '8', '9', '-', '.', '0', '00', 'OK']

function onKeypadPress(key: string) {
  if (key === 'back') {
    if (amountStr.value.length > 1) {
      amountStr.value = amountStr.value.slice(0, -1)
    } else {
      amountStr.value = '0'
    }
    return
  }

  if (key === 'OK') {
    confirmTransaction()
    return
  }

  if (key === '+' || key === '-') {
    // Skip arithmetic keys for simplicity
    return
  }

  // Number input logic
  if (amountStr.value === '0' && key !== '.') {
    amountStr.value = key
    return
  }

  // Prevent multiple dots
  if (key === '.' && amountStr.value.includes('.')) return

  // Limit decimal places to 2
  if (amountStr.value.includes('.')) {
    const decPart = amountStr.value.split('.')[1]
    if (decPart.length >= 2 && key !== '.') return
  }

  // Prevent leading zeros like 00, 01
  if (amountStr.value === '0' && key === '0') return
  if (amountStr.value === '0' && key === '00') return

  // Max length guard
  if (amountStr.value.replace('.', '').length >= 9) return

  amountStr.value += key
}

// Confirm / Save
function confirmTransaction() {
  const amount = Number(amountStr.value)
  if (!amount || amount <= 0) {
    uni.showToast({ title: '请输入金额', icon: 'none' })
    return
  }

  if (!selectedCategoryId.value) {
    uni.showToast({ title: '请选择分类', icon: 'none' })
    return
  }

  const tx = {
    id: uuid(),
    ledgerId: ledgerStore.currentId,
    type: currentType.value,
    amount,
    categoryId: selectedCategoryId.value,
    accountId: selectedAccountId.value,
    happenedAt: selectedDate.value.toISOString(),
    note: noteStr.value,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    excludeFromStats: false,
    excludeFromBudget: false
  }

  txStore.add(tx)
  uni.showToast({ title: '保存成功', icon: 'success' })
  setTimeout(() => {
    uni.navigateBack()
  }, 500)
}

// Navigation
function goBack() {
  uni.navigateBack()
}

// ---------- AI Natural Language Input ----------
const aiText = ref('')
const aiParsing = ref(false)
const aiResult = ref<{
  type: 'expense' | 'income' | 'transfer'
  amount: number
  categoryName: string
  accountName: string
  note: string
  date: string
} | null>(null)

function goScan() {
  uni.navigateTo({ url: '/pages/scan/scan' })
}

async function onAiParse() {
  const text = aiText.value.trim()
  if (!text || aiParsing.value) return

  if (!hasApiKey()) {
    uni.showModal({
      title: '未配置 API Key',
      content: 'AI 快捷记账需要配置DeepSeek API Key，可在"我的 > AI 设置"中配置',
      confirmText: '去设置',
      success(res) {
        if (res.confirm) uni.navigateTo({ url: '/pages/ai/settings' })
      }
    })
    return
  }

  aiParsing.value = true
  aiResult.value = null

  try {
    const result = await parseNaturalLanguage(text, catStore.categories, accountStore.accounts)
    aiResult.value = result
    uni.showToast({ title: '识别成功', icon: 'success' })
  } catch (e: any) {
    uni.showToast({ title: `识别失败: ${e.message}`, icon: 'none', duration: 3000 })
  } finally {
    aiParsing.value = false
  }
}

function applyAiResult() {
  if (!aiResult.value) return
  const r = aiResult.value

  // Set type
  currentType.value = r.type

  // Set category
  const cat = catStore.categories.find(
    (c) => c.name === r.categoryName && c.kind === r.type && c.level === 1
  )
  if (cat) {
    selectedCategoryId.value = cat.id
  }

  // Set amount
  amountStr.value = r.amount > 0 ? String(r.amount) : '0'

  // Set note
  if (r.note) noteStr.value = r.note

  // Set date
  if (r.date) {
    try { selectedDate.value = new Date(r.date) } catch { /* ignore */ }
  }

  // Set account
  const acc = accountStore.accounts.find((a) => a.name === r.accountName)
  if (acc) {
    selectedAccountId.value = acc.id
  }

  // Clear AI state
  aiText.value = ''
  aiResult.value = null

  uni.showToast({ title: '已填入', icon: 'success' })
}

// ---------- Voice Recognition ----------
const isRecording = ref(false)
const voiceInterimText = ref('')

function toggleVoice() {
  if (isRecording.value) {
    stopVoiceInput()
    return
  }
  startVoiceInput()
}

function startVoiceInput() {
  if (!isVoiceSupported()) {
    uni.showModal({
      title: '不支持语音识别',
      content: '当前浏览器不支持语音识别。H5 端请使用 Chrome 浏览器，微信小程序端请确保已配置同声传译插件。',
      showCancel: false,
    })
    return
  }

  isRecording.value = true
  voiceInterimText.value = ''

  startVoice(
    (result) => {
      voiceInterimText.value = result.text
      if (result.isFinal && result.text.trim()) {
        // Auto-fill and stop recording
        aiText.value = result.text.trim()
        isRecording.value = false
        voiceInterimText.value = ''
        // Auto-trigger AI parse after a brief delay
        setTimeout(() => onAiParse(), 300)
      }
    },
    (error) => {
      isRecording.value = false
      voiceInterimText.value = ''
      uni.showToast({ title: error, icon: 'none', duration: 3000 })
    }
  )
}

function stopVoiceInput() {
  stopVoice()
  if (voiceInterimText.value.trim()) {
    aiText.value = voiceInterimText.value.trim()
  }
  isRecording.value = false
  voiceInterimText.value = ''
}
</script>

<style scoped>
.page {
  min-height: 100vh;
  background: var(--bg);
  display: flex;
  flex-direction: column;
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

/* AI Input Bar */
.ai-input-bar {
  display: flex;
  align-items: center;
  background: linear-gradient(135deg, #667eea15, #764ba215);
  border-bottom: 2rpx solid #667eea22;
  padding: 16rpx 24rpx;
  gap: 12rpx;
}

.ai-input-icon {
  font-size: 32rpx;
  flex-shrink: 0;
}

.ai-input {
  flex: 1;
  height: 64rpx;
  background: var(--card);
  border-radius: 32rpx;
  padding: 0 24rpx;
  font-size: 26rpx;
  color: var(--text-primary);
}

.ai-send-btn {
  background: linear-gradient(135deg, #667eea, #764ba2);
  color: #fff;
  border-radius: 32rpx;
  padding: 0 28rpx;
  height: 64rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.ai-send-btn.disabled { opacity: 0.5; }
.ai-send-text { font-size: 26rpx; font-weight: 500; color: #fff; }
.ai-loading { font-size: 26rpx; color: #fff; letter-spacing: 4rpx; }

/* Scan Receipt Entry */
.scan-entry {
  margin: 16rpx 24rpx 0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: linear-gradient(135deg, rgba(129, 199, 132, 0.15), rgba(76, 175, 80, 0.12));
  border: 1rpx solid rgba(76, 175, 80, 0.35);
  border-radius: 16rpx;
  padding: 20rpx 24rpx;
}
.scan-entry-icon { font-size: 34rpx; margin-right: 16rpx; }
.scan-entry-text { flex: 1; font-size: 28rpx; color: #2e7d32; font-weight: 500; }
.scan-entry-arrow { font-size: 30rpx; color: #66bb6a; }

/* AI Result */
.ai-result-bar {
  margin: 16rpx 24rpx 0;
  background: #667eea0a;
  border: 2rpx solid #667eea22;
  padding: 20rpx 24rpx;
}

.ai-result-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12rpx;
}

.ai-result-label {
  font-size: 24rpx;
  color: var(--text-secondary);
  font-weight: 500;
}

.ai-result-confirm {
  background: var(--primary);
  color: #fff;
  font-size: 24rpx;
  padding: 8rpx 24rpx;
  border-radius: 24rpx;
  font-weight: 500;
}

.ai-result-confirm:active { opacity: 0.8; }

.ai-result-detail {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 12rpx;
}

.ai-result-tag {
  background: var(--primary-light);
  color: var(--primary);
  font-size: 24rpx;
  padding: 6rpx 16rpx;
  border-radius: 20rpx;
}

.ai-result-amount {
  font-size: 30rpx;
  font-weight: 700;
  color: var(--expense);
}

.ai-result-note {
  font-size: 24rpx;
  color: var(--text-secondary);
}

/* Microphone Button */
.ai-mic-btn {
  width: 64rpx; height: 64rpx;
  border-radius: 50%;
  background: var(--card);
  display: flex; align-items: center; justify-content: center;
  flex-shrink: 0;
  border: 2rpx solid var(--border);
  transition: all 0.2s ease;
}

.ai-mic-btn:active { transform: scale(0.9); }

.ai-mic-btn.recording {
  background: #FF6B6B;
  border-color: #FF6B6B;
  animation: mic-pulse 1s infinite;
}

.ai-mic-icon { font-size: 32rpx; }

@keyframes mic-pulse {
  0%, 100% { box-shadow: 0 0 0 0 rgba(255, 107, 107, 0.4); }
  50% { box-shadow: 0 0 0 16rpx rgba(255, 107, 107, 0); }
}

/* Voice Overlay */
.voice-overlay {
  position: fixed;
  top: 0; left: 0; right: 0; bottom: 0;
  background: rgba(0, 0, 0, 0.6);
  z-index: 300;
  display: flex;
  align-items: center;
  justify-content: center;
}

.voice-panel {
  background: var(--card);
  border-radius: 32rpx;
  padding: 60rpx 48rpx;
  width: 580rpx;
  display: flex;
  flex-direction: column;
  align-items: center;
  box-shadow: 0 24rpx 64rpx rgba(0, 0, 0, 0.2);
}

/* Voice Waves Animation */
.voice-waves {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12rpx;
  height: 120rpx;
  margin-bottom: 32rpx;
}

.voice-wave {
  width: 10rpx;
  background: linear-gradient(to top, var(--primary), #667eea);
  border-radius: 5rpx;
  animation: wave 1s ease-in-out infinite;
}

.voice-wave:nth-child(1) { height: 30rpx; animation-delay: 0s; }
.voice-wave:nth-child(2) { height: 60rpx; animation-delay: 0.15s; }
.voice-wave:nth-child(3) { height: 90rpx; animation-delay: 0.3s; }
.voice-wave:nth-child(4) { height: 60rpx; animation-delay: 0.45s; }
.voice-wave:nth-child(5) { height: 30rpx; animation-delay: 0.6s; }

@keyframes wave {
  0%, 100% { transform: scaleY(0.4); }
  50% { transform: scaleY(1); }
}

.voice-text {
  font-size: 34rpx;
  font-weight: 600;
  color: var(--text-primary);
  text-align: center;
  margin-bottom: 16rpx;
  min-height: 48rpx;
}

.voice-hint {
  font-size: 24rpx;
  color: var(--text-tertiary);
  text-align: center;
  margin-bottom: 40rpx;
}

.voice-stop-btn {
  background: var(--primary);
  border-radius: 44rpx;
  padding: 20rpx 80rpx;
}

.voice-stop-btn:active { opacity: 0.8; }

.voice-stop-text {
  font-size: 30rpx;
  font-weight: 600;
  color: #fff;
}

.nav-bar-inner {
  height: 88rpx;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 24rpx;
}

.nav-back {
  width: 64rpx;
  height: 64rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
}

.nav-back:active {
  background: var(--bg);
}

.nav-back-icon {
  font-size: 36rpx;
  color: var(--text-primary);
}

.nav-title {
  font-size: 34rpx;
  font-weight: 600;
  color: var(--text-primary);
}

.nav-placeholder {
  width: 64rpx;
}

/* Type Tabs */
.type-tabs {
  display: flex;
  align-items: center;
  background: var(--card);
  padding: 16rpx 24rpx;
  gap: 16rpx;
}

.type-tab {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  height: 72rpx;
  border-radius: 40rpx;
  background: var(--bg);
  font-size: 28rpx;
  font-weight: 500;
  color: var(--text-secondary);
  transition: all 0.2s ease;
}

.type-tab.active {
  background: var(--primary);
  color: #ffffff;
  box-shadow: 0 4rpx 12rpx rgba(79, 110, 247, 0.3);
}

/* Category Grid */
.category-scroll {
  height: 360rpx;
  padding: 16rpx 24rpx;
  background: var(--card);
  margin-bottom: 2rpx;
}

.category-grid {
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: 20rpx 12rpx;
}

.category-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8rpx;
  padding: 12rpx 0;
}

.category-icon-wrap {
  width: 88rpx;
  height: 88rpx;
  border-radius: 50%;
  background: var(--bg);
  display: flex;
  align-items: center;
  justify-content: center;
  border: 3rpx solid transparent;
  transition: all 0.2s ease;
}

.category-icon-wrap.selected {
  background: var(--primary-light);
  border-color: var(--primary);
}

.category-icon {
  font-size: 40rpx;
}

.category-label {
  font-size: 22rpx;
  color: var(--text-secondary);
  text-align: center;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 120rpx;
}

.category-label.selected {
  color: var(--primary);
  font-weight: 600;
}

/* Amount Section */
.amount-section {
  background: var(--card);
  padding: 32rpx 32rpx 24rpx;
  margin-bottom: 2rpx;
}

.amount-row {
  display: flex;
  align-items: baseline;
}

.amount-symbol {
  font-size: 40rpx;
  font-weight: 600;
  color: var(--text-primary);
  margin-right: 8rpx;
}

.amount-display {
  font-size: 72rpx;
  font-weight: 700;
  color: var(--text-primary);
  letter-spacing: -2rpx;
  line-height: 1;
}

.amount-display.placeholder {
  color: var(--text-tertiary);
}

/* Info Row */
.info-row {
  display: flex;
  align-items: center;
  background: var(--card);
  padding: 20rpx 24rpx;
  gap: 16rpx;
  margin-bottom: 16rpx;
}

.info-item {
  display: flex;
  align-items: center;
  padding: 12rpx 20rpx;
  background: var(--bg);
  border-radius: var(--radius);
  gap: 8rpx;
}

.note-item {
  flex: 1;
}

.note-input {
  font-size: 26rpx;
  color: var(--text-primary);
  width: 100%;
}

.note-placeholder {
  color: var(--text-tertiary);
}

.info-icon {
  font-size: 28rpx;
}

.info-text {
  font-size: 26rpx;
  color: var(--text-secondary);
  white-space: nowrap;
}

/* Keypad Wrapper */
.keypad-wrapper {
  margin-top: auto;
  padding-bottom: env(safe-area-inset-bottom);
}

.keypad {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 2rpx;
  background: var(--border);
}

.keypad-btn {
  background: var(--card);
  height: 100rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 40rpx;
  font-weight: 500;
  color: var(--text-primary);
  border: none;
  border-radius: 0;
  padding: 0;
  margin: 0;
  line-height: 1;
}

.keypad-btn::after {
  border: none;
}

.keypad-btn:active {
  background: var(--bg);
}

.keypad-btn.func {
  background: #F0F0F5;
  font-size: 36rpx;
}

.keypad-btn.func:active {
  background: #E0E0E8;
}

.keypad-back-icon {
  font-size: 44rpx;
  color: var(--text-secondary);
}

.keypad-btn.confirm {
  background: var(--primary);
  color: #ffffff;
  grid-row: span 1;
}

.keypad-btn.confirm:active {
  background: var(--primary-dark);
}

.keypad-confirm-text {
  font-size: 32rpx;
  font-weight: 600;
  color: #ffffff;
}

/* Overlay / Account Picker */
.overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.4);
  z-index: 200;
  display: flex;
  align-items: flex-end;
  justify-content: center;
}

.account-picker {
  background: var(--card);
  border-radius: var(--radius-lg) var(--radius-lg) 0 0;
  padding: 32rpx;
  width: 100%;
  max-height: 60vh;
  overflow-y: auto;
  padding-bottom: calc(32rpx + env(safe-area-inset-bottom));
}

.picker-title {
  font-size: 32rpx;
  font-weight: 600;
  color: var(--text-primary);
  margin-bottom: 24rpx;
  text-align: center;
}

.account-option {
  display: flex;
  align-items: center;
  padding: 24rpx 16rpx;
  border-radius: var(--radius);
  margin-bottom: 8rpx;
  gap: 16rpx;
}

.account-option:active {
  background: var(--bg);
}

.account-option.active {
  background: var(--primary-light);
}

.account-option-icon {
  font-size: 36rpx;
}

.account-option-name {
  flex: 1;
  font-size: 30rpx;
  color: var(--text-primary);
}

.account-option-check {
  font-size: 30rpx;
  color: var(--primary);
  font-weight: 600;
}
</style>
