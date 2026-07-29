<script setup lang="ts">
import { computed } from 'vue'
import { useAccountStore } from '../../stores'
import type { Account } from '../../types'

const accountStore = useAccountStore()

const typeLabels: Record<string, string> = {
  cash: '现金',
  bank_card: '银行卡',
  credit_card: '信用卡',
  alipay: '支付宝',
  wechat: '微信',
  investment: '投资账户',
  loan: '贷款',
  other: '其他',
}

const sortedAccounts = computed(() =>
  [...accountStore.accounts].sort((a, b) => a.sortOrder - b.sortOrder)
)

function onEditAccount(acc: Account) {
  uni.navigateTo({ url: `/pages/account/edit?id=${acc.id}` })
}

function onAddAccount() {
  uni.navigateTo({ url: '/pages/account/edit' })
}

function onDeleteAccount(acc: Account) {
  uni.showModal({
    title: '确认删除',
    content: `确定要删除账户「${acc.name}」吗？`,
    success(res) {
      if (res.confirm) {
        accountStore.remove(acc.id)
        uni.showToast({ title: '已删除', icon: 'success' })
      }
    }
  })
}

function formatBalance(balance: number): string {
  const abs = Math.abs(balance)
  return balance < 0 ? `-${abs.toFixed(2)}` : abs.toFixed(2)
}
</script>

<template>
  <view class="manage-page">
    <!-- Summary -->
    <view class="summary-card card">
      <view class="summary-row">
        <view class="summary-item">
          <text class="summary-label">净资产</text>
          <text class="summary-value net">{{ formatBalance(accountStore.netWorth) }}</text>
        </view>
      </view>
      <view class="summary-divider"></view>
      <view class="summary-row">
        <view class="summary-half">
          <text class="summary-label">总资产</text>
          <text class="summary-value assets">{{ formatBalance(accountStore.totalAssets) }}</text>
        </view>
        <view class="summary-half">
          <text class="summary-label">总负债</text>
          <text class="summary-value liabilities">{{ formatBalance(accountStore.totalLiabilities) }}</text>
        </view>
      </view>
    </view>

    <!-- Account list -->
    <view class="card list-card">
      <view
        v-for="acc in sortedAccounts"
        :key="acc.id"
        class="account-item"
        @tap="onEditAccount(acc)"
      >
        <view class="acc-left">
          <view class="acc-icon-wrap">
            <text class="acc-icon">{{ acc.icon }}</text>
          </view>
          <view class="acc-info">
            <text class="acc-name">{{ acc.name }}</text>
            <text class="acc-type">{{ typeLabels[acc.type] || acc.type }}</text>
          </view>
        </view>
        <view class="acc-right">
          <text class="acc-balance" :class="{ negative: acc.balance < 0 }">
            {{ formatBalance(acc.balance) }}
          </text>
          <view class="acc-actions">
            <view class="action-btn delete-btn" @tap.stop="onDeleteAccount(acc)">
              <text class="action-text">删除</text>
            </view>
          </view>
        </view>
      </view>

      <view v-if="sortedAccounts.length === 0" class="empty-state">
        <text class="empty-icon">💳</text>
        <text class="empty-text">暂无账户</text>
      </view>
    </view>

    <!-- Add button -->
    <view class="fab-area">
      <view class="fab-btn" @tap="onAddAccount">
        <text class="fab-text">+ 新增账户</text>
      </view>
    </view>
  </view>
</template>

<style scoped>
.manage-page {
  min-height: 100vh;
  background: var(--bg);
  padding-bottom: 140rpx;
}

.summary-card {
  margin: 24rpx;
  padding: 32rpx 28rpx;
}

.summary-row {
  display: flex;
  flex-direction: row;
  align-items: center;
}

.summary-item {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.summary-half {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.summary-label {
  font-size: 24rpx;
  color: var(--text-secondary);
  margin-bottom: 8rpx;
}

.summary-value {
  font-size: 36rpx;
  font-weight: 700;
}

.summary-value.net {
  color: var(--primary);
  font-size: 44rpx;
}

.summary-value.assets {
  color: var(--income);
}

.summary-value.liabilities {
  color: var(--expense);
}

.summary-divider {
  height: 1rpx;
  background: var(--border);
  margin: 24rpx 0;
}

.list-card {
  margin: 0 24rpx 24rpx;
  padding: 0 28rpx;
}

.account-item {
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: space-between;
  padding: 24rpx 0;
  border-bottom: 1rpx solid var(--border);
}

.account-item:last-child {
  border-bottom: none;
}

.acc-left {
  display: flex;
  flex-direction: row;
  align-items: center;
  flex: 1;
  min-width: 0;
}

.acc-icon-wrap {
  width: 72rpx;
  height: 72rpx;
  border-radius: 18rpx;
  background: var(--bg);
  display: flex;
  align-items: center;
  justify-content: center;
  margin-right: 20rpx;
  flex-shrink: 0;
}

.acc-icon {
  font-size: 36rpx;
}

.acc-info {
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.acc-name {
  font-size: 30rpx;
  font-weight: 500;
  color: var(--text-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.acc-type {
  font-size: 24rpx;
  color: var(--text-secondary);
  margin-top: 4rpx;
}

.acc-right {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  flex-shrink: 0;
  margin-left: 16rpx;
}

.acc-balance {
  font-size: 32rpx;
  font-weight: 600;
  color: var(--text-primary);
}

.acc-balance.negative {
  color: var(--expense);
}

.acc-actions {
  display: flex;
  flex-direction: row;
  margin-top: 8rpx;
}

.action-btn {
  padding: 6rpx 20rpx;
  border-radius: 8rpx;
}

.delete-btn {
  background: #FEE2E2;
}

.delete-btn .action-text {
  color: #EF4444;
  font-size: 22rpx;
  font-weight: 500;
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 60rpx 0;
}

.empty-icon {
  font-size: 80rpx;
  margin-bottom: 16rpx;
}

.empty-text {
  font-size: 28rpx;
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
</style>
