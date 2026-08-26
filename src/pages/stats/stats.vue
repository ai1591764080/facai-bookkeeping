<template>
  <view class="page">
    <!-- Custom Nav Bar -->
    <view class="nav-bar">
      <view class="nav-status-bar" :style="{ height: statusBarHeight + 'px' }" />
      <view class="nav-content">
        <text class="nav-title">统计</text>
      </view>
    </view>

    <!-- Scrollable Content -->
    <scroll-view scroll-y class="scroll-content" :style="{ top: navHeight + 'px' }">
      <!-- Time Scope Tabs -->
      <view class="scope-tabs">
        <view
          class="scope-tab"
          :class="{ active: scope === 'month' }"
          @tap="scope = 'month'"
        >
          <text>月</text>
        </view>
        <view
          class="scope-tab"
          :class="{ active: scope === 'year' }"
          @tap="scope = 'year'"
        >
          <text>年</text>
        </view>
      </view>

      <!-- Type Switcher -->
      <view class="type-switcher">
        <view
          class="type-btn"
          :class="{ active: currentType === 'expense' }"
          @tap="currentType = 'expense'"
        >
          <text>支出</text>
        </view>
        <view
          class="type-btn"
          :class="{ active: currentType === 'income' }"
          @tap="currentType = 'income'"
        >
          <text>收入</text>
        </view>
      </view>

      <!-- Date Navigator -->
      <view class="date-nav">
        <view class="date-arrow" @tap="prevPeriod">
          <text class="arrow-text">◀</text>
        </view>
        <text class="date-label">{{ periodLabel }}</text>
        <view class="date-arrow" @tap="nextPeriod">
          <text class="arrow-text">▶</text>
        </view>
      </view>

      <!-- Summary Card -->
      <view class="card summary-card">
        <view class="summary-total">
          <text class="summary-label">{{ currentType === 'expense' ? '总支出' : '总收入' }}</text>
          <text class="summary-amount" :class="currentType === 'expense' ? 'text-expense' : 'text-income'">
            ¥{{ formatAmount(totalAmount) }}
          </text>
        </view>
        <view class="divider" />
        <view class="summary-row">
          <view class="summary-item">
            <text class="summary-item-label">日均</text>
            <text class="summary-item-value">¥{{ formatAmount(dailyAverage) }}</text>
          </view>
          <view class="summary-divider" />
          <view class="summary-item">
            <text class="summary-item-label">笔数</text>
            <text class="summary-item-value">{{ transactionCount }}</text>
          </view>
        </view>
      </view>

      <!-- Bar Chart -->
      <view class="card chart-card">
        <text class="section-title">{{ scope === 'month' ? '每日' : '每月' }}{{ currentType === 'expense' ? '支出' : '收入' }}</text>
        <view class="chart-container">
          <canvas
            canvas-id="barChart"
            id="barChart"
            type="2d"
            class="bar-chart"
            @touchstart="onChartTouch"
          />
        </view>
        <!-- Tooltip -->
        <view v-if="tooltip.visible" class="chart-tooltip" :style="{ left: tooltip.x + 'px', top: tooltip.y + 'px' }">
          <text class="tooltip-label">{{ tooltip.label }}</text>
          <text class="tooltip-value">¥{{ formatAmount(tooltip.amount) }}</text>
        </view>
      </view>

      <!-- Category Ranking -->
      <view class="card ranking-card">
        <text class="section-title">分类排行</text>
        <view v-if="categoryRanking.length === 0" class="empty-state">
          <text class="empty-icon">📊</text>
          <text class="empty-text">暂无数据</text>
        </view>
        <view
          v-for="item in categoryRanking"
          :key="item.categoryId"
          class="ranking-item"
        >
          <view class="ranking-left">
            <view class="ranking-icon">
              <text>{{ item.icon }}</text>
            </view>
            <text class="ranking-name">{{ item.name }}</text>
          </view>
          <view class="ranking-right">
            <text class="ranking-amount">¥{{ formatAmount(item.amount) }}</text>
            <text class="ranking-percent">{{ item.percent.toFixed(1) }}%</text>
          </view>
          <view class="ranking-bar">
            <view
              class="ranking-bar-fill"
              :style="{ width: item.percent + '%' }"
              :class="currentType === 'expense' ? 'fill-expense' : 'fill-income'"
            />
          </view>
        </view>
      </view>

      <!-- Bottom spacer for tab bar -->
      <view class="bottom-spacer" />
    </scroll-view>

    <DraggableDock />
  </view>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch, nextTick } from 'vue'
import DraggableDock from '../../components/DraggableDock.vue'
import { useTransactionStore, useCategoryStore, useLedgerStore } from '../../stores'
import { formatAmount } from '../../utils/format'

const transactionStore = useTransactionStore()
const categoryStore = useCategoryStore()
const ledgerStore = useLedgerStore()

