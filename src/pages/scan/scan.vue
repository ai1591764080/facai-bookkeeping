<script setup lang="ts">
import { ref, computed } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { useCategoryStore, useAccountStore, useLedgerStore, useTransactionStore, useScanStore } from '../../stores'
import { recognizeImage, readFileAsBase64, getOcrToken, setOcrToken, getOcrUrl, setOcrUrl, hasOcrConfig } from '../../utils/ocr'
import { parseReceiptText, hasApiKey } from '../../utils/ai'
import type { ScanCandidate } from '../../types'

const categoryStore = useCategoryStore()
const accountStore = useAccountStore()
const ledgerStore = useLedgerStore()
const txStore = useTransactionStore()
const scanStore = useScanStore()

const imagePath = ref('')
const ocrText = ref('')
const candidates = ref<ScanCandidate[]>([])
const loading = ref(false)
const step = ref<'choose' | 'review'>('choose') // choose=已选图, review=AI整理后
const showConfig = ref(false)
const configToken = ref('')
const configUrl = ref('')

// AI 思考画面（DeepSeek 整理阶段的状态反馈）
const aiThinking = ref(false)
const thinkingStep = ref(0)
let thinkingTimer: any = null
const thinkingTexts = [
  '正在读取票据文字…',
  '正在分析金额与收支…',
  '正在匹配分类与账户…',
  '正在整理记账明细…',
]

const ctypeLabels = { expense: '支出', income: '收入', transfer: '转账' } as const

const totalAmount = computed(() => candidates.value.reduce((s, c) => s + (Number(c.amount) || 0), 0))
const expenseAmount = computed(() => candidates.value.filter((c) => c.type === 'expense').reduce((s, c) => s + (Number(c.amount) || 0), 0))
const incomeAmount = computed(() => candidates.value.filter((c) => c.type === 'income').reduce((s, c) => s + (Number(c.amount) || 0), 0))
const hasCandidate = computed(() => candidates.value.length > 0)
const confidenceHint = computed(() => candidates.value.some((c) => c.confidence < 0.7))

const catOptions = computed(() => {
  const expense = categoryStore.expenseCategories.map((c) => `支出:${c.name}`)
  const income = categoryStore.incomeCategories.map((c) => `收入:${c.name}`)
  return [...expense, ...income]
})
const accOptions = computed(() => accountStore.visibleAccounts.map((a) => a.name))

function chooseImage(source: 'camera' | 'album') {
  uni.chooseImage({
    count: 1,
    sourceType: [source],
    success: (res) => {
      imagePath.value = res.tempFilePaths[0]
      step.value = 'choose'
      ocrText.value = ''
      candidates.value = []
    },
  })
}

function reChoose() {
  chooseImage('album')
}

async function recognize() {
  if (!imagePath.value) return
  loading.value = true
  try {
    const base64 = await readFileAsBase64(imagePath.value)
    uni.showLoading({ title: 'OCR 识别中...' })
    // 飞桨 OCR 识别（使用飞桨 AI Studio token，与 DeepSeek 无关）
    const text = await recognizeImage(base64)
    uni.hideLoading()
    if (!text.trim()) {
      uni.showToast({ title: '未识别到文字', icon: 'none' })
      return
    }
    ocrText.value = text
    // 先进入识别结果预览，展示 OCR 原文
    step.value = 'review'
    uni.showToast({ title: '识别完成', icon: 'none' })

    // AI 智能整理（这一步才需要 DeepSeek）
    if (!hasApiKey()) {
      uni.showModal({
        title: '已识别完成',
        content: '图片文字已识别成功。智能整理记账需要 DeepSeek API Key，是否前往配置？',
        confirmText: '去配置',
        cancelText: '暂不',
        success: (r) => {
          if (r.confirm) uni.navigateTo({ url: '/pages/ai/settings' })
        },
      })
      return
    }

    // 显示 AI 思考画面（DeepSeek 整理需要数秒，给用户明确反馈）
    aiThinking.value = true
    thinkingStep.value = 0
    thinkingTimer = setInterval(() => {
      thinkingStep.value = (thinkingStep.value + 1) % thinkingTexts.length
    }, 1300)

    try {
      const list = await parseReceiptText(text, categoryStore.categories, accountStore.visibleAccounts)
      candidates.value = list
      if (list.length === 0) {
        uni.showToast({ title: '未能整理出有效账单，请检查图片', icon: 'none' })
      }
    } finally {
      aiThinking.value = false
      clearInterval(thinkingTimer)
      thinkingTimer = null
    }
  } catch (e: any) {
    aiThinking.value = false
    clearInterval(thinkingTimer)
    thinkingTimer = null
    uni.hideLoading()
    uni.showToast({ title: e.message || '识别失败', icon: 'none' })
  } finally {
    loading.value = false
  }
}

