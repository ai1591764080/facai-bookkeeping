<template>
  <view class="page">
    <!-- Custom Nav Bar -->
    <view class="nav-bar">
      <view class="nav-status-bar" :style="{ height: statusBarHeight + 'px' }" />
      <view class="nav-content">
        <text class="nav-title">资产</text>
        <view class="nav-right" @tap="goManage">
          <text class="nav-right-text">管理</text>
        </view>
      </view>
    </view>

    <!-- Scrollable Content with pull-down refresh -->
    <scroll-view
      scroll-y
      class="scroll-content"
      :style="{ top: navHeight + 'px' }"
      refresher-enabled
      :refresher-triggered="refreshing"
      @refresherrefresh="onRefresh"
    >
      <!-- Net Worth Summary Card -->
      <view class="net-worth-card">
        <view class="net-worth-header">
          <text class="net-worth-label">净资产</text>
          <view class="eye-toggle" @tap="showAmount = !showAmount">
            <text class="eye-icon">{{ showAmount ? '👁' : '🙈' }}</text>
          </view>
        </view>
        <text class="net-worth-amount" :class="{ 'amount-hidden': !showAmount }">
          {{ showAmount ? '¥' + formatAmount(accountStore.netWorth) : '****' }}
        </text>
        <view class="net-worth-divider" />
        <view class="net-worth-row">
          <view class="net-worth-item">
            <text class="net-worth-sub-label">总资产</text>
            <text class="net-worth-sub-value text-income">
              {{ showAmount ? '¥' + formatAmount(accountStore.totalAssets) : '****' }}
            </text>
          </view>
          <view class="net-worth-separator" />
          <view class="net-worth-item">
            <text class="net-worth-sub-label">总负债</text>
            <text class="net-worth-sub-value text-expense">
              {{ showAmount ? '¥' + formatAmount(accountStore.totalLiabilities) : '****' }}
            </text>
          </view>
        </view>
      </view>

      <!-- Account List -->
      <view class="card account-section">
        <view class="section-header">
          <text class="section-title">我的账户</text>
          <text class="section-count">{{ accountStore.visibleAccounts.length }}个</text>
        </view>

        <view v-if="accountStore.visibleAccounts.length === 0" class="empty-state">
          <text class="empty-icon">💰</text>
          <text class="empty-text">还没有账户，点击下方添加</text>
        </view>

        <view
          v-for="account in accountStore.visibleAccounts"
          :key="account.id"
          class="account-item"
          @tap="goEdit(account.id)"
        >
          <view class="account-left">
            <view class="account-icon">
              <text>{{ account.icon }}</text>
            </view>
            <view class="account-info">
              <text class="account-name">{{ account.name }}</text>
              <text class="account-type-label">{{ typeLabels[account.type] || '其他' }}</text>
            </view>
          </view>
          <view class="account-right">
            <text
              class="account-balance"
              :class="{
                'balance-negative': account.balance < 0,
                'amount-hidden': !showAmount
              }"
            >
              {{ showAmount ? (account.balance >= 0 ? '¥' + formatAmount(account.balance) : '-¥' + formatAmount(account.balance)) : '****' }}
            </text>
          </view>
        </view>
      </view>

      <!-- Bottom spacer for tab bar and FAB -->
      <view class="bottom-spacer" />
    </scroll-view>

    <!-- Floating Add Button -->
    <view class="fab" @tap="goAdd">
      <text class="fab-icon">+</text>
    </view>

    <DraggableDock />
  </view>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue' // Vue 响应式：ref 声明响应式数据，computed 派生计算值
import DraggableDock from '../../components/DraggableDock.vue' // 可拖拽、贴边折叠的工具条（添加/AI/语音）
import { useAccountStore } from '../../stores' // 账户状态仓库
import { formatAmount } from '../../utils/format' // 金额格式化工具

const accountStore = useAccountStore()

const statusBarHeight = ref(20)
const navHeight = ref(64)
const refreshing = ref(false)
const showAmount = ref(true)

const typeLabels: Record<string, string> = {
  cash: '现金',
  bank_card: '银行卡',
  credit_card: '信用卡',
  alipay: '支付宝',
  wechat: '微信',
  investment: '投资',
  loan: '贷款',
  other: '其他'
}

// Pull-down refresh
function onRefresh() {
  refreshing.value = true
  // Reload store data
  accountStore.visibleAccounts // trigger reactivity
  setTimeout(() => {
    refreshing.value = false
  }, 500)
}

// Navigation
function goAdd() {
  uni.navigateTo({ url: '/pages/account/edit' })
}

function goEdit(id: string) {
  uni.navigateTo({ url: `/pages/account/edit?id=${id}` })
}

function goManage() {
  uni.navigateTo({ url: '/pages/account/manage' })
}

// Init
const sysInfo = uni.getSystemInfoSync()
statusBarHeight.value = sysInfo.statusBarHeight ?? 20
navHeight.value = statusBarHeight.value + 44
</script>

