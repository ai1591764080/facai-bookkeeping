<template>
  <!-- Floating voice command bar — always visible, prominent -->
  <view class="vc-fab" :class="state" @tap="onTap">
    <!-- Idle state: prompt bar -->
    <view v-if="state === 'idle'" class="vc-bar">
      <view class="vc-bar-mic">
        <text class="vc-mic-icon">🎙️</text>
      </view>
      <text class="vc-hint">点击说话，语音控制记账</text>
      <view class="vc-bar-glow" />
    </view>

    <!-- Listening state: wave animation + text -->
    <view v-else-if="state === 'listening'" class="vc-bar listening">
      <view class="vc-waves">
        <view class="vc-wave" /><view class="vc-wave" /><view class="vc-wave" />
        <view class="vc-wave" /><view class="vc-wave" /><view class="vc-wave" />
        <view class="vc-wave" />
      </view>
      <text class="vc-listening-text">{{ interimText || '正在聆听...' }}</text>
      <view class="vc-stop-pill" @tap.stop="onStop">
        <text class="vc-stop-text">完成</text>
      </view>
    </view>

    <!-- Processing state -->
    <view v-else-if="state === 'processing'" class="vc-bar processing">
      <view class="vc-spinner" />
      <text class="vc-process-text">AI 分析中...</text>
    </view>

    <!-- Result state -->
    <view v-else-if="state === 'result'" class="vc-bar" :class="resultSuccess ? 'success' : 'error'">
      <text class="vc-result-icon">{{ resultSuccess ? '✅' : '❌' }}</text>
      <text class="vc-result-text">{{ resultMessage }}</text>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { startVoice, stopVoice } from '../utils/voice'
import { parseVoiceCommand, hasApiKey } from '../utils/ai'
import { hasXfyunConfig } from '../utils/voice'
import { executeCommand } from '../utils/command'
import {
  useCategoryStore,
  useAccountStore,
  useLedgerStore,
  useBudgetStore,
} from '../stores'

type State = 'idle' | 'listening' | 'processing' | 'result'

const state = ref<State>('idle')
const interimText = ref('')
const resultMessage = ref('')
const resultSuccess = ref(false)

const catStore = useCategoryStore()
const accStore = useAccountStore()
const ledgerStore = useLedgerStore()
const budgetStore = useBudgetStore()

let resultTimer: ReturnType<typeof setTimeout> | null = null

function onTap() {
  if (state.value === 'idle') {
    startListening()
  }
}

function startListening() {
  // Check prerequisites
  if (!hasXfyunConfig()) {
    showResult(false, '请先在「AI 设置」中配置讯飞语音 AppID / APIKey / APISecret')
    return
  }
  if (!hasApiKey()) {
    showResult(false, '请先在「AI 设置」中配置 DeepSeek API Key')
    return
  }

  if (resultTimer) { clearTimeout(resultTimer); resultTimer = null }
  state.value = 'listening'
  interimText.value = ''

  startVoice(
    (result) => {
      interimText.value = result.text
      if (result.isFinal && result.text.trim()) {
        stopVoice()
        processCommand(result.text.trim())
      }
    },
    (error) => {
      stopVoice()
      showResult(false, error)
    }
  )
}

function onStop() {
  stopVoice()
  if (interimText.value.trim()) {
    processCommand(interimText.value.trim())
  } else {
    state.value = 'idle'
  }
}

async function processCommand(text: string) {
  state.value = 'processing'
  interimText.value = ''
  console.log('[VC] Processing voice command:', text)

  try {
    const action = await parseVoiceCommand(text, {
      categories: catStore.categories,
      accounts: accStore.accounts,
      ledgers: ledgerStore.ledgers.map(l => ({ id: l.id, name: l.name })),
      currentLedgerId: ledgerStore.currentId,
      budgetAmounts: budgetStore.budgets
        .filter(b => b.enabled && b.ledgerId === ledgerStore.currentId)
        .map(b => {
          const name = b.type === 'total' ? '总预算' : catStore.getById(b.categoryId || '')?.name || '未知'
          return { name, amount: b.amount }
        }),
    })

    console.log('[VC] AI parsed action:', JSON.stringify(action))

    if (action.action === 'unknown') {
      showResult(false, action.confirmation || '抱歉，没有理解您的指令')
      return
    }

    resultMessage.value = action.confirmation
    resultSuccess.value = true

    await new Promise(r => setTimeout(r, 500))
    const result = executeCommand(action)
    console.log('[VC] Execute result:', result)
    showResult(result.success, result.message)
  } catch (e: any) {
    console.error('[VC] Error:', e)
    showResult(false, `AI 解析失败: ${e.message || '请重试'}`)
  }
}

function showResult(success: boolean, message: string) {
  resultSuccess.value = success
  resultMessage.value = message
  state.value = 'result'

  if (resultTimer) clearTimeout(resultTimer)
  resultTimer = setTimeout(() => {
    state.value = 'idle'
    resultMessage.value = ''
  }, 3500)
}
</script>

<style scoped>
/* ===== Floating bar container ===== */
.vc-fab {
  position: fixed;
  left: 24rpx;
  right: 24rpx;
  bottom: 160rpx;
  z-index: 998;
  pointer-events: auto;
}