const statusBarHeight = ref(20)
const navHeight = ref(64)

const scope = ref<'month' | 'year'>('month')
const currentType = ref<'expense' | 'income'>('expense')

const now = new Date()
const currentYear = ref(now.getFullYear())
const currentMonth = ref(now.getMonth())

// Tooltip state
const tooltip = ref({
  visible: false,
  x: 0,
  y: 0,
  label: '',
  amount: 0
})

// Date range computation
const rangeStart = computed(() => {
  if (scope.value === 'month') {
    return new Date(currentYear.value, currentMonth.value, 1)
  }
  return new Date(currentYear.value, 0, 1)
})

const rangeEnd = computed(() => {
  if (scope.value === 'month') {
    return new Date(currentYear.value, currentMonth.value + 1, 0, 23, 59, 59, 999)
  }
  return new Date(currentYear.value, 11, 31, 23, 59, 59, 999)
})

// Period label
const periodLabel = computed(() => {
  if (scope.value === 'month') {
    return `${currentYear.value}年${currentMonth.value + 1}月`
  }
  return `${currentYear.value}年`
})

// Total amount for the selected period
const totalAmount = computed(() => {
  if (scope.value === 'month') {
    return transactionStore.monthlyTotal(
      currentYear.value,
      currentMonth.value,
      currentType.value,
      ledgerStore.currentId
    )
  }
  // Year: sum all 12 months
  let total = 0
  for (let m = 0; m < 12; m++) {
    total += transactionStore.monthlyTotal(
      currentYear.value,
      m,
      currentType.value,
      ledgerStore.currentId
    )
  }
  return total
})

// Transaction count
const transactionCount = computed(() => {
  const txns = transactionStore.getInRange(
    rangeStart.value,
    rangeEnd.value,
    ledgerStore.currentId
  )
  return txns.filter(
    (t) => t.type === currentType.value && !t.excludeFromStats
  ).length
})

// Daily average
const dailyAverage = computed(() => {
  if (scope.value === 'month') {
    const daysInMonth = new Date(
      currentYear.value,
      currentMonth.value + 1,
      0
    ).getDate()
    return daysInMonth > 0 ? totalAmount.value / daysInMonth : 0
  }
  // Year: average per day over the year
  const daysInYear = isLeapYear(currentYear.value) ? 366 : 365
  return totalAmount.value / daysInYear
})

function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0
}

// Category ranking data
interface RankingItem {
  categoryId: string
  name: string
  icon: string
  amount: number
  percent: number
}

const categoryRanking = computed<RankingItem[]>(() => {
  const totals = transactionStore.categoryTotals(
    rangeStart.value,
    rangeEnd.value,
    currentType.value,
    ledgerStore.currentId
  )
  const total = totals.reduce((s, t) => s + t.amount, 0)
  return totals.map((t) => {
    const cat = categoryStore.getById(t.categoryId)
    return {
      categoryId: t.categoryId,
      name: cat?.name ?? '未知',
      icon: cat?.icon ?? '❓',
      amount: t.amount,
      percent: total > 0 ? (t.amount / total) * 100 : 0
    }
  })
})

// Chart bar data for drawing
interface BarData {
  label: string
  amount: number
}

