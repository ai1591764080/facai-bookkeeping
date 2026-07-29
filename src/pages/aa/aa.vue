<script setup lang="ts">
import { ref, computed } from 'vue'
import { uuid } from '../../utils/uuid'
import { getAABills, saveAABills } from '../../utils/db'
import type { AABill } from '../../types'

// Local member management
interface Member {
  id: string
  name: string
}

const members = ref<Member[]>(loadMembers())
const bills = ref<AABill[]>(getAABills())

const showCreateForm = ref(false)
const showMemberManager = ref(false)

// Create form state
const title = ref('')
const totalAmount = ref('')
const payerId = ref('')
const selectedMemberIds = ref<string[]>([])
const splitType = ref<'equal' | 'custom'>('equal')
const customAmounts = ref<Record<string, string>>({})
const newMemberName = ref('')

function loadMembers(): Member[] {
  try {
    const raw = uni.getStorageSync('beecount_aa_members')
    if (raw) return JSON.parse(raw)
  } catch {}
  return []
}

function saveMembers() {
  uni.setStorageSync('beecount_aa_members', JSON.stringify(members.value))
}

function toggleMemberManager() {
  showMemberManager.value = !showMemberManager.value
}

function addMember() {
  const name = newMemberName.value.trim()
  if (!name) {
    uni.showToast({ title: '请输入成员名称', icon: 'none' })
    return
  }
  members.value.push({ id: uuid(), name })
  saveMembers()
  newMemberName.value = ''
}

function removeMember(id: string) {
  members.value = members.value.filter(m => m.id !== id)
  saveMembers()
}

// Toggle form
function toggleCreateForm() {
  if (!showCreateForm.value) {
    title.value = ''
    totalAmount.value = ''
    payerId.value = members.value[0]?.id || ''
    selectedMemberIds.value = members.value.map(m => m.id)
    splitType.value = 'equal'
    customAmounts.value = {}
  }
  showCreateForm.value = !showCreateForm.value
}

function toggleMemberSelection(id: string) {
  const idx = selectedMemberIds.value.indexOf(id)
  if (idx >= 0) {
    selectedMemberIds.value.splice(idx, 1)
  } else {
    selectedMemberIds.value.push(id)
  }
}

function isMemberSelected(id: string): boolean {
  return selectedMemberIds.value.includes(id)
}

function getMemberName(id: string): string {
  return members.value.find(m => m.id === id)?.name || '未知'
}

// Create bill
function onCreateBill() {
  if (!title.value.trim()) {
    uni.showToast({ title: '请输入标题', icon: 'none' })
    return
  }
  const amount = parseFloat(totalAmount.value)
  if (!amount || amount <= 0) {
    uni.showToast({ title: '请输入有效金额', icon: 'none' })
    return
  }
  if (!payerId.value) {
    uni.showToast({ title: '请选择付款人', icon: 'none' })
    return
  }
  if (selectedMemberIds.value.length < 2) {
    uni.showToast({ title: '至少选择2位参与成员', icon: 'none' })
    return
  }

  const splits: { memberId: string; amount: number; settled: boolean }[] = []

  if (splitType.value === 'equal') {
    const perPerson = Math.round((amount / selectedMemberIds.value.length) * 100) / 100
    selectedMemberIds.value.forEach(id => {
      splits.push({ memberId: id, amount: perPerson, settled: false })
    })
  } else {
    for (const id of selectedMemberIds.value) {
      const customAmt = parseFloat(customAmounts.value[id] || '0')
      splits.push({ memberId: id, amount: customAmt, settled: false })
    }
  }

  const bill: AABill = {
    id: uuid(),
    ledgerId: '',
    title: title.value.trim(),
    totalAmount: amount,
    payerId: payerId.value,
    memberIds: selectedMemberIds.value,
    splitType: splitType.value,
    splits,
    createdAt: new Date().toISOString(),
  }

  bills.value.unshift(bill)
  saveAABills(bills.value)
  showCreateForm.value = false
  uni.showToast({ title: '创建成功', icon: 'success' })
}