function updateCandidate(index: number, field: keyof ScanCandidate, value: any) {
  candidates.value[index] = { ...candidates.value[index], [field]: value }
}

// 显式 any 类型的 handler，规避 uni-app 模板对 $event 的类型推断问题
function onAmountInput(index: number, e: any) {
  updateCandidate(index, 'amount', e?.detail?.value)
}
function onNoteInput(index: number, e: any) {
  updateCandidate(index, 'note', e?.detail?.value)
}
function onDateChange(index: number, e: any) {
  updateCandidate(index, 'date', e?.detail?.value)
}

function removeCandidate(index: number) {
  candidates.value.splice(index, 1)
}

function confirmArchive() {
  if (candidates.value.length === 0) return
  uni.showModal({
    title: '确认归档记账',
    content: `将把 ${candidates.value.length} 条记录写入账本（支出 ¥${expenseAmount.value.toFixed(2)}、收入 ¥${incomeAmount.value.toFixed(2)}）。确认后计入统计。`,
    success: async (res) => {
      if (!res.confirm) return
      loading.value = true
      try {
        const rec = scanStore.addRecord({
          ledgerId: ledgerStore.currentId,
          status: 'pending',
          ocrText: ocrText.value,
          image: imagePath.value,
          candidates: candidates.value.map((c) => ({ ...c })),
          transactionIds: [],
        })
        // 用户已同意，立即归档并写入真实账单
        const result = scanStore.archive(
          rec.id,
          categoryStore.categories,
          accountStore.visibleAccounts,
          ledgerStore.currentId,
          (tx) => txStore.add(tx),
          (accId, delta) => accountStore.adjustBalance(accId, delta)
        )
        uni.showToast({ title: `已归档 ${result.created} 条账单`, icon: 'success' })
        resetAll()
      } finally {
        loading.value = false
      }
    },
  })
}

function resetAll() {
  imagePath.value = ''
  ocrText.value = ''
  candidates.value = []
  step.value = 'choose'
}

function openConfig() {
  configToken.value = getOcrToken()
  configUrl.value = getOcrUrl()
  showConfig.value = true
}

function onTokenInput(e: any) {
  configToken.value = e?.detail?.value || ''
}
function onUrlInput(e: any) {
  configUrl.value = e?.detail?.value || ''
}

function saveConfig() {
  if (configToken.value.trim()) setOcrToken(configToken.value.trim())
  if (configUrl.value.trim()) setOcrUrl(configUrl.value.trim())
  showConfig.value = false
  uni.showToast({ title: '已保存 OCR 配置', icon: 'success' })
}

function goArchive() {
  uni.navigateTo({ url: '/pages/scan/archive' })
}

onLoad(() => {
  // 确保配置已就绪
  if (!hasOcrConfig()) {
    // 使用默认 token，无需提示；但 url 可能不对，提示用户可配置
  }
})

function catIndexFor(c: ScanCandidate): number {
  const key = `${c.type === 'expense' ? '支出' : c.type === 'income' ? '收入' : '支出'}:${c.categoryName}`
  const idx = catOptions.value.indexOf(key)
  return idx >= 0 ? idx : 0
}
function accIndexFor(c: ScanCandidate): number {
  const idx = accOptions.value.indexOf(c.accountName)
  return idx >= 0 ? idx : 0
}
function onCatChange(index: number, e: any) {
  const val = catOptions.value[e.detail.value]
  const [kindLabel, name] = val.split(':')
  updateCandidate(index, 'type', kindLabel === '收入' ? 'income' : 'expense')
  updateCandidate(index, 'categoryName', name)
}
function onAccChange(index: number, e: any) {
  updateCandidate(index, 'accountName', accOptions.value[e.detail.value])
}
</script>