const barData = computed<BarData[]>(() => {
  if (scope.value === 'month') {
    const daily = transactionStore.dailyTotals(
      currentYear.value,
      currentMonth.value,
      currentType.value,
      ledgerStore.currentId
    )
    // Fill in all days of the month
    const daysInMonth = new Date(
      currentYear.value,
      currentMonth.value + 1,
      0
    ).getDate()
    const dayMap = new Map<string, number>()
    daily.forEach((d) => dayMap.set(d.date, d.amount))

    const result: BarData[] = []
    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${currentYear.value}-${String(currentMonth.value + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
      result.push({
        label: `${d}`,
        amount: dayMap.get(dateStr) ?? 0
      })
    }
    return result
  } else {
    // Year view: monthly totals
    const monthNames = ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月']
    const result: BarData[] = []
    for (let m = 0; m < 12; m++) {
      result.push({
        label: monthNames[m],
        amount: transactionStore.monthlyTotal(
          currentYear.value,
          m,
          currentType.value,
          ledgerStore.currentId
        )
      })
    }
    return result
  }
})

// Period navigation
function prevPeriod() {
  if (scope.value === 'month') {
    if (currentMonth.value === 0) {
      currentMonth.value = 11
      currentYear.value--
    } else {
      currentMonth.value--
    }
  } else {
    currentYear.value--
  }
}

function nextPeriod() {
  if (scope.value === 'month') {
    if (currentMonth.value === 11) {
      currentMonth.value = 0
      currentYear.value++
    } else {
      currentMonth.value++
    }
  } else {
    currentYear.value++
  }
}

// Canvas chart drawing
let canvasInstance: any = null
let ctx: any = null
let canvasWidth = 0
let canvasHeight = 0

function initCanvas() {
  const query = uni.createSelectorQuery().in(getCurrentInstance())
  query.select('#barChart')
    .fields({ node: true, size: true })
    .exec((res: any) => {
      if (!res || !res[0]) return
      const canvas = res[0].node
      const context = canvas.getContext('2d')
      const dpr = uni.getSystemInfoSync().pixelRatio

      canvasInstance = canvas
      ctx = context
      canvasWidth = res[0].width
      canvasHeight = res[0].height

      canvas.width = canvasWidth * dpr
      canvas.height = canvasHeight * dpr
      context.scale(dpr, dpr)

      drawChart()
    })
}

function drawChart() {
  if (!ctx || !canvasInstance) return

  const data = barData.value
  const w = canvasWidth
  const h = canvasHeight

  // Clear
  ctx.clearRect(0, 0, w, h)

  if (data.length === 0) return

  const maxAmount = Math.max(...data.map((d) => d.amount), 1)

  const paddingTop = 20
  const paddingBottom = 36
  const paddingLeft = 8
  const paddingRight = 8
  const chartHeight = h - paddingTop - paddingBottom

  const barCount = data.length
  const totalBarArea = w - paddingLeft - paddingRight
  const barGap = totalBarArea / barCount
  const barWidth = Math.max(barGap * 0.6, 2)

  // Draw bars
  data.forEach((item, i) => {
    const x = paddingLeft + barGap * i + (barGap - barWidth) / 2
    const barH = maxAmount > 0 ? (item.amount / maxAmount) * chartHeight : 0
    const y = paddingTop + chartHeight - barH

    // Bar fill
    ctx.fillStyle = '#4F6EF7'
    if (barH > 0) {
      // Rounded top
      const radius = Math.min(barWidth / 2, 4)
      ctx.beginPath()
      ctx.moveTo(x, y + radius)
      ctx.arcTo(x, y, x + radius, y, radius)
      ctx.arcTo(x + barWidth, y, x + barWidth, y + radius, radius)
      ctx.lineTo(x + barWidth, paddingTop + chartHeight)
      ctx.lineTo(x, paddingTop + chartHeight)
      ctx.closePath()
      ctx.fill()
    }

    // X-axis labels - show selectively to avoid overlap
    const showLabel = barCount <= 12 || i % Math.ceil(barCount / 10) === 0 || i === barCount - 1
    if (showLabel) {
      ctx.fillStyle = '#9CA3AF'
      ctx.font = '10px sans-serif'
      ctx.textAlign = 'center'
      ctx.fillText(
        item.label,
        x + barWidth / 2,
        h - 10
      )
    }
  })

  // Draw bottom line
  ctx.strokeStyle = '#E5E7EB'
  ctx.lineWidth = 0.5
  ctx.beginPath()
  ctx.moveTo(paddingLeft, paddingTop + chartHeight)
  ctx.lineTo(w - paddingRight, paddingTop + chartHeight)
  ctx.stroke()
}

// Chart touch handler for tooltip
function onChartTouch(e: any) {
  if (!e.touches || e.touches.length === 0) return
  const touch = e.touches[0]
  const data = barData.value
  if (data.length === 0) return

  const paddingLeft = 8
  const paddingRight = 8
  const totalBarArea = canvasWidth - paddingLeft - paddingRight
  const barGap = totalBarArea / data.length

  const relX = touch.x - paddingLeft
  const index = Math.floor(relX / barGap)
  if (index >= 0 && index < data.length) {
    const item = data[index]
    tooltip.value = {
      visible: true,
      x: touch.x - 40,
      y: touch.y - 60,
      label: scope.value === 'month'
        ? `${currentMonth.value + 1}月${item.label}日`
        : item.label,
      amount: item.amount
    }
    // Auto-hide after 2s
    setTimeout(() => {
      tooltip.value.visible = false
    }, 2000)
  }
}

// Watch for data changes and redraw
watch([barData, scope, currentType, currentYear, currentMonth], () => {
  nextTick(() => {
    drawChart()
  })
})

// Lifecycle
import { getCurrentInstance } from 'vue'

onMounted(() => {
  const sysInfo = uni.getSystemInfoSync()
  statusBarHeight.value = sysInfo.statusBarHeight ?? 20
  navHeight.value = statusBarHeight.value + 44

  nextTick(() => {
    setTimeout(() => {
      initCanvas()
    }, 200)
  })
})
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
}

.nav-title {
  font-size: 34rpx;
  font-weight: 600;
  color: var(--text-primary);
}

/* Scroll Content */
.scroll-content {
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  padding: 0 24rpx;
}

/* Scope Tabs */
.scope-tabs {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24rpx 0 16rpx;
  gap: 0;
  background: transparent;
}