/* ===== Base bar style ===== */
.vc-bar {
  display: flex;
  align-items: center;
  height: 100rpx;
  background: var(--card);
  border-radius: 50rpx;
  padding: 0 32rpx;
  box-shadow: 0 8rpx 32rpx rgba(79, 110, 247, 0.2), 0 2rpx 8rpx rgba(0, 0, 0, 0.06);
  border: 2rpx solid var(--primary-light);
  transition: all 0.3s ease;
  overflow: hidden;
  position: relative;
}

/* ===== Idle state ===== */
.vc-bar-mic {
  width: 64rpx;
  height: 64rpx;
  background: var(--primary);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  margin-right: 20rpx;
  animation: vc-mic-breathe 2.5s ease-in-out infinite;
}

@keyframes vc-mic-breathe {
  0%, 100% { box-shadow: 0 0 0 0 rgba(79, 110, 247, 0.4); }
  50% { box-shadow: 0 0 0 12rpx rgba(79, 110, 247, 0); }
}

.vc-mic-icon {
  font-size: 32rpx;
}

.vc-hint {
  font-size: 28rpx;
  color: var(--text-secondary);
  flex: 1;
}

.vc-bar-glow {
  position: absolute;
  right: -20rpx;
  top: -20rpx;
  width: 80rpx;
  height: 80rpx;
  background: radial-gradient(circle, rgba(79, 110, 247, 0.15), transparent 70%);
  border-radius: 50%;
  pointer-events: none;
}

.vc-fab.idle .vc-bar:active {
  transform: scale(0.97);
  box-shadow: 0 4rpx 16rpx rgba(79, 110, 247, 0.3);
}

/* ===== Listening state ===== */
.vc-bar.listening {
  background: linear-gradient(135deg, #FF6B6B, #ee5a5a);
  border-color: transparent;
  box-shadow: 0 8rpx 32rpx rgba(255, 107, 107, 0.35);
  animation: vc-pulse-bar 1.2s ease-in-out infinite;
}

@keyframes vc-pulse-bar {
  0%, 100% { transform: scale(1); }
  50% { transform: scale(1.02); }
}

.vc-waves {
  display: flex;
  align-items: center;
  gap: 5rpx;
  height: 48rpx;
  flex-shrink: 0;
  margin-right: 20rpx;
}

.vc-wave {
  width: 6rpx;
  background: rgba(255, 255, 255, 0.85);
  border-radius: 3rpx;
  animation: vc-wave-anim 0.7s ease-in-out infinite;
}
.vc-wave:nth-child(1) { height: 16rpx; animation-delay: 0s; }
.vc-wave:nth-child(2) { height: 28rpx; animation-delay: 0.08s; }
.vc-wave:nth-child(3) { height: 40rpx; animation-delay: 0.16s; }
.vc-wave:nth-child(4) { height: 48rpx; animation-delay: 0.24s; }
.vc-wave:nth-child(5) { height: 40rpx; animation-delay: 0.32s; }
.vc-wave:nth-child(6) { height: 28rpx; animation-delay: 0.40s; }
.vc-wave:nth-child(7) { height: 16rpx; animation-delay: 0.48s; }

@keyframes vc-wave-anim {
  0%, 100% { transform: scaleY(0.4); }
  50% { transform: scaleY(1.1); }
}

.vc-listening-text {
  font-size: 28rpx;
  color: #fff;
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.vc-stop-pill {
  flex-shrink: 0;
  background: rgba(255, 255, 255, 0.25);
  border-radius: 32rpx;
  padding: 10rpx 28rpx;
  margin-left: 16rpx;
}

.vc-stop-text {
  font-size: 26rpx;
  color: #fff;
  font-weight: 600;
}

/* ===== Processing state ===== */
.vc-bar.processing {
  border-color: var(--primary);
  box-shadow: 0 8rpx 32rpx rgba(79, 110, 247, 0.25);
}

.vc-spinner {
  width: 36rpx;
  height: 36rpx;
  border: 4rpx solid var(--primary-light);
  border-top-color: var(--primary);
  border-radius: 50%;
  animation: vc-spin 0.7s linear infinite;
  flex-shrink: 0;
  margin-right: 20rpx;
}

@keyframes vc-spin {
  to { transform: rotate(360deg); }
}

.vc-process-text {
  font-size: 28rpx;
  color: var(--primary);
  font-weight: 500;
}

/* ===== Result state ===== */
.vc-bar.success {
  background: #f0fdf4;
  border-color: var(--income);
  box-shadow: 0 8rpx 24rpx rgba(81, 207, 102, 0.2);
}

.vc-bar.error {
  background: #fef2f2;
  border-color: var(--expense);
  box-shadow: 0 8rpx 24rpx rgba(255, 107, 107, 0.2);
}

.vc-result-icon {
  font-size: 32rpx;
  flex-shrink: 0;
  margin-right: 16rpx;
}

.vc-result-text {
  font-size: 26rpx;
  flex: 1;
  line-height: 1.4;
  overflow: hidden;
  text-overflow: ellipsis;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
}

.vc-bar.success .vc-result-text { color: #166534; }
.vc-bar.error .vc-result-text { color: #991b1b; }
</style>
