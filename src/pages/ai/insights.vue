<template>
  <view class="page">
    <!-- Nav Bar -->
    <view class="nav-bar" :style="{ paddingTop: statusBarHeight + 'px' }">
      <view class="nav-bar-inner">
        <view class="nav-back" @tap="goBack">
          <text class="nav-back-icon">&#10094;</text>
        </view>
        <text class="nav-title">AI 消费洞察</text>
        <view class="nav-action" @tap="refresh">
          <text class="nav-action-text">刷新</text>
        </view>
      </view>
    </view>
    <view :style="{ height: (statusBarHeight + 44) + 'px' }" />

    <!-- Content -->
    <scroll-view scroll-y class="content">
      <!-- Quick Stats -->
      <view class="card stats-card">
        <view class="stats-row">
          <view class="stats-item">
            <text class="stats-value text-expense">¥{{ formatAmount(monthExpense) }}</text>
            <text class="stats-label">本月支出</text>
          </view>
          <view class="stats-item">
            <text class="stats-value text-income">¥{{ formatAmount(monthIncome) }}</text>
            <text class="stats-label">本月收入</text>
          </view>
          <view class="stats-item">
            <text class="stats-value">¥{{ formatAmount(monthIncome - monthExpense) }}</text>
            <text class="stats-label">结余</text>
          </view>
        </view>
      </view>

      <!-- AI Insights -->
      <view class="card insights-card">
        <view class="card-header">
          <text class="section-title">🤖 AI 洞察报告</text>
          <text v-if="cacheInfo" class="cache-info">{{ cacheInfo }}</text>
        </view>

        <!-- Loading -->
        <view v-if="loading" class="loading-area">
          <view class="loading-spinner" />
          <text class="loading-text">AI 正在分析你的消费数据...</text>
        </view>

        <!-- Error -->
        <view v-else-if="error" class="error-area">
          <text class="error-icon">⚠️</text>
          <text class="error-text">{{ error }}</text>
          <view class="btn-primary error-btn" @tap="generateInsights">重新生成</view>
        </view>

        <!-- Report -->
        <view v-else-if="report" class="report-content">
          <text class="report-text" :user-select="true">{{ report }}</text>
        </view>

        <!-- Empty -->
        <view v-else class="empty-area">
          <text class="empty-icon">📊</text>
          <text class="empty-text">点击下方按钮生成 AI 分析报告</text>
          <view class="btn-primary" @tap="generateInsights">生成报告</view>
        </view>
      </view>

      <!-- Budget Prediction Card -->
      <view class="card prediction-card">
        <view class="card-header">
          <text class="section-title">📈 预算智能预测</text>
        </view>

        <view v-if="budgetLoading" class="loading-area">
          <view class="loading-spinner" />
          <text class="loading-text">正在预测本月支出...</text>
        </view>

        <view v-else-if="budgetReport" class="report-content">
          <text class="report-text" :user-select="true">{{ budgetReport }}</text>
        </view>

        <view v-else class="empty-area">
          <text class="empty-icon">🔮</text>
          <text class="empty-text">基于历史数据预测本月支出</text>
          <view class="btn-primary" @tap="generatePrediction">开始预测</view>
        </view>
      </view>

      <!-- Quick Actions -->
      <view class="card">
        <text class="section-title">💡 快速分析</text>
        <view class="action-grid">
          <view class="action-item" @tap="quickAsk('这个月哪个分类花得最多？为什么？')">
            <text class="action-icon">🏷️</text>
            <text class="action-text">分类分析</text>
          </view>
          <view class="action-item" @tap="quickAsk('我的消费习惯有什么不好的地方？')">
            <text class="action-icon">🔍</text>
            <text class="action-text">习惯诊断</text>
          </view>
          <view class="action-item" @tap="quickAsk('给我推荐3条具体的省钱方法')">
            <text class="action-icon">💰</text>
            <text class="action-text">省钱攻略</text>
          </view>
          <view class="action-item" @tap="quickAsk('帮我做一份简单的下月预算计划')">
            <text class="action-icon">📋</text>
            <text class="action-text">预算规划</text>
          </view>
        </view>
      </view>

      <view style="height: 60rpx;" />
    </scroll-view>

    <VoiceCommander />
  </view>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import VoiceCommander from '../../components/VoiceCommander.vue'
import { useTransactionStore, useCategoryStore, useAccountStore, useLedgerStore, useAiStore, useBudgetStore } from '../../stores'
import { formatAmount } from '../../utils/format'
import { generateSpendingInsights, predictBudget, hasApiKey } from '../../utils/ai'

const txStore = useTransactionStore()
const catStore = useCategoryStore()
const accStore = useAccountStore()
const ledgerStore = useLedgerStore()
const aiStore = useAiStore()
const budgetStore = useBudgetStore()

const statusBarHeight = ref(0)
const loading = ref(false)
const error = ref('')
const report = ref(aiStore.insightsCache || '')
const budgetLoading = ref(false)
const budgetReport = ref(aiStore.budgetPrediction || '')

uni.getSystemInfo({ success(res) { statusBarHeight.value = res.statusBarHeight || 0 } })

const now = new Date()
const monthExpense = computed(() => txStore.monthlyTotal(now.getFullYear(), now.getMonth(), 'expense', ledgerStore.currentId))
const monthIncome = computed(() => txStore.monthlyTotal(now.getFullYear(), now.getMonth(), 'income', ledgerStore.currentId))

const cacheInfo = computed(() => {
  if (aiStore.isInsightsCacheValid()) {
    const t = new Date(aiStore.insightsCacheTime)
    return `缓存于 ${t.getHours()}:${String(t.getMinutes()).padStart(2, '0')}`
  }
  return ''
})