<style scoped>
.page {
  min-height: 100vh;
  background: var(--bg);
}

/* Nav Bar */
.nav-bar {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  z-index: 100;
  background: var(--card);
  box-shadow: 0 1rpx 8rpx var(--shadow);
}

.nav-status-bar {
  width: 100%;
}

.nav-content {
  height: 88rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
}

.nav-title {
  font-size: 34rpx;
  font-weight: 600;
  color: var(--text-primary);
}

.nav-right {
  position: absolute;
  right: 24rpx;
  top: 50%;
  transform: translateY(-50%);
  padding: 8rpx 20rpx;
}

.nav-right-text {
  font-size: 28rpx;
  color: var(--primary);
  font-weight: 500;
}

/* Scroll Content */
.scroll-content {
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  padding: 0 24rpx;
}

/* Net Worth Card */
.net-worth-card {
  background: linear-gradient(135deg, var(--primary) 0%, var(--primary-dark) 100%);
  border-radius: var(--radius-lg);
  padding: 40rpx 36rpx;
  margin-top: 24rpx;
  margin-bottom: 24rpx;
  box-shadow: 0 8rpx 32rpx rgba(79, 110, 247, 0.25);
}

.net-worth-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-direction: row;
}

.net-worth-label {
  font-size: 28rpx;
  color: rgba(255, 255, 255, 0.75);
  font-weight: 400;
}

.eye-toggle {
  width: 56rpx;
  height: 56rpx;
  display: flex;
  align-items: center;
  justify-content: center;
}

.eye-icon {
  font-size: 32rpx;
}

.net-worth-amount {
  font-size: 64rpx;
  font-weight: 700;
  color: #fff;
  letter-spacing: -2rpx;
  margin-top: 12rpx;
  display: block;
}

.amount-hidden {
  letter-spacing: 8rpx;
}

.net-worth-divider {
  height: 1rpx;
  background: rgba(255, 255, 255, 0.15);
  margin: 28rpx 0;
}

.net-worth-row {
  display: flex;
  align-items: center;
  justify-content: space-around;
  flex-direction: row;
}

.net-worth-item {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.net-worth-sub-label {
  font-size: 24rpx;
  color: rgba(255, 255, 255, 0.6);
  margin-bottom: 8rpx;
}

.net-worth-sub-value {
  font-size: 32rpx;
  font-weight: 600;
  color: #fff;
}

.net-worth-separator {
  width: 1rpx;
  height: 56rpx;
  background: rgba(255, 255, 255, 0.15);
}

/* Override text-income/expense for white card */
.net-worth-card .text-income {
  color: #fff;
}

.net-worth-card .text-expense {
  color: rgba(255, 255, 255, 0.9);
}

/* Account Section */
.account-section {
  margin-bottom: 24rpx;
}

.section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-direction: row;
  margin-bottom: 8rpx;
}

.section-count {
  font-size: 24rpx;
  color: var(--text-tertiary);
}

/* Account Item */
.account-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-direction: row;
  padding: 24rpx 0;
  border-bottom: 1rpx solid var(--border);
}

.account-item:last-child {
  border-bottom: none;
}

.account-item:active {
  background: var(--bg);
  margin: 0 -28rpx;
  padding-left: 28rpx;
  padding-right: 28rpx;
  border-radius: 12rpx;
}

.account-left {
  display: flex;
  align-items: center;
  flex-direction: row;
  flex: 1;
  min-width: 0;
}

.account-icon {
  width: 80rpx;
  height: 80rpx;
  border-radius: 50%;
  background: var(--bg);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 40rpx;
  margin-right: 20rpx;
  flex-shrink: 0;
}

.account-info {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-width: 0;
}

.account-name {
  font-size: 30rpx;
  font-weight: 500;
  color: var(--text-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.account-type-label {
  font-size: 24rpx;
  color: var(--text-tertiary);
  margin-top: 4rpx;
}

.account-right {
  flex-shrink: 0;
  margin-left: 16rpx;
}

.account-balance {
  font-size: 34rpx;
  font-weight: 600;
  color: var(--text-primary);
}

.balance-negative {
  color: var(--expense);
}

/* Floating Action Button */
.fab {
  position: fixed;
  right: 40rpx;
  bottom: 180rpx;
  width: 104rpx;
  height: 104rpx;
  background: var(--primary);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 8rpx 24rpx rgba(79, 110, 247, 0.4);
  z-index: 99;
}

.fab:active {
  transform: scale(0.92);
  box-shadow: 0 4rpx 12rpx rgba(79, 110, 247, 0.3);
}

.fab-icon {
  font-size: 52rpx;
  color: #fff;
  font-weight: 300;
  line-height: 1;
  margin-top: -4rpx;
}

/* Bottom Spacer */
.bottom-spacer {
  height: 200rpx;
}
</style>
