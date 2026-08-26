<script setup lang="ts">
import { ref, computed } from 'vue' // Vue 响应式：ref 声明响应式数据，computed 派生计算值
import { useCategoryStore } from '../../stores' // 分类状态仓库
import { uuid } from '../../utils/uuid' // 生成唯一 ID
import { onLoad } from '@dcloudio/uni-app' // uni-app 生命周期钩子：onLoad 页面加载时触发
import type { Category, TransactionType } from '../../types' // 分类与交易类型的类型定义

const categoryStore = useCategoryStore()

const editId = ref<string>('')
const name = ref('')
const icon = ref('📌')
const kind = ref<TransactionType>('expense')

const isEdit = computed(() => !!editId.value)

const emojiList = [
  '🍜', '🍔', '🍕', '☕', '🍰', '🍺', '🥗', '🍱',
  '🚗', '🚌', '✈️', '🚕', '🚇', '🛵', '⛽', '🅿️',
  '🛒', '👕', '👟', '💄', '🎬', '🎮', '📚', '💊',
  '🏠', '💡', '📱', '🧴', '🎁', '🐾', '💻', '⚽',
  '💰', '🏆', '📈', '💼', '🧧', '🧾', '↩️', '🏦',
  '🎵', '🎨', '🌸', '🐱', '🐶', '🏋️', '🧳', '🎂',
  '🤝', '💎', '🔧', '📦', '🏥', '🎓', '💍', '📌',
]

// Use onLoad lifecycle from uni-app
onLoad((options: any) => {
  if (options?.id) {
    editId.value = options.id
    const cat = categoryStore.getById(options.id)
    if (cat) {
      name.value = cat.name
      icon.value = cat.icon
      kind.value = cat.kind
    }
    uni.setNavigationBarTitle({ titleText: '编辑分类' })
  } else {
    if (options?.kind) {
      kind.value = options.kind as TransactionType
    }
    uni.setNavigationBarTitle({ titleText: '新增分类' })
  }
})

function selectIcon(emoji: string) {
  icon.value = emoji
}

function switchKind(k: TransactionType) {
  kind.value = k
}

function onSave() {
  if (!name.value.trim()) {
    uni.showToast({ title: '请输入分类名称', icon: 'none' })
    return
  }

  if (isEdit.value) {
    const cat = categoryStore.getById(editId.value)
    if (cat) {
      categoryStore.updateCategory({
        ...cat,
        name: name.value.trim(),
        icon: icon.value,
        kind: kind.value,
      })
    }
  } else {
    const maxSort = (kind.value === 'expense'
      ? categoryStore.expenseCategories
      : categoryStore.incomeCategories
    ).reduce((max, c) => Math.max(max, c.sortOrder), 0)

    categoryStore.addCategory({
      name: name.value.trim(),
      icon: icon.value,
      kind: kind.value,
      sortOrder: maxSort + 1,
      parentId: null,
      level: 1,
    })
  }

  uni.showToast({ title: '保存成功', icon: 'success' })
  setTimeout(() => uni.navigateBack(), 800)
}
</script>

<template>
  <view class="edit-page">
    <!-- Kind selector -->
    <view class="section">
      <text class="section-label">类型</text>
      <view class="kind-selector">
        <view
          class="kind-option"
          :class="{ active: kind === 'expense' }"
          @tap="switchKind('expense')"
        >
          <text class="kind-text">支出</text>
        </view>
        <view
          class="kind-option"
          :class="{ active: kind === 'income' }"
          @tap="switchKind('income')"
        >
          <text class="kind-text">收入</text>
        </view>
      </view>
    </view>

    <!-- Name input -->
    <view class="section">
      <text class="section-label">名称</text>
      <view class="input-wrap">
        <input
          class="name-input"
          v-model="name"
          placeholder="请输入分类名称"
          placeholder-class="placeholder"
          maxlength="10"
        />
      </view>
    </view>

    <!-- Icon picker -->
    <view class="section">
      <text class="section-label">图标</text>
      <view class="icon-preview-area">
        <view class="icon-preview">
          <text class="icon-preview-text">{{ icon }}</text>
        </view>
      </view>
      <view class="emoji-grid">
        <view
          v-for="emoji in emojiList"
          :key="emoji"
          class="emoji-cell"
          :class="{ selected: icon === emoji }"
          @tap="selectIcon(emoji)"
        >
          <text class="emoji-text">{{ emoji }}</text>
        </view>
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

.kind-selector {
  display: flex;
  flex-direction: row;
  gap: 20rpx;
}

.kind-option {
  flex: 1;
  padding: 24rpx 0;
  border-radius: var(--radius);
  background: var(--card);
  border: 2rpx solid var(--border);
  display: flex;
  align-items: center;
  justify-content: center;
}

.kind-option.active {
  border-color: var(--primary);
  background: var(--primary-light);
}

.kind-text {
  font-size: 30rpx;
  color: var(--text-secondary);
  font-weight: 500;
}

.kind-option.active .kind-text {
  color: var(--primary);
  font-weight: 600;
}

.input-wrap {
  background: var(--card);
  border-radius: var(--radius);
  border: 2rpx solid var(--border);
  padding: 0 24rpx;
}

.name-input {
  height: 88rpx;
  font-size: 30rpx;
  color: var(--text-primary);
}

.placeholder {
  color: var(--text-tertiary);
}

.icon-preview-area {
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 24rpx;
}

.icon-preview {
  width: 120rpx;
  height: 120rpx;
  border-radius: 24rpx;
  background: var(--primary-light);
  display: flex;
  align-items: center;
  justify-content: center;
  border: 3rpx solid var(--primary);
}

.icon-preview-text {
  font-size: 56rpx;
}

.emoji-grid {
  display: flex;
  flex-direction: row;
  flex-wrap: wrap;
  background: var(--card);
  border-radius: var(--radius);
  padding: 16rpx;
  border: 2rpx solid var(--border);
}

.emoji-cell {
  width: 88rpx;
  height: 88rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 12rpx;
}

.emoji-cell.selected {
  background: var(--primary-light);
}

.emoji-text {
  font-size: 40rpx;
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
