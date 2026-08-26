<script setup lang="ts">
import { ref, computed } from 'vue' // Vue 响应式：ref 声明响应式数据，computed 派生计算值
import { useLedgerStore } from '../../stores' // 账本状态仓库
import type { Ledger } from '../../types' // 账本的类型定义

const ledgerStore = useLedgerStore()

const showAddModal = ref(false)
const newLedgerName = ref('')
const newLedgerType = ref<'personal' | 'shared'>('personal')

const typeLabels: Record<string, string> = {
  personal: '个人',
  shared: '共享',
}

function onSwitchLedger(ledger: Ledger) {
  if (ledger.id !== ledgerStore.currentId) {
    ledgerStore.switchLedger(ledger.id)
    uni.showToast({ title: `已切换到「${ledger.name}」`, icon: 'none' })
  }
}

function onOpenAdd() {
  newLedgerName.value = ''
  newLedgerType.value = 'personal'
  showAddModal.value = true
}

function onCloseModal() {
  showAddModal.value = false
}

function onConfirmAdd() {
  if (!newLedgerName.value.trim()) {
    uni.showToast({ title: '请输入账本名称', icon: 'none' })
    return
  }
  ledgerStore.add(newLedgerName.value.trim(), newLedgerType.value)
  showAddModal.value = false
  uni.showToast({ title: '添加成功', icon: 'success' })
}

function onDeleteLedger(ledger: Ledger) {
  if (ledgerStore.ledgers.length <= 1) {
    uni.showToast({ title: '至少保留一个账本', icon: 'none' })
    return
  }
  uni.showModal({
    title: '确认删除',
    content: `确定要删除账本「${ledger.name}」吗？相关数据不会被删除。`,
    success(res) {
      if (res.confirm) {
        ledgerStore.remove(ledger.id)
        uni.showToast({ title: '已删除', icon: 'success' })
      }
    }
  })
}

function onRenameLedger(ledger: Ledger) {
  uni.showModal({
    title: '重命名账本',
    editable: true,
    placeholderText: '请输入新名称',
    success(res) {
      if (res.confirm && res.content?.trim()) {
        ledgerStore.update({ ...ledger, name: res.content.trim() })
        uni.showToast({ title: '已更新', icon: 'success' })
      }
    }
  })
}
</script>

<template>
  <view class="manage-page">
    <!-- Current ledger indicator -->
    <view class="current-banner card">
      <text class="current-label">当前账本</text>
      <text class="current-name">{{ ledgerStore.current?.name || '未选择' }}</text>
    </view>

    <!-- Ledger list -->
    <view class="card list-card">
      <view
        v-for="ledger in ledgerStore.ledgers"
        :key="ledger.id"
        class="ledger-item"
        @tap="onSwitchLedger(ledger)"
      >
        <view class="ledger-left">
          <view class="ledger-icon-wrap">
            <text class="ledger-icon">{{ ledger.type === 'shared' ? '👥' : '📖' }}</text>
          </view>
          <view class="ledger-info">
            <view class="ledger-name-row">
              <text class="ledger-name">{{ ledger.name }}</text>
              <view v-if="ledger.id === ledgerStore.currentId" class="active-badge">
                <text class="active-badge-text">使用中</text>
              </view>
            </view>
            <view class="ledger-meta">
              <view class="type-tag">
                <text class="type-tag-text">{{ typeLabels[ledger.type] || ledger.type }}</text>
              </view>
              <text class="member-count">{{ ledger.memberCount }}人</text>
            </view>
          </view>
        </view>
        <view class="ledger-actions">
          <view class="action-btn" @tap.stop="onRenameLedger(ledger)">
            <text class="action-label">重命名</text>
          </view>
          <view class="action-btn del-btn" @tap.stop="onDeleteLedger(ledger)">
            <text class="action-label del">删除</text>
          </view>
        </view>
      </view>

      <view v-if="ledgerStore.ledgers.length === 0" class="empty-state">
        <text class="empty-icon">📖</text>
        <text class="empty-text">暂无账本</text>
      </view>
    </view>

    <!-- Add button -->
    <view class="fab-area">
      <view class="fab-btn" @tap="onOpenAdd">
        <text class="fab-text">+ 新建账本</text>
      </view>
    </view>

    <!-- Add modal -->
    <view v-if="showAddModal" class="modal-mask" @tap="onCloseModal">
      <view class="modal-content" @tap.stop>
        <text class="modal-title">新建账本</text>

        <view class="modal-field">
          <text class="field-label">名称</text>
          <view class="field-input-wrap">
            <input
              class="field-input"
              v-model="newLedgerName"
              placeholder="请输入账本名称"
              placeholder-class="placeholder"
              maxlength="20"
            />
          </view>
        </view>

        <view class="modal-field">
          <text class="field-label">类型</text>
          <view class="type-row">
            <view
              class="type-option"
              :class="{ active: newLedgerType === 'personal' }"
              @tap="newLedgerType = 'personal'"
            >
              <text class="type-option-text">个人</text>
            </view>
            <view
              class="type-option"
              :class="{ active: newLedgerType === 'shared' }"
              @tap="newLedgerType = 'shared'"
            >
              <text class="type-option-text">共享</text>
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
.manage-page {
  min-height: 100vh;
  background: var(--bg);
  padding-bottom: 140rpx;
}