function onDeleteBill(bill: AABill) {
  uni.showModal({
    title: '确认删除',
    content: `确定要删除「${bill.title}」吗？`,
    success(res) {
      if (res.confirm) {
        bills.value = bills.value.filter(b => b.id !== bill.id)
        saveAABills(bills.value)
        uni.showToast({ title: '已删除', icon: 'success' })
      }
    }
  })
}

function isBillSettled(bill: AABill): boolean {
  return bill.splits.every(s => s.settled || s.memberId === bill.payerId)
}

function getSettlementSummary(bill: AABill): string {
  const settledCount = bill.splits.filter(s => s.settled || s.memberId === bill.payerId).length
  return `${settledCount}/${bill.splits.length} 已结清`
}

function toggleSettle(bill: AABill, splitIndex: number) {
  const split = bill.splits[splitIndex]
  if (split.memberId === bill.payerId) return
  split.settled = !split.settled
  saveAABills(bills.value)
}

function formatDate(iso: string): string {
  const d = new Date(iso)
  return `${d.getMonth() + 1}/${d.getDate()}`
}

function formatAmount(val: number): string {
  return val.toFixed(2)
}
</script>

<template>
  <view class="aa-page">
    <!-- Member manager toggle -->
    <view class="toolbar">
      <view class="toolbar-btn" @tap="toggleMemberManager">
        <text class="toolbar-btn-text">👥 成员管理 ({{ members.length }})</text>
      </view>
      <view class="toolbar-btn primary" @tap="toggleCreateForm">
        <text class="toolbar-btn-text-primary">+ 新建AA</text>
      </view>
    </view>

    <!-- Member manager panel -->
    <view v-if="showMemberManager" class="card member-card">
      <view class="member-add-row">
        <view class="member-input-wrap">
          <input
            class="member-input"
            v-model="newMemberName"
            placeholder="输入成员名称"
            placeholder-class="placeholder"
            maxlength="10"
            @confirm="addMember"
          />
        </view>
        <view class="add-member-btn" @tap="addMember">
          <text class="add-member-text">添加</text>
        </view>
      </view>
      <view class="member-list">
        <view
          v-for="member in members"
          :key="member.id"
          class="member-chip"
        >
          <text class="member-chip-name">{{ member.name }}</text>
          <view class="member-remove" @tap="removeMember(member.id)">
            <text class="member-remove-text">x</text>
          </view>
        </view>
        <view v-if="members.length === 0" class="member-empty">
          <text class="member-empty-text">暂无成员，请先添加</text>
        </view>
      </view>
    </view>

    <!-- Create form -->
    <view v-if="showCreateForm" class="card form-card">
      <text class="form-title">新建AA账单</text>

      <view class="form-field">
        <text class="field-label">标题</text>
        <view class="field-input-wrap">
          <input
            class="field-input"
            v-model="title"
            placeholder="例如: 聚餐AA"
            placeholder-class="placeholder"
            maxlength="30"
          />
        </view>
      </view>

      <view class="form-field">
        <text class="field-label">总金额</text>
        <view class="field-input-wrap">
          <input
            class="field-input"
            v-model="totalAmount"
            type="digit"
            placeholder="0.00"
            placeholder-class="placeholder"
          />
        </view>
      </view>

      <view class="form-field">
        <text class="field-label">付款人</text>
        <scroll-view scroll-y class="member-scroll">
          <view
            v-for="member in members"
            :key="member.id"
            class="member-option"
            :class="{ active: payerId === member.id }"
            @tap="payerId = member.id"
          >
            <view class="radio-circle" :class="{ checked: payerId === member.id }">
              <view v-if="payerId === member.id" class="radio-dot"></view>
            </view>
            <text class="member-option-name">{{ member.name }}</text>
          </view>
        </scroll-view>
      </view>

      <view class="form-field">
        <text class="field-label">参与成员</text>
        <view class="member-select-grid">
          <view
            v-for="member in members"
            :key="member.id"
            class="member-select-chip"
            :class="{ active: isMemberSelected(member.id) }"
            @tap="toggleMemberSelection(member.id)"
          >
            <text class="member-select-text">{{ member.name }}</text>
          </view>
        </view>
      </view>

      <view class="form-field">
        <text class="field-label">分摊方式</text>
        <view class="split-type-row">
          <view
            class="split-type-option"
            :class="{ active: splitType === 'equal' }"
            @tap="splitType = 'equal'"
          >
            <text class="split-type-text">平均分摊</text>
          </view>
          <view
            class="split-type-option"
            :class="{ active: splitType === 'custom' }"
            @tap="splitType = 'custom'"
          >
            <text class="split-type-text">自定义金额</text>
          </view>
        </view>
      </view>

      <!-- Custom amounts -->
      <view v-if="splitType === 'custom'" class="form-field">
        <text class="field-label">各成员金额</text>
        <view class="custom-amounts">
          <view
            v-for="id in selectedMemberIds"
            :key="id"
            class="custom-amount-row"
          >
            <text class="custom-member-name">{{ getMemberName(id) }}</text>
            <view class="custom-input-wrap">
              <input
                class="custom-input"
                v-model="customAmounts[id]"
                type="digit"
                placeholder="0.00"
                placeholder-class="placeholder"
              />
            </view>
          </view>
        </view>
      </view>

      <view class="form-actions">
        <view class="form-btn cancel" @tap="toggleCreateForm">
          <text class="form-btn-text">取消</text>
        </view>
        <view class="form-btn confirm" @tap="onCreateBill">
          <text class="form-btn-text-primary">创建</text>
        </view>
      </view>
    </view>

    <!-- Bill list -->
    <view class="section-title">AA账单记录</view>

    <view v-if="bills.length > 0" class="card bill-list-card">
      <view
        v-for="bill in bills"
        :key="bill.id"
        class="bill-item"
      >
        <view class="bill-header">
          <view class="bill-info">
            <text class="bill-title">{{ bill.title }}</text>
            <text class="bill-date">{{ formatDate(bill.createdAt) }}</text>
          </view>
          <view class="bill-amount-area">
            <text class="bill-amount">{{ formatAmount(bill.totalAmount) }}</text>
            <text class="bill-payer">付: {{ getMemberName(bill.payerId) }}</text>
          </view>
        </view>

        <view class="bill-status">
          <text class="settle-text" :class="{ settled: isBillSettled(bill) }">
            {{ getSettlementSummary(bill) }}
          </text>
        </view>

        <!-- Settlement details -->
        <view class="settle-list">
          <view
            v-for="(split, idx) in bill.splits"
            :key="split.memberId"
            class="settle-item"
            @tap="toggleSettle(bill, idx)"
          >
            <view class="settle-checkbox" :class="{ checked: split.settled || split.memberId === bill.payerId }">
              <text v-if="split.settled || split.memberId === bill.payerId" class="check-mark">✓</text>
            </view>
            <text class="settle-name">{{ getMemberName(split.memberId) }}</text>
            <text class="settle-amount">{{ formatAmount(split.amount) }}</text>
            <text v-if="split.memberId === bill.payerId" class="payer-tag">付款人</text>
          </view>
        </view>

        <view class="bill-footer">
          <view class="delete-bill-btn" @tap="onDeleteBill(bill)">
            <text class="delete-bill-text">删除</text>
          </view>
        </view>
      </view>
    </view>

    <view v-else class="empty-state">
      <text class="empty-icon">👥</text>
      <text class="empty-text">暂无AA账单</text>
    </view>
  </view>
