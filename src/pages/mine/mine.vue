<script setup lang="ts">
import { computed } from 'vue' // Vue 响应式：computed 派生计算值
import DraggableDock from '../../components/DraggableDock.vue' // 可拖拽、贴边折叠的工具条（添加/AI/语音）
import { useSettingsStore } from '../../stores' // 设置状态仓库

const settingsStore = useSettingsStore()

const isDark = computed(() => settingsStore.theme === 'dark')

const currencyOptions = ['CNY', 'USD', 'EUR', 'GBP', 'JPY', 'KRW', 'HKD', 'TWD']
const dayOptions = Array.from({ length: 28 }, (_, i) => String(i + 1))

function toggleTheme() {
  settingsStore.setTheme(isDark.value ? 'light' : 'dark')
  uni.showToast({ title: isDark.value ? '已切换为深色模式' : '已切换为浅色模式', icon: 'none' })
}

function onCurrencyChange(e: any) {
  const idx = e.detail.value
  settingsStore.setCurrency(currencyOptions[idx])
}

function onMonthStartChange(e: any) {
  const idx = e.detail.value
  settingsStore.setMonthStartDay(Number(dayOptions[idx]))
}

const currencyIndex = computed(() => {
  const idx = currencyOptions.indexOf(settingsStore.currency)
  return idx >= 0 ? idx : 0
})

const dayIndex = computed(() => settingsStore.monthStartDay - 1)

interface MenuItem {
  icon: string
  label: string
  action: 'navigate' | 'theme' | 'picker'
  path?: string
  pickerType?: 'currency' | 'monthStart'
}

const menuItems: MenuItem[] = [
  { icon: '🔍', label: '扫描识别记账', action: 'navigate', path: '/pages/scan/scan' },
  { icon: '🗂️', label: '智能归档', action: 'navigate', path: '/pages/scan/archive' },
  { icon: '🤖', label: 'AI 记账助手', action: 'navigate', path: '/pages/ai/chat' },
  { icon: '📊', label: 'AI 消费洞察', action: 'navigate', path: '/pages/ai/insights' },
  { icon: '🔑', label: 'AI 设置', action: 'navigate', path: '/pages/ai/settings' },
  { icon: '📖', label: '账本管理', action: 'navigate', path: '/pages/ledger/manage' },
  { icon: '📂', label: '分类管理', action: 'navigate', path: '/pages/category/manage' },
  { icon: '💰', label: '预算管理', action: 'navigate', path: '/pages/budget/budget' },
  { icon: '👥', label: 'AA记账', action: 'navigate', path: '/pages/aa/aa' },
  { icon: '💾', label: '备份与导出', action: 'navigate', path: '/pages/export/export' },
  { icon: '🎨', label: '主题切换', action: 'theme' },
  { icon: '📅', label: '月初日期', action: 'picker', pickerType: 'monthStart' },
  { icon: '💱', label: '货币设置', action: 'picker', pickerType: 'currency' },
]

function onItemClick(item: MenuItem) {
  if (item.action === 'navigate' && item.path) {
    uni.navigateTo({ url: item.path })
  } else if (item.action === 'theme') {
    toggleTheme()
  }
  // picker actions are handled by <picker> component wrappers
}

function getRightText(item: MenuItem): string {
  if (item.action === 'theme') {
    return isDark.value ? '深色' : '浅色'
  }
  if (item.pickerType === 'currency') {
    return settingsStore.currency
  }
  if (item.pickerType === 'monthStart') {
    return `每月${settingsStore.monthStartDay}日`
  }
  return ''
}
</script>