function goBack() { uni.navigateBack() }

async function generateInsights() {
  if (!hasApiKey()) {
    uni.showModal({ title: '未配置 API Key', content: '请先在设置中配置DeepSeek API Key', confirmText: '去设置', success(res) { if (res.confirm) uni.navigateTo({ url: '/pages/ai/settings' }) } })
    return
  }
  if (aiStore.isInsightsCacheValid()) {
    report.value = aiStore.insightsCache
    return
  }
  loading.value = true
  error.value = ''
  try {
    const result = await generateSpendingInsights(txStore.transactions, catStore.categories, accStore.accounts)
    report.value = result
    aiStore.setInsightsCache(result)
  } catch (e: any) {
    error.value = e.message || '生成失败'
  } finally {
    loading.value = false
  }
}

async function generatePrediction() {
  if (!hasApiKey()) {
    uni.showModal({ title: '未配置 API Key', content: '请先在设置中配置DeepSeek API Key', confirmText: '去设置', success(res) { if (res.confirm) uni.navigateTo({ url: '/pages/ai/settings' }) } })
    return
  }
  if (aiStore.isBudgetPredictionValid()) {
    budgetReport.value = aiStore.budgetPrediction
    return
  }
  budgetLoading.value = true
  const budgets = budgetStore.getByLedger(ledgerStore.currentId)
  const totalBudget = budgets.find((b) => b.type === 'total')?.amount || 5000
  try {
    const result = await predictBudget(txStore.transactions, catStore.categories, totalBudget)
    budgetReport.value = result
    aiStore.setBudgetPrediction(result)
  } catch (e: any) {
    budgetReport.value = `预测失败: ${e.message}`
  } finally {
    budgetLoading.value = false
  }
}

function quickAsk(question: string) {
  aiStore.clearChat()
  aiStore.addChatMessage('user', question)
  uni.navigateTo({ url: '/pages/ai/chat' })
}

function refresh() {
  report.value = ''
  budgetReport.value = ''
  aiStore.setInsightsCache('')
  aiStore.setBudgetPrediction('')
  generateInsights()
  generatePrediction()
}
</script>

<style scoped>
.page {
  min-height: 100vh;
  background: var(--bg);
}

.nav-bar {
  position: fixed;
  top: 0; left: 0; right: 0;
  z-index: 100;
  background: var(--card);
  box-shadow: 0 2rpx 12rpx var(--shadow);
}

.nav-bar-inner {
  height: 88rpx;
  display: flex; align-items: center; justify-content: space-between;
  padding: 0 24rpx;
}

.nav-back { width: 60rpx; height: 60rpx; display: flex; align-items: center; justify-content: center; }
.nav-back-icon { font-size: 36rpx; color: var(--text-primary); }
.nav-title { font-size: 32rpx; font-weight: 600; color: var(--text-primary); }
.nav-action { padding: 8rpx 16rpx; }
.nav-action-text { font-size: 26rpx; color: var(--primary); }

.content { padding: 24rpx; box-sizing: border-box; }

.card-header {
  display: flex; align-items: center; justify-content: space-between;
  margin-bottom: 20rpx;
}

.cache-info { font-size: 22rpx; color: var(--text-tertiary); }

/* Stats */
.stats-card {
  background: linear-gradient(135deg, var(--primary), var(--primary-dark));
  box-shadow: 0 8rpx 24rpx rgba(79, 110, 247, 0.25);
}

.stats-row { display: flex; justify-content: space-around; }

.stats-item {
  display: flex; flex-direction: column; align-items: center;
}

.stats-value { font-size: 36rpx; font-weight: 700; color: #fff; }
.stats-label { font-size: 24rpx; color: rgba(255,255,255,0.7); margin-top: 8rpx; }

/* Loading */
.loading-area {
  display: flex; flex-direction: column; align-items: center;
  padding: 60rpx 0;
}

.loading-spinner {
  width: 60rpx; height: 60rpx;
  border: 4rpx solid var(--border);
  border-top-color: var(--primary);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
  margin-bottom: 20rpx;
}

@keyframes spin { to { transform: rotate(360deg); } }

.loading-text { font-size: 26rpx; color: var(--text-secondary); }

/* Error */
.error-area {
  display: flex; flex-direction: column; align-items: center;
  padding: 40rpx 0;
}

.error-icon { font-size: 60rpx; margin-bottom: 16rpx; }
.error-text { font-size: 26rpx; color: var(--expense); margin-bottom: 24rpx; text-align: center; }
.error-btn { padding: 16rpx 40rpx; font-size: 28rpx; }

/* Report */
.report-content { padding: 8rpx 0; }
.report-text { font-size: 28rpx; line-height: 1.8; color: var(--text-primary); white-space: pre-wrap; }

/* Empty */
.empty-area {
  display: flex; flex-direction: column; align-items: center;
  padding: 60rpx 0;
}

.empty-icon { font-size: 80rpx; margin-bottom: 16rpx; }
.empty-text { font-size: 26rpx; color: var(--text-tertiary); margin-bottom: 32rpx; }

/* Action Grid */
.action-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 20rpx;
}

.action-item {
  display: flex; align-items: center;
  background: var(--bg);
  border-radius: var(--radius);
  padding: 24rpx 20rpx;
}

.action-item:active { opacity: 0.7; }
.action-icon { font-size: 40rpx; margin-right: 16rpx; }
.action-text { font-size: 28rpx; color: var(--text-primary); font-weight: 500; }
</style>