</template>

<style scoped>
.aa-page {
  min-height: 100vh;
  background: var(--bg);
  padding: 24rpx;
  padding-bottom: 140rpx;
}

.toolbar {
  display: flex;
  flex-direction: row;
  gap: 16rpx;
  margin-bottom: 24rpx;
}

.toolbar-btn {
  flex: 1;
  padding: 22rpx 0;
  border-radius: var(--radius);
  background: var(--card);
  border: 2rpx solid var(--border);
  display: flex;
  align-items: center;
  justify-content: center;
}

.toolbar-btn.primary {
  background: var(--primary);
  border-color: var(--primary);
}

.toolbar-btn-text {
  font-size: 26rpx;
  color: var(--text-primary);
  font-weight: 500;
}

.toolbar-btn-text-primary {
  font-size: 26rpx;
  color: #fff;
  font-weight: 600;
}

/* Member card */
.member-card {
  padding: 28rpx;
}

.member-add-row {
  display: flex;
  flex-direction: row;
  gap: 16rpx;
  margin-bottom: 20rpx;
}

.member-input-wrap {
  flex: 1;
  background: var(--bg);
  border-radius: var(--radius);
  padding: 0 20rpx;
  border: 2rpx solid var(--border);
}

.member-input {
  height: 72rpx;
  font-size: 28rpx;
  color: var(--text-primary);
}

