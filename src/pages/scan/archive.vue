<script setup lang="ts">
import { computed } from 'vue' // Vue 响应式：computed 派生计算值
import { useCategoryStore, useAccountStore, useLedgerStore, useTransactionStore, useScanStore } from '../../stores' // 分类/账户/账本/交易/扫描状态仓库

const categoryStore = useCategoryStore()
const accountStore = useAccountStore()
const ledgerStore = useLedgerStore()
const txStore = useTransactionStore()
const scanStore = useScanStore()

const ctypeLabels = { expense: '支出', income: '收入', transfer: '转账' } as const
const statusLabels = { pending: '待确认', archived: '已归档', rejected: '已忽略' } as const
const statusColor = { pending: '#f59e0b', archived: '#10b981', rejected: '#9ca3af' } as const

const pendingList = computed(() => scanStore.records.filter((r) => r.status === 'pending'))
const archivedList = computed(() => scanStore.records.filter((r) => r.status === 'archived'))
const otherList = computed(() => scanStore.records.filter((r) => r.status === 'rejected'))

function recAmount(rec: any): { expense: number; income: number } {
  let expense = 0
  let income = 0
  for (const c of rec.candidates) {
    const a = Number(c.amount) || 0
    if (c.type === 'expense') expense += a
    else if (c.type === 'income') income += a
  }
  return { expense, income }
}

function agreeArchive(rec: any) {
  uni.showModal({
    title: '同意归档记账',
    content: `确认将这条识别记录写入账本并计入统计？`,
    success: (res) => {
      if (!res.confirm) return
      const result = scanStore.archive(
        rec.id,
        categoryStore.categories,
        accountStore.visibleAccounts,
        ledgerStore.currentId,
        (tx) => txStore.add(tx)
      )
      uni.showToast({ title: `已归档 ${result.created} 条账单`, icon: 'success' })
    },
  })
}

function rejectRec(rec: any) {
  uni.showModal({
    title: '忽略此记录',
    content: '忽略后将不计入统计，可从列表中移除。',
    success: (res) => {
      if (!res.confirm) return
      scanStore.reject(rec.id)
    },
  })
}

function deleteRec(rec: any) {
  // 已归档的记录同时删除它生成的账单，否则记录没了、账还在
  const linked = (rec.transactionIds || []).filter((id: string) => txStore.transactions.some((t) => t.id === id))
  const tip = linked.length > 0
    ? `确定删除这条扫描记录吗？同时会删除它已归档的 ${linked.length} 笔账单（账户余额将同步回滚）。`
    : '确定删除这条扫描记录吗？'
  uni.showModal({
    title: '删除记录',
    content: tip,
    success: (res) => {
      if (!res.confirm) return
      linked.forEach((id: string) => txStore.remove(id))
      scanStore.removeRecord(rec.id)
      uni.showToast({ title: '已删除', icon: 'success' })
    },
  })
}

function fmtDate(iso: string): string {
  return iso ? iso.slice(0, 10) : ''
}
</script>