<template>
  <view class="scan-page">
    <!-- 顶部操作栏 -->
    <view class="top-bar">
      <view class="top-title">扫描识别记账</view>
      <view class="top-actions">
        <text class="config-btn" @tap="openConfig">OCR配置</text>
        <text class="archive-btn" @tap="goArchive">归档列表 ›</text>
      </view>
    </view>

    <!-- 选图区域 -->
    <view class="card choose-card" v-if="step === 'choose'">
      <view class="preview-area" v-if="imagePath">
        <image class="preview-img" :src="imagePath" mode="aspectFit" />
        <view class="preview-mask" @tap="reChoose">
          <text class="re-choose-text">重新选择</text>
        </view>
      </view>
      <view class="preview-placeholder" v-else>
        <text class="placeholder-icon">📷</text>
        <text class="placeholder-text">拍摄或选择一张小票 / 账单图片</text>
      </view>

      <view class="choose-btns">
        <button class="btn btn-camera" @tap="chooseImage('camera')">拍照</button>
        <button class="btn btn-album" @tap="chooseImage('album')">相册选择</button>
      </view>

      <button class="btn btn-primary btn-recognize" :disabled="!imagePath || loading" @tap="recognize">
        {{ loading ? '处理中...' : '识别并智能整理' }}
      </button>
      <view class="tip-text">识别使用飞桨 AI Studio，整理由 AI 完成，归档前需你确认同意。</view>
    </view>

    <!-- OCR 文本 + 整理预览 -->
    <view class="card review-card" v-if="step === 'review'">
      <view class="section-title">📄 识别内容</view>
      <view class="ocr-box">
        <text class="ocr-text">{{ ocrText }}</text>
      </view>

      <view class="section-title">
        整理结果
        <text class="amount-badge" v-if="hasCandidate">支出 ¥{{ expenseAmount.toFixed(2) }} · 收入 ¥{{ incomeAmount.toFixed(2) }}</text>
      </view>

      <view class="empty-tip" v-if="!hasCandidate">
        <text>未整理出有效账单</text>
      </view>

      <view class="candidate-list">
        <view class="candidate-item" v-for="(c, i) in candidates" :key="i">
          <view class="candidate-head">
            <text class="candidate-type" :class="c.type">{{ ctypeLabels[c.type] }}</text>
            <view class="candidate-amount">
              <text class="amount-symbol">¥</text>
              <input
                class="amount-input"
                type="digit"
                :value="String(c.amount)"
                @input="onAmountInput(i, $event)"
              />
            </view>
            <view class="conf-badge" :class="{ low: c.confidence < 0.7 }">
              {{ (c.confidence * 100).toFixed(0) }}%
            </view>
            <text class="remove-btn" @tap="removeCandidate(i)">✕</text>
          </view>

          <view class="candidate-body">
            <picker :range="catOptions" @change="onCatChange(i, $event)">
              <view class="field">
                <text class="field-label">分类</text>
                <text class="field-value">{{ c.type === 'expense' ? '支出' : c.type === 'income' ? '收入' : '支出' }}:{{ c.categoryName }} ›</text>
              </view>
            </picker>
            <picker :range="accOptions" @change="onAccChange(i, $event)">
              <view class="field">
                <text class="field-label">账户</text>
                <text class="field-value">{{ c.accountName }} ›</text>
              </view>
            </picker>
            <view class="field">
              <text class="field-label">日期</text>
              <picker mode="date" :value="c.date" @change="onDateChange(i, $event)">
                <text class="field-value">{{ c.date }} ›</text>
              </picker>
            </view>
            <view class="field field-note">
              <text class="field-label">备注</text>
              <input
                class="note-input"
                :value="c.note"
                placeholder="备注（可选）"
                @input="onNoteInput(i, $event)"
              />
            </view>
          </view>
        </view>
      </view>

      <view class="warning" v-if="confidenceHint">
        ⚠️ 部分记录置信度较低，请核对金额与分类后再归档。
      </view>

      <view class="review-actions">
        <button class="btn btn-rescan" @tap="resetAll">重新扫描</button>
        <button class="btn btn-confirm" :disabled="!hasCandidate || loading" @tap="confirmArchive">
          同意归档记账
        </button>
      </view>
    </view>

    <!-- AI 思考画面（DeepSeek 整理阶段） -->
    <view class="thinking-mask" v-if="aiThinking">
      <view class="thinking-card">
        <view class="thinking-icon">
          <view class="spinner"></view>
          <text class="thinking-emoji">🤖</text>
        </view>
        <text class="thinking-title">AI 正在思考</text>
        <text class="thinking-text">{{ thinkingTexts[thinkingStep] }}</text>
        <view class="thinking-dots">
          <view class="dot" v-for="i in 3" :key="i" :class="{ on: i <= (thinkingStep % 3) + 1 }"></view>
        </view>
        <text class="thinking-tip">正在理解票据内容并整理成记账明细，请稍候…</text>
      </view>
    </view>

    <!-- OCR 配置弹窗 -->
    <view class="mask" v-if="showConfig" @tap="showConfig = false">
      <view class="config-modal" @tap.stop>
        <view class="modal-title">飞桨 AI Studio OCR 配置</view>
        <view class="modal-field">
          <text class="modal-label">Access Token</text>
          <input class="modal-input" :value="configToken" @input="onTokenInput($event)" placeholder="访问令牌" />
        </view>
        <view class="modal-field">
          <text class="modal-label">接口地址</text>
          <input class="modal-input" :value="configUrl" @input="onUrlInput($event)" placeholder="PaddleOCR API URL" />
        </view>
        <view class="modal-btns">
          <button class="btn btn-cancel" @tap="showConfig = false">取消</button>
          <button class="btn btn-confirm" @tap="saveConfig">保存</button>
        </view>
      </view>
    </view>
  </view>
