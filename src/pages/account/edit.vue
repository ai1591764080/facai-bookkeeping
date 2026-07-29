<script setup lang="ts">
import { ref, computed } from 'vue'
import { useAccountStore } from '../../stores'
import { uuid } from '../../utils/uuid'
import { onLoad } from '@dcloudio/uni-app'
import type { AccountType } from '../../types'

const accountStore = useAccountStore()

const editId = ref('')
const name = ref('')
const type = ref<AccountType>('bank_card')
const icon = ref('💳')
const initialBalance = ref('0')
const currentBalance = ref('0')

const isEdit = computed(() => !!editId.value)

interface TypeOption {
  value: AccountType
  label: string
  icon: string
}

const typeOptions: TypeOption[] = [
  { value: 'cash', label: '现金', icon: '💵' },
  { value: 'bank_card', label: '银行卡', icon: '💳' },
  { value: 'credit_card', label: '信用卡', icon: '💎' },
  { value: 'alipay', label: '支付宝', icon: '📱' },
  { value: 'wechat', label: '微信', icon: '💬' },
  { value: 'investment', label: '投资账户', icon: '📈' },
  { value: 'loan', label: '贷款', icon: '🏦' },
  { value: 'other', label: '其他', icon: '📌' },
]

onLoad((options: any) => {
  if (options?.id) {
    editId.value = options.id
    const acc = accountStore.getById(options.id)
    if (acc) {
      name.value = acc.name
      type.value = acc.type
      icon.value = acc.icon
      initialBalance.value = String(acc.initialBalance)
      currentBalance.value = String(acc.balance)
    }
    uni.setNavigationBarTitle({ titleText: '编辑账户' })
  } else {
    uni.setNavigationBarTitle({ titleText: '新增账户' })
  }
})

function selectType(opt: TypeOption) {
  type.value = opt.value
  icon.value = opt.icon
}

function onSave() {
  if (!name.value.trim()) {
    uni.showToast({ title: '请输入账户名称', icon: 'none' })
    return
  }

  const initBal = parseFloat(initialBalance.value) || 0
  const curBal = parseFloat(currentBalance.value) || 0

  if (isEdit.value) {
    const acc = accountStore.getById(editId.value)
    if (acc) {
      accountStore.update({
        ...acc,
        name: name.value.trim(),
        type: type.value,
        icon: icon.value,
        initialBalance: initBal,
        balance: curBal,
      })
    }
  } else {
    const maxSort = accountStore.accounts.reduce((max, a) => Math.max(max, a.sortOrder), 0)
    accountStore.add({
      ledgerId: '',
      name: name.value.trim(),
      type: type.value,
      icon: icon.value,
      initialBalance: initBal,
      balance: curBal,
      sortOrder: maxSort + 1,
      hidden: false,
    })
  }

  uni.showToast({ title: '保存成功', icon: 'success' })
  setTimeout(() => uni.navigateBack(), 800)
}
</script>

<template>
  <view class="edit-page">
    <!-- Name input -->
    <view class="section">
      <text class="section-label">账户名称</text>
      <view class="input-wrap">
        <input
          class="text-input"
          v-model="name"
          placeholder="请输入账户名称"
          placeholder-class="placeholder"
          maxlength="20"
        />
      </view>
    </view>

    <!-- Type picker -->
    <view class="section">
      <text class="section-label">账户类型</text>
      <view class="type-grid">
        <view
          v-for="opt in typeOptions"
          :key="opt.value"
          class="type-cell"
          :class="{ active: type === opt.value }"
          @tap="selectType(opt)"
        >
          <text class="type-icon">{{ opt.icon }}</text>
          <text class="type-label">{{ opt.label }}</text>
        </view>
      </view>
    </view>

    <!-- Initial balance -->
    <view class="section">
      <text class="section-label">初始余额</text>
      <view class="input-wrap">
        <input
          class="text-input"
          v-model="initialBalance"
          type="digit"
          placeholder="0.00"
          placeholder-class="placeholder"
        />
      </view>
    </view>

    <!-- Current balance -->
    <view class="section">
      <text class="section-label">当前余额</text>
      <view class="input-wrap">
        <input
          class="text-input"
          v-model="currentBalance"
          type="digit"
          placeholder="0.00"
          placeholder-class="placeholder"
        />
      </view>
    </view>

    <!-- Save button -->
    <view class="save-area">
      <view class="save-btn" @tap="onSave">
        <text class="save-text">保存</text>
      </view>
    </view>
  </view>
</template>

<style scoped>
.edit-page {
  min-height: 100vh;
  background: var(--bg);
  padding: 24rpx;
  padding-bottom: 140rpx;
}

.section {
  margin-bottom: 32rpx;
}

.section-label {
  font-size: 28rpx;
  font-weight: 600;
  color: var(--text-primary);
  margin-bottom: 16rpx;
  display: block;
}

.input-wrap {
  background: var(--card);
  border-radius: var(--radius);
  border: 2rpx solid var(--border);
  padding: 0 24rpx;
}

.text-input {
  height: 88rpx;
  font-size: 30rpx;
  color: var(--text-primary);
}

.placeholder {
  color: var(--text-tertiary);
}

.type-grid {
  display: flex;
  flex-direction: row;
  flex-wrap: wrap;
  gap: 16rpx;
}

.type-cell {
  width: calc(25% - 12rpx);
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 24rpx 0;
  background: var(--card);
  border-radius: var(--radius);
  border: 2rpx solid var(--border);
}

.type-cell.active {
  border-color: var(--primary);
  background: var(--primary-light);
}

.type-icon {
  font-size: 40rpx;
  margin-bottom: 8rpx;
}

.type-label {
  font-size: 22rpx;
  color: var(--text-secondary);
  font-weight: 500;
}

.type-cell.active .type-label {
  color: var(--primary);
}

.save-area {
  margin-top: 48rpx;
}

.save-btn {
  background: var(--primary);
  border-radius: var(--radius);
  padding: 28rpx 0;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 8rpx 24rpx rgba(79, 110, 247, 0.3);
}

.save-text {
  color: #fff;
  font-size: 32rpx;
  font-weight: 600;
}
</style>