.scope-tab {
  padding: 12rpx 48rpx;
  font-size: 28rpx;
  color: var(--text-secondary);
  border-radius: 40rpx;
  transition: all 0.25s ease;
}

.scope-tab.active {
  background: var(--primary);
  color: #fff;
  font-weight: 500;
}

/* Type Switcher */
.type-switcher {
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 20rpx;
  background: var(--card);
  border-radius: 40rpx;
  padding: 4rpx;
  width: 320rpx;
  margin-left: auto;
  margin-right: auto;
  box-shadow: 0 2rpx 8rpx var(--shadow);
}

.type-btn {
  flex: 1;
  text-align: center;
  padding: 12rpx 0;
  font-size: 26rpx;
  color: var(--text-secondary);
  border-radius: 36rpx;
  transition: all 0.25s ease;
}

.type-btn.active {
  background: var(--primary);
  color: #fff;
  font-weight: 500;
}

/* Date Navigator */
.date-nav {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 16rpx 0 24rpx;
}

.date-arrow {
  width: 64rpx;
  height: 64rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  background: var(--card);
  box-shadow: 0 2rpx 8rpx var(--shadow);
}

.date-arrow:active {
  background: var(--primary-light);
}

.arrow-text {
  font-size: 24rpx;
  color: var(--text-secondary);
}

.date-label {
  font-size: 32rpx;
  font-weight: 600;
  color: var(--text-primary);
  margin: 0 32rpx;
  min-width: 200rpx;
  text-align: center;
}

/* Summary Card */
.summary-card {
  margin-bottom: 24rpx;
}

.summary-total {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 12rpx 0 8rpx;
}

.summary-label {
  font-size: 26rpx;
  color: var(--text-secondary);
  margin-bottom: 8rpx;
}

.summary-amount {
  font-size: 60rpx;
  font-weight: 700;
  letter-spacing: -2rpx;
}

.summary-row {
  display: flex;
  align-items: center;
  justify-content: space-around;
  padding: 16rpx 0 4rpx;
}

.summary-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  flex: 1;
}

.summary-item-label {
  font-size: 24rpx;
  color: var(--text-tertiary);
  margin-bottom: 6rpx;
}

.summary-item-value {
  font-size: 30rpx;
  font-weight: 600;
  color: var(--text-primary);
}

.summary-divider {
  width: 1rpx;
  height: 48rpx;
  background: var(--border);
}

/* Chart */
.chart-card {
  position: relative;
  margin-bottom: 24rpx;
}

.chart-container {
  width: 100%;
  height: 360rpx;
  margin-top: 16rpx;
}

.bar-chart {
  width: 100%;
  height: 360rpx;
}

.chart-tooltip {
  position: absolute;
  background: rgba(26, 26, 46, 0.88);
  border-radius: 12rpx;
  padding: 12rpx 20rpx;
  display: flex;
  flex-direction: column;
  align-items: center;
  z-index: 10;
  pointer-events: none;
}

.tooltip-label {
  font-size: 22rpx;
  color: rgba(255, 255, 255, 0.7);
}

.tooltip-value {
  font-size: 26rpx;
  color: #fff;
  font-weight: 600;
  margin-top: 4rpx;
}

/* Category Ranking */
.ranking-card {
  margin-bottom: 24rpx;
}

.ranking-item {
  padding: 20rpx 0;
  border-bottom: 1rpx solid var(--border);
}

.ranking-item:last-child {
  border-bottom: none;
}

.ranking-left {
  display: flex;
  align-items: center;
  flex-direction: row;
}

.ranking-icon {
  width: 64rpx;
  height: 64rpx;
  border-radius: 50%;
  background: var(--bg);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 32rpx;
  margin-right: 16rpx;
  flex-shrink: 0;
}

.ranking-name {
  font-size: 28rpx;
  font-weight: 500;
  color: var(--text-primary);
}

.ranking-right {
  display: flex;
  align-items: center;
  flex-direction: row;
  margin-left: auto;
  gap: 16rpx;
}

.ranking-amount {
  font-size: 30rpx;
  font-weight: 600;
  color: var(--text-primary);
}

.ranking-percent {
  font-size: 24rpx;
  color: var(--text-tertiary);
  min-width: 80rpx;
  text-align: right;
}

.ranking-bar {
  height: 10rpx;
  background: var(--border);
  border-radius: 5rpx;
  overflow: hidden;
  margin-top: 12rpx;
}

.ranking-bar-fill {
  height: 100%;
  border-radius: 5rpx;
  transition: width 0.4s ease;
  min-width: 4rpx;
}

.fill-expense {
  background: var(--expense);
}

.fill-income {
  background: var(--income);
}

/* Bottom Spacer */
.bottom-spacer {
  height: 160rpx;
}
</style>