.current-banner {
  margin: 24rpx;
  padding: 28rpx;
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: space-between;
}

.current-label {
  font-size: 26rpx;
  color: var(--text-secondary);
}

.current-name {
  font-size: 30rpx;
  font-weight: 600;
  color: var(--primary);
}

.list-card {
  margin: 0 24rpx 24rpx;
  padding: 0 28rpx;
}

.ledger-item {
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: space-between;
  padding: 24rpx 0;
  border-bottom: 1rpx solid var(--border);
}

.ledger-item:last-child {
  border-bottom: none;
}

.ledger-left {
  display: flex;
  flex-direction: row;
  align-items: center;
  flex: 1;
  min-width: 0;
}

.ledger-icon-wrap {
  width: 72rpx;
  height: 72rpx;
  border-radius: 18rpx;
  background: var(--primary-light);
  display: flex;
  align-items: center;
  justify-content: center;
  margin-right: 20rpx;
  flex-shrink: 0;
}

.ledger-icon {
  font-size: 36rpx;
}

.ledger-info {
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.ledger-name-row {
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: 12rpx;
}

.ledger-name {
  font-size: 30rpx;
  font-weight: 500;
  color: var(--text-primary);
}

.active-badge {
  background: var(--primary);
  border-radius: 6rpx;
  padding: 4rpx 12rpx;
}

.active-badge-text {
  font-size: 20rpx;
  color: #fff;
  font-weight: 500;
}

.ledger-meta {
  display: flex;
  flex-direction: row;
  align-items: center;
  margin-top: 8rpx;
  gap: 16rpx;
}

.type-tag {
  background: var(--bg);
  border-radius: 6rpx;
  padding: 4rpx 12rpx;
}

.type-tag-text {
  font-size: 22rpx;
  color: var(--text-secondary);
}

.member-count {
  font-size: 22rpx;
  color: var(--text-tertiary);
}

.ledger-actions {
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: 12rpx;
  flex-shrink: 0;
  margin-left: 16rpx;
}

.action-btn {
  padding: 8rpx 18rpx;
  border-radius: 8rpx;
  background: var(--primary-light);
}

.action-label {
  font-size: 22rpx;
  color: var(--primary);
  font-weight: 500;
}

.del-btn {
  background: #FEE2E2;
}

.action-label.del {
  color: #EF4444;
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
  width: 600rpx;
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

.type-option.active {
  border-color: var(--primary);
  background: var(--primary-light);
}

.type-option-text {
  font-size: 28rpx;
  color: var(--text-secondary);
  font-weight: 500;
}

.type-option.active .type-option-text {
  color: var(--primary);
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