</template>

<style scoped>
.scan-page {
  min-height: 100vh;
  background: var(--bg);
  padding: 24rpx 24rpx 60rpx;
}
.top-bar {
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: space-between;
  padding: 20rpx 8rpx 24rpx;
}
.top-title { font-size: 38rpx; font-weight: 700; color: var(--text-primary); }
.top-actions { display: flex; flex-direction: row; align-items: center; }
.config-btn { font-size: 26rpx; color: var(--text-secondary); margin-right: 28rpx; }
.archive-btn { font-size: 26rpx; color: var(--primary); font-weight: 500; }

.card { background: var(--card-bg); border-radius: 24rpx; padding: 32rpx; margin-bottom: 24rpx; }

.preview-area { position: relative; border-radius: 16rpx; overflow: hidden; background: #f0f0f0; }
.preview-img { width: 100%; height: 420rpx; }
.preview-mask {
  position: absolute; inset: 0; display: flex; align-items: center; justify-content: center;
  background: rgba(0,0,0,0.4);
}
.re-choose-text { color: #fff; font-size: 28rpx; }
.preview-placeholder {
  height: 320rpx; display: flex; flex-direction: column; align-items: center; justify-content: center;
  background: var(--bg); border-radius: 16rpx; border: 2rpx dashed var(--border);
}
.placeholder-icon { font-size: 80rpx; }
.placeholder-text { font-size: 26rpx; color: var(--text-tertiary); margin-top: 16rpx; }

.choose-btns { display: flex; flex-direction: row; margin-top: 24rpx; gap: 24rpx; }
.btn { border-radius: 16rpx; font-size: 30rpx; font-weight: 500; }
.btn-camera { flex: 1; background: var(--primary); color: #fff; }
.btn-album { flex: 1; background: rgba(79,110,247,0.1); color: var(--primary); }
.btn-primary { margin-top: 24rpx; background: var(--primary); color: #fff; }
.btn-recognize { width: 100%; }
.tip-text { font-size: 24rpx; color: var(--text-tertiary); margin-top: 20rpx; text-align: center; }

.section-title { font-size: 30rpx; font-weight: 600; color: var(--text-primary); margin-bottom: 16rpx; display: flex; align-items: center; justify-content: space-between; }
.amount-badge { font-size: 26rpx; color: var(--primary); font-weight: 500; }
.ocr-box { background: var(--bg); border-radius: 12rpx; padding: 20rpx; max-height: 240rpx; overflow-y: auto; margin-bottom: 28rpx; }
.ocr-text { font-size: 26rpx; color: var(--text-secondary); white-space: pre-wrap; line-height: 1.6; }

.empty-tip { text-align: center; color: var(--text-tertiary); padding: 40rpx 0; font-size: 28rpx; }

.candidate-item { border: 1rpx solid var(--border); border-radius: 16rpx; padding: 24rpx; margin-bottom: 20rpx; }
.candidate-head { display: flex; flex-direction: row; align-items: center; }
.candidate-type { font-size: 26rpx; padding: 4rpx 16rpx; border-radius: 8rpx; }
.candidate-type.expense { background: rgba(239,68,68,0.12); color: #ef4444; }
.candidate-type.income { background: rgba(16,185,129,0.12); color: #10b981; }
.candidate-amount { flex: 1; display: flex; align-items: center; margin-left: 20rpx; }
.amount-symbol { font-size: 28rpx; color: var(--text-primary); margin-right: 8rpx; }
.amount-input { font-size: 40rpx; font-weight: 700; color: var(--text-primary); width: 200rpx; }
.conf-badge { font-size: 24rpx; color: #10b981; margin-left: 16rpx; }
.conf-badge.low { color: #f59e0b; }
.remove-btn { font-size: 28rpx; color: var(--text-tertiary); margin-left: 16rpx; padding: 8rpx; }

.candidate-body { margin-top: 20rpx; border-top: 1rpx solid var(--border); padding-top: 8rpx; }
.field { display: flex; flex-direction: row; align-items: center; justify-content: space-between; padding: 16rpx 0; }
.field-label { font-size: 28rpx; color: var(--text-secondary); }
.field-value { font-size: 28rpx; color: var(--text-primary); }
.note-input { font-size: 28rpx; color: var(--text-primary); text-align: right; flex: 1; margin-left: 20rpx; }

.warning { background: rgba(245,158,11,0.12); color: #b45309; border-radius: 12rpx; padding: 16rpx 20rpx; font-size: 26rpx; margin-bottom: 24rpx; }
.review-actions { display: flex; flex-direction: row; gap: 24rpx; }
.btn-rescan { flex: 1; background: var(--bg); color: var(--text-secondary); border: 1rpx solid var(--border); }
.btn-confirm { flex: 2; background: var(--primary); color: #fff; }

/* AI 思考画面 */
.thinking-mask {
  position: fixed; inset: 0; background: rgba(0,0,0,0.55); z-index: 998;
  display: flex; align-items: center; justify-content: center; flex-direction: column;
  backdrop-filter: blur(4px);
}
.thinking-card {
  width: 520rpx; background: var(--card-bg); border-radius: 28rpx; padding: 48rpx 40rpx;
  display: flex; flex-direction: column; align-items: center;
  box-shadow: 0 16rpx 48rpx rgba(0,0,0,0.2);
}
.thinking-icon { position: relative; width: 120rpx; height: 120rpx; margin-bottom: 24rpx; display: flex; align-items: center; justify-content: center; }
.spinner {
  position: absolute; inset: 0; border-radius: 50%;
  border: 6rpx solid rgba(79,110,247,0.15);
  border-top-color: var(--primary);
  animation: thinking-spin 1s linear infinite;
}
.thinking-emoji { font-size: 52rpx; }
.thinking-title { font-size: 34rpx; font-weight: 700; color: var(--text-primary); }
.thinking-text { font-size: 28rpx; color: var(--text-secondary); margin-top: 16rpx; min-height: 40rpx; text-align: center; }
.thinking-dots { display: flex; flex-direction: row; gap: 12rpx; margin-top: 20rpx; }
.dot { width: 14rpx; height: 14rpx; border-radius: 50%; background: rgba(79,110,247,0.2); transition: background 0.3s; }
.dot.on { background: var(--primary); }
.thinking-tip { font-size: 24rpx; color: var(--text-tertiary); margin-top: 20rpx; text-align: center; }

@keyframes thinking-spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

.mask { position: fixed; inset: 0; background: rgba(0,0,0,0.5); z-index: 999; display: flex; align-items: center; justify-content: center; }
.config-modal { width: 620rpx; background: var(--card-bg); border-radius: 24rpx; padding: 40rpx; }
.modal-title { font-size: 32rpx; font-weight: 700; color: var(--text-primary); margin-bottom: 28rpx; text-align: center; }
.modal-field { margin-bottom: 24rpx; }
.modal-label { font-size: 26rpx; color: var(--text-secondary); display: block; margin-bottom: 10rpx; }
.modal-input { background: var(--bg); border-radius: 12rpx; padding: 16rpx 20rpx; font-size: 28rpx; color: var(--text-primary); }
.modal-btns { display: flex; flex-direction: row; gap: 24rpx; margin-top: 12rpx; }
.btn-cancel { flex: 1; background: var(--bg); color: var(--text-secondary); }
</style>