.add-member-btn {
  padding: 0 32rpx;
  background: var(--primary);
  border-radius: var(--radius);
  display: flex;
  align-items: center;
  justify-content: center;
}

.add-member-text {
  color: #fff;
  font-size: 26rpx;
  font-weight: 500;
}

.member-list {
  display: flex;
  flex-direction: row;
  flex-wrap: wrap;
  gap: 12rpx;
}

.member-chip {
  display: flex;
  flex-direction: row;
  align-items: center;
  background: var(--primary-light);
  border-radius: 40rpx;
  padding: 10rpx 20rpx;
  gap: 8rpx;
}

.member-chip-name {
  font-size: 24rpx;
  color: var(--primary);
  font-weight: 500;
}

.member-remove {
  width: 32rpx;
  height: 32rpx;
  display: flex;
  align-items: center;
  justify-content: center;
}

.member-remove-text {
  font-size: 22rpx;
  color: var(--text-tertiary);
}

.member-empty {
  padding: 20rpx;
}

.member-empty-text {
  font-size: 24rpx;
  color: var(--text-tertiary);
}

/* Form card */
.form-card {
  padding: 32rpx 28rpx;
}

.form-title {
  font-size: 32rpx;
  font-weight: 600;
  color: var(--text-primary);
  margin-bottom: 28rpx;
  display: block;
}

.form-field {
  margin-bottom: 24rpx;
}

