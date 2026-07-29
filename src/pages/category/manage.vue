<script setup lang="ts">
import { ref, computed } from 'vue'
import { useCategoryStore } from '../../stores'
import type { Category } from '../../types'

const categoryStore = useCategoryStore()

const activeTab = ref<'expense' | 'income'>('expense')

const currentCategories = computed<Category[]>(() => {
  return activeTab.value === 'expense'
    ? categoryStore.expenseCategories
    : categoryStore.incomeCategories
})

function switchTab(tab: 'expense' | 'income') {
  activeTab.value = tab
}

function onEditCategory(cat: Category) {
  uni.navigateTo({ url: `/pages/category/edit?id=${cat.id}` })
}

function onAddCategory() {
  uni.navigateTo({ url: `/pages/category/edit?kind=${activeTab.value}` })
}

function onDeleteCategory(cat: Category) {
  uni.showModal({
    title: '确认删除',
    content: `确定要删除分类「${cat.name}」吗？`,
    success(res) {
      if (res.confirm) {
        categoryStore.removeCategory(cat.id)
        uni.showToast({ title: '已删除', icon: 'success' })
      }
    }
  })
}

// Long press to delete
const longPressId = ref<string | null>(null)

function onLongPress(cat: Category) {
  longPressId.value = cat.id
  onDeleteCategory(cat)
}
</script>

<template>
  <view class="manage-page">
    <!-- Tabs -->
    <view class="tabs">
      <view
        class="tab-item"
        :class="{ active: activeTab === 'expense' }"
        @tap="switchTab('expense')"
      >
        <text class="tab-text">支出分类</text>
        <view v-if="activeTab === 'expense'" class="tab-indicator"></view>
      </view>
      <view
        class="tab-item"
        :class="{ active: activeTab === 'income' }"
        @tap="switchTab('income')"
      >
        <text class="tab-text">收入分类</text>
        <view v-if="activeTab === 'income'" class="tab-indicator"></view>
      </view>
    </view>

    <!-- Category List -->
    <view class="card list-card">
      <view
        v-for="cat in currentCategories"
        :key="cat.id"
        class="category-item"
        @longpress="onLongPress(cat)"
      >
        <view class="cat-left" @tap="onEditCategory(cat)">
          <view class="cat-icon-wrap">
            <text class="cat-icon">{{ cat.icon }}</text>
          </view>
          <text class="cat-name">{{ cat.name }}</text>
        </view>
        <view class="cat-actions">
          <view class="action-btn edit-btn" @tap="onEditCategory(cat)">
            <text class="action-text">编辑</text>
          </view>
          <view class="action-btn delete-btn" @tap="onDeleteCategory(cat)">
            <text class="action-text">删除</text>
          </view>
        </view>
      </view>

      <view v-if="currentCategories.length === 0" class="empty-state">
        <text class="empty-icon">📂</text>
        <text class="empty-text">暂无分类</text>
      </view>
    </view>

    <!-- Add button -->
    <view class="fab-area">
      <view class="fab-btn" @tap="onAddCategory">
        <text class="fab-text">+ 新增分类</text>
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

.tabs {
  display: flex;
  flex-direction: row;
  background: var(--card);
  padding: 0 24rpx;
  box-shadow: 0 2rpx 8rpx var(--shadow);
}

.tab-item {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 28rpx 0 20rpx;
  position: relative;
}

.tab-text {
  font-size: 30rpx;
  color: var(--text-secondary);
  font-weight: 500;
}

.tab-item.active .tab-text {
  color: var(--primary);
  font-weight: 600;
}

.tab-indicator {
  position: absolute;
  bottom: 0;
  width: 60rpx;
  height: 6rpx;
  background: var(--primary);
  border-radius: 3rpx;
}

.list-card {
  margin: 24rpx;
  padding: 0 28rpx;
}

.category-item {
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: space-between;
  padding: 24rpx 0;
  border-bottom: 1rpx solid var(--border);
}

.category-item:last-child {
  border-bottom: none;
}

.cat-left {
  display: flex;
  flex-direction: row;
  align-items: center;
  flex: 1;
}

.cat-icon-wrap {
  width: 64rpx;
  height: 64rpx;
  border-radius: 16rpx;
  background: var(--bg);
  display: flex;
  align-items: center;
  justify-content: center;
  margin-right: 20rpx;
}

.cat-icon {
  font-size: 32rpx;
}

.cat-name {
  font-size: 30rpx;
  color: var(--text-primary);
  font-weight: 500;
}

.cat-actions {
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: 16rpx;
}

.action-btn {
  padding: 10rpx 24rpx;
  border-radius: 8rpx;
  display: flex;
  align-items: center;
  justify-content: center;
}

.edit-btn {
  background: var(--primary-light);
}

.edit-btn .action-text {
  color: var(--primary);
  font-size: 24rpx;
  font-weight: 500;
}

.delete-btn {
  background: #FEE2E2;
}

.delete-btn .action-text {
  color: #EF4444;
  font-size: 24rpx;
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
