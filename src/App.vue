<script setup lang="ts">
import { onLaunch } from '@dcloudio/uni-app'
import { useLedgerStore, useCategoryStore, useAccountStore } from './stores'

onLaunch(() => {
  // Initialize stores - this triggers default data creation on first launch
  useLedgerStore()
  useCategoryStore()
  useAccountStore()
})
</script>

<style>
:root {
  --primary: #4F6EF7;
  --primary-light: #EEF1FE;
  --primary-dark: #3A54C4;
  --expense: #FF6B6B;
  --income: #51CF66;
  --transfer: #339AF0;
  --bg: #F5F6FA;
  --card: #FFFFFF;
  --text-primary: #1A1A2E;
  --text-secondary: #6B7280;
  --text-tertiary: #9CA3AF;
  --border: #E5E7EB;
  --shadow: rgba(0, 0, 0, 0.04);
  --radius: 16rpx;
  --radius-lg: 24rpx;
}

page {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC', 'Hiragino Sans GB',
    'Microsoft YaHei', sans-serif;
  background-color: var(--bg);
  color: var(--text-primary);
  font-size: 28rpx;
  line-height: 1.5;
}

.container {
  padding: 24rpx;
}

.card {
  background: var(--card);
  border-radius: var(--radius-lg);
  padding: 28rpx;
  box-shadow: 0 2rpx 12rpx var(--shadow);
  margin-bottom: 24rpx;
}

.text-expense { color: var(--expense); }
.text-income { color: var(--income); }
.text-transfer { color: var(--transfer); }
.text-secondary { color: var(--text-secondary); }
.text-tertiary { color: var(--text-tertiary); }

.flex-row {
  display: flex;
  align-items: center;
  flex-direction: row;
}

.flex-between {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-direction: row;
}

.flex-1 { flex: 1; }

.mt-24 { margin-top: 24rpx; }
.mb-24 { margin-bottom: 24rpx; }

.section-title {
  font-size: 32rpx;
  font-weight: 600;
  margin-bottom: 20rpx;
  color: var(--text-primary);
}

.amount-large {
  font-size: 56rpx;
  font-weight: 700;
  letter-spacing: -1rpx;
}

.btn-primary {
  background: var(--primary);
  color: #fff;
  border: none;
  border-radius: var(--radius);
  padding: 20rpx 40rpx;
  font-size: 30rpx;
  font-weight: 500;
  text-align: center;
}

.btn-primary::after { border: none; }

.divider {
  height: 1rpx;
  background: var(--border);
  margin: 20rpx 0;
}

/* TabBar custom styles */
.tab-bar {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  height: 120rpx;
  background: var(--card);
  display: flex;
  align-items: center;
  justify-content: space-around;
  padding-bottom: env(safe-area-inset-bottom);
  box-shadow: 0 -2rpx 12rpx var(--shadow);
  z-index: 999;
}

.tab-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  flex: 1;
  height: 100%;
}

.tab-item text {
  font-size: 22rpx;
  color: var(--text-tertiary);
  margin-top: 4rpx;
}

.tab-item.active text {
  color: var(--primary);
  font-weight: 500;
}

.tab-icon {
  font-size: 44rpx;
}

.tab-add {
  width: 88rpx;
  height: 88rpx;
  background: var(--primary);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-top: -30rpx;
  box-shadow: 0 4rpx 16rpx rgba(79, 110, 247, 0.35);
}

.tab-add text {
  font-size: 48rpx;
  color: #fff;
  font-weight: 300;
}

/* Empty state */
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 80rpx 40rpx;
}

.empty-icon {
  font-size: 120rpx;
  margin-bottom: 20rpx;
}

.empty-text {
  font-size: 28rpx;
  color: var(--text-tertiary);
}

/* Chip / Tag */
.chip {
  display: inline-flex;
  align-items: center;
  padding: 8rpx 20rpx;
  border-radius: 40rpx;
  font-size: 24rpx;
  background: var(--primary-light);
  color: var(--primary);
  margin-right: 12rpx;
  margin-bottom: 12rpx;
}

.chip.active {
  background: var(--primary);
  color: #fff;
}

/* Progress bar */
.progress-bar {
  height: 12rpx;
  background: var(--border);
  border-radius: 6rpx;
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  border-radius: 6rpx;
  transition: width 0.3s ease;
}

/* List item */
.list-item {
  display: flex;
  align-items: center;
  padding: 24rpx 0;
  border-bottom: 1rpx solid var(--border);
}

.list-item:last-child { border-bottom: none; }

.list-icon {
  width: 72rpx;
  height: 72rpx;
  border-radius: 50%;
  background: var(--bg);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 36rpx;
  margin-right: 20rpx;
  flex-shrink: 0;
}

.list-content {
  flex: 1;
  min-width: 0;
}

.list-title {
  font-size: 30rpx;
  font-weight: 500;
  color: var(--text-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.list-subtitle {
  font-size: 24rpx;
  color: var(--text-secondary);
  margin-top: 4rpx;
}

.list-amount {
  font-size: 32rpx;
  font-weight: 600;
  flex-shrink: 0;
  margin-left: 16rpx;
}

/* Keypad */
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
}

.keypad-btn::after { border: none; }
.keypad-btn:active { background: var(--bg); }
.keypad-btn.confirm { background: var(--primary); color: #fff; }
</style>