.field-label {
  font-size: 26rpx;
  color: var(--text-secondary);
  margin-bottom: 12rpx;
  display: block;
  font-weight: 500;
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

.member-scroll {
  max-height: 200rpx;
  background: var(--bg);
  border-radius: var(--radius);
  border: 2rpx solid var(--border);
  padding: 8rpx;
}

.member-option {
  display: flex;
  flex-direction: row;
  align-items: center;
  padding: 16rpx;
  border-radius: 8rpx;
}

.member-option.active {
  background: var(--primary-light);
}

.radio-circle {
  width: 36rpx;
  height: 36rpx;
  border-radius: 50%;
  border: 3rpx solid var(--border);
  display: flex;
  align-items: center;
  justify-content: center;
  margin-right: 16rpx;
}

.radio-circle.checked {
  border-color: var(--primary);
}

.radio-dot {
  width: 20rpx;
  height: 20rpx;
  border-radius: 50%;
  background: var(--primary);
}

.member-option-name {
  font-size: 28rpx;
  color: var(--text-primary);
}

.member-select-grid {
  display: flex;
  flex-direction: row;
  flex-wrap: wrap;
  gap: 12rpx;
}

.member-select-chip {
  padding: 14rpx 28rpx;
  border-radius: 40rpx;
  background: var(--bg);
  border: 2rpx solid var(--border);
}

.member-select-chip.active {
  background: var(--primary-light);
  border-color: var(--primary);
}

.member-select-text {
  font-size: 26rpx;
  color: var(--text-secondary);
}

.member-select-chip.active .member-select-text {
  color: var(--primary);
  font-weight: 500;
}

.split-type-row {
  display: flex;
  flex-direction: row;
  gap: 16rpx;
}

.split-type-option {
  flex: 1;
  padding: 20rpx 0;
  border-radius: var(--radius);
  background: var(--bg);
  border: 2rpx solid var(--border);
  display: flex;
  align-items: center;
  justify-content: center;
}

.split-type-option.active {
  border-color: var(--primary);
  background: var(--primary-light);
}

.split-type-text {
  font-size: 26rpx;
  color: var(--text-secondary);
  font-weight: 500;
}

.split-type-option.active .split-type-text {
  color: var(--primary);
}

.custom-amounts {
  background: var(--bg);
  border-radius: var(--radius);
  padding: 16rpx;
  border: 2rpx solid var(--border);
}

.custom-amount-row {
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: space-between;
  padding: 12rpx 0;
}

.custom-member-name {
  font-size: 26rpx;
  color: var(--text-primary);
  min-width: 120rpx;
}

.custom-input-wrap {
  flex: 1;
  max-width: 200rpx;
  background: var(--card);
  border-radius: 8rpx;
  padding: 0 16rpx;
  border: 1rpx solid var(--border);
}

.custom-input {
  height: 60rpx;
  font-size: 26rpx;
  color: var(--text-primary);
  text-align: right;
}

.form-actions {
  display: flex;
  flex-direction: row;
  gap: 20rpx;
  margin-top: 32rpx;
}

.form-btn {
  flex: 1;
  padding: 24rpx 0;
  border-radius: var(--radius);
  display: flex;
  align-items: center;
  justify-content: center;
}

.form-btn.cancel {
  background: var(--bg);
  border: 2rpx solid var(--border);
}

.form-btn.confirm {
  background: var(--primary);
}

.form-btn-text {
  color: var(--text-secondary);
  font-size: 28rpx;
  font-weight: 500;
}

.form-btn-text-primary {
  color: #fff;
  font-size: 28rpx;
  font-weight: 600;
}

/* Section */
.section-title {
  font-size: 30rpx;
  font-weight: 600;
  color: var(--text-primary);
  margin: 24rpx 4rpx 16rpx;
}

/* Bill list */
.bill-list-card {
  padding: 0 28rpx;
}

.bill-item {
  padding: 24rpx 0;
  border-bottom: 1rpx solid var(--border);
}

.bill-item:last-child {
  border-bottom: none;
}

.bill-header {
  display: flex;
  flex-direction: row;
  align-items: flex-start;
  justify-content: space-between;
  margin-bottom: 12rpx;
}

.bill-info {
  display: flex;
  flex-direction: column;
}

.bill-title {
  font-size: 30rpx;
  font-weight: 600;
  color: var(--text-primary);
}

.bill-date {
  font-size: 22rpx;
  color: var(--text-tertiary);
  margin-top: 4rpx;
}

.bill-amount-area {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
}

.bill-amount {
  font-size: 34rpx;
  font-weight: 700;
  color: var(--text-primary);
}

.bill-payer {
  font-size: 22rpx;
  color: var(--text-secondary);
  margin-top: 4rpx;
}

.bill-status {
  margin-bottom: 12rpx;
}

.settle-text {
  font-size: 24rpx;
  color: #F59E0B;
  font-weight: 500;
}

.settle-text.settled {
  color: var(--income);
}

.settle-list {
  background: var(--bg);
  border-radius: var(--radius);
  padding: 12rpx 16rpx;
  margin-bottom: 12rpx;
}

.settle-item {
  display: flex;
  flex-direction: row;
  align-items: center;
  padding: 10rpx 0;
}

.settle-checkbox {
  width: 36rpx;
  height: 36rpx;
  border-radius: 8rpx;
  border: 2rpx solid var(--border);
  display: flex;
  align-items: center;
  justify-content: center;
  margin-right: 12rpx;
  flex-shrink: 0;
}

.settle-checkbox.checked {
  background: var(--income);
  border-color: var(--income);
}

.check-mark {
  font-size: 22rpx;
  color: #fff;
  font-weight: 700;
}

.settle-name {
  font-size: 26rpx;
  color: var(--text-primary);
  flex: 1;
}

.settle-amount {
  font-size: 26rpx;
  color: var(--text-secondary);
  font-weight: 500;
  margin-right: 12rpx;
}

.payer-tag {
  font-size: 20rpx;
  color: var(--primary);
  background: var(--primary-light);
  padding: 4rpx 10rpx;
  border-radius: 4rpx;
}

.bill-footer {
  display: flex;
  flex-direction: row;
  justify-content: flex-end;
}

.delete-bill-btn {
  padding: 8rpx 20rpx;
}

.delete-bill-text {
  font-size: 24rpx;
  color: #EF4444;
}

/* Empty state */
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 80rpx 40rpx;
}

.empty-icon {
  font-size: 100rpx;
  margin-bottom: 16rpx;
}

.empty-text {
  font-size: 28rpx;
  color: var(--text-tertiary);
}
</style>