<template>
  <view class="archive-page">
    <!-- 待确认区 -->
    <view class="section">
      <view class="section-head">
        <text class="section-title">⏳ 待确认归档</text>
        <text class="section-count">{{ pendingList.length }}</text>
      </view>
      <view class="empty" v-if="pendingList.length === 0">
        <text>暂无待确认的记录</text>
      </view>
      <view class="rec-card" v-for="rec in pendingList" :key="rec.id">
        <view class="rec-head">
          <text class="status-badge" :style="{ color: statusColor[rec.status] }">{{ statusLabels[rec.status] }}</text>
          <text class="rec-date">{{ fmtDate(rec.createdAt) }}</text>
        </view>
        <view class="cand-list">
          <view class="cand-row" v-for="(c, i) in rec.candidates" :key="i">
            <text class="cand-type" :class="c.type">{{ ctypeLabels[c.type] }}</text>
            <text class="cand-note">{{ c.note || '无备注' }}</text>
            <text class="cand-amount" :class="c.type">¥{{ (Number(c.amount) || 0).toFixed(2) }}</text>
          </view>
        </view>
        <view class="rec-total">
          <text class="total-expense">支 ¥{{ recAmount(rec).expense.toFixed(2) }}</text>
          <text class="total-income">收 ¥{{ recAmount(rec).income.toFixed(2) }}</text>
        </view>
        <view class="rec-actions">
          <button class="act act-ignore" @tap="rejectRec(rec)">忽略</button>
          <button class="act act-ok" @tap="agreeArchive(rec)">同意归档</button>
        </view>
      </view>
    </view>

    <!-- 已归档区 -->
    <view class="section" v-if="archivedList.length > 0">
      <view class="section-head">
        <text class="section-title">✅ 已归档（已计入统计）</text>
      </view>
      <view class="rec-card" v-for="rec in archivedList" :key="rec.id">
        <view class="rec-head">
          <text class="status-badge" :style="{ color: statusColor.archived }">{{ statusLabels.archived }}</text>
          <text class="rec-date">{{ fmtDate(rec.archivedAt || rec.createdAt) }}</text>
        </view>
        <view class="cand-list">
          <view class="cand-row" v-for="(c, i) in rec.candidates" :key="i">
            <text class="cand-type" :class="c.type">{{ ctypeLabels[c.type] }}</text>
            <text class="cand-note">{{ c.note || '无备注' }}</text>
            <text class="cand-amount" :class="c.type">¥{{ (Number(c.amount) || 0).toFixed(2) }}</text>
          </view>
        </view>
        <view class="rec-actions">
          <button class="act act-del" @tap="deleteRec(rec)">删除</button>
        </view>
      </view>
    </view>

    <!-- 已忽略区 -->
    <view class="section" v-if="otherList.length > 0">
      <view class="section-head">
        <text class="section-title">🚫 已忽略</text>
      </view>
      <view class="rec-card muted" v-for="rec in otherList" :key="rec.id">
        <view class="rec-head">
          <text class="status-badge" :style="{ color: statusColor.rejected }">{{ statusLabels.rejected }}</text>
          <text class="rec-date">{{ fmtDate(rec.createdAt) }}</text>
        </view>
        <view class="rec-actions">
          <button class="act act-del" @tap="deleteRec(rec)">删除</button>
        </view>
      </view>
    </view>

    <view class="foot-tip">识别结果默认不计入统计，需要你「同意归档」后才会写入账本。</view>
  </view>
</template>

<style scoped>
.archive-page { min-height: 100vh; background: var(--bg); padding: 24rpx 24rpx 60rpx; }
.section { margin-bottom: 40rpx; }
.section-head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 16rpx; padding: 0 8rpx; }
.section-title { font-size: 30rpx; font-weight: 600; color: var(--text-primary); }
.section-count { background: var(--primary); color: #fff; border-radius: 999rpx; font-size: 24rpx; padding: 2rpx 18rpx; }
.empty { text-align: center; color: var(--text-tertiary); padding: 40rpx 0; font-size: 26rpx; }

.rec-card { background: var(--card-bg); border-radius: 20rpx; padding: 24rpx; margin-bottom: 20rpx; }
.rec-card.muted { opacity: 0.7; }
.rec-head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 16rpx; }
.status-badge { font-size: 26rpx; font-weight: 600; }
.rec-date { font-size: 24rpx; color: var(--text-tertiary); }

.cand-list { border-top: 1rpx solid var(--border); padding-top: 8rpx; }
.cand-row { display: flex; align-items: center; padding: 14rpx 0; }
.cand-type { font-size: 24rpx; padding: 2rpx 14rpx; border-radius: 8rpx; margin-right: 16rpx; flex-shrink: 0; }
.cand-type.expense { background: rgba(239,68,68,0.12); color: #ef4444; }
.cand-type.income { background: rgba(16,185,129,0.12); color: #10b981; }
.cand-note { flex: 1; font-size: 26rpx; color: var(--text-primary); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.cand-amount { font-size: 26rpx; font-weight: 600; margin-left: 12rpx; }
.cand-amount.expense { color: #ef4444; }
.cand-amount.income { color: #10b981; }

.rec-total { display: flex; justify-content: flex-end; gap: 24rpx; padding-top: 12rpx; }
.total-expense { font-size: 26rpx; color: #ef4444; }
.total-income { font-size: 26rpx; color: #10b981; }

.rec-actions { display: flex; flex-direction: row; gap: 20rpx; margin-top: 20rpx; }
.act { flex: 1; font-size: 28rpx; border-radius: 12rpx; padding: 0; line-height: 72rpx; height: 72rpx; }
.act-ignore { background: var(--bg); color: var(--text-secondary); border: 1rpx solid var(--border); }
.act-ok { background: var(--primary); color: #fff; }
.act-del { background: var(--bg); color: #ef4444; border: 1rpx solid var(--border); }

.foot-tip { text-align: center; font-size: 24rpx; color: var(--text-tertiary); padding-top: 20rpx; }
</style>