<template>
  <view class="mine-page">
    <!-- Header -->
    <view class="header">
      <view class="logo-area">
        <view class="logo-icon">
          <text class="logo-emoji">💰</text>
        </view>
        <view class="app-info">
          <text class="app-name">发财记账</text>
          <text class="app-slogan">让每一笔都清清楚楚</text>
        </view>
      </view>
    </view>

    <!-- Menu list -->
    <view class="card menu-card">
      <template v-for="(item, index) in menuItems" :key="item.label">
        <!-- Picker wrappers -->
        <picker
          v-if="item.pickerType === 'currency'"
          mode="selector"
          :range="currencyOptions"
          :value="currencyIndex"
          @change="onCurrencyChange"
        >
          <view class="menu-item" :class="{ 'no-border': index === menuItems.length - 1 }">
            <view class="menu-left">
              <text class="menu-icon">{{ item.icon }}</text>
              <text class="menu-label">{{ item.label }}</text>
            </view>
            <view class="menu-right">
              <text class="menu-value">{{ getRightText(item) }}</text>
              <text class="menu-arrow">›</text>
            </view>
          </view>
        </picker>

        <picker
          v-else-if="item.pickerType === 'monthStart'"
          mode="selector"
          :range="dayOptions"
          :value="dayIndex"
          @change="onMonthStartChange"
        >
          <view class="menu-item" :class="{ 'no-border': index === menuItems.length - 1 }">
            <view class="menu-left">
              <text class="menu-icon">{{ item.icon }}</text>
              <text class="menu-label">{{ item.label }}</text>
            </view>
            <view class="menu-right">
              <text class="menu-value">{{ getRightText(item) }}</text>
              <text class="menu-arrow">›</text>
            </view>
          </view>
        </picker>

        <!-- Regular tap items -->
        <view
          v-else
          class="menu-item"
          :class="{ 'no-border': index === menuItems.length - 1 }"
          @tap="onItemClick(item)"
        >
          <view class="menu-left">
            <text class="menu-icon">{{ item.icon }}</text>
            <text class="menu-label">{{ item.label }}</text>
          </view>
          <view class="menu-right">
            <text class="menu-value">{{ getRightText(item) }}</text>
            <text class="menu-arrow">›</text>
          </view>
        </view>
      </template>
    </view>

    <!-- Version -->
    <view class="version-area">
      <text class="version-text">发财记账 v1.0.0</text>
    </view>

    <DraggableDock />
  </view>
</template>

<style scoped>
.mine-page {
  min-height: 100vh;
  background: var(--bg);
  padding-bottom: 140rpx;
}

.header {
  background: var(--primary);
  padding: 80rpx 40rpx 60rpx;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.logo-area {
  display: flex;
  flex-direction: row;
  align-items: center;
}

.logo-icon {
  width: 96rpx;
  height: 96rpx;
  background: rgba(255, 255, 255, 0.2);
  border-radius: 24rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-right: 24rpx;
}

.logo-emoji {
  font-size: 52rpx;
}

.app-info {
  display: flex;
  flex-direction: column;
}

.app-name {
  font-size: 40rpx;
  font-weight: 700;
  color: #fff;
  letter-spacing: 2rpx;
}

.app-slogan {
  font-size: 24rpx;
  color: rgba(255, 255, 255, 0.75);
  margin-top: 6rpx;
}

.menu-card {
  margin: 32rpx 24rpx;
  padding: 0 28rpx;
}

.menu-item {
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: space-between;
  padding: 32rpx 0;
  border-bottom: 1rpx solid var(--border);
}

.menu-item.no-border {
  border-bottom: none;
}

.menu-left {
  display: flex;
  flex-direction: row;
  align-items: center;
}

.menu-icon {
  font-size: 40rpx;
  margin-right: 24rpx;
  width: 48rpx;
  text-align: center;
}

.menu-label {
  font-size: 30rpx;
  color: var(--text-primary);
  font-weight: 500;
}

.menu-right {
  display: flex;
  flex-direction: row;
  align-items: center;
}

.menu-value {
  font-size: 26rpx;
  color: var(--text-secondary);
  margin-right: 12rpx;
}

.menu-arrow {
  font-size: 32rpx;
  color: var(--text-tertiary);
  font-weight: 300;
}

.version-area {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 60rpx 0 40rpx;
}

.version-text {
  font-size: 24rpx;
  color: var(--text-tertiary);
}
</style>
