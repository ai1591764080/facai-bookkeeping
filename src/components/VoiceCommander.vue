<template>
  <!-- Floating voice command bar — always visible, prominent -->
  <view
    class="vc-fab"
    :class="[state, { dragging: isDragging }]"
    :style="fabStyle"
    @tap="onTap"
    @touchstart.stop="onTouchStart"
    @touchmove.stop.prevent="onTouchMove"
    @touchend.stop="onTouchEnd"
    @touchcancel.stop="onTouchEnd"
  >
    <!-- Idle state: compact draggable pill -->
    <view v-if="state === 'idle'" class="vc-bar">
      <view class="vc-bar-mic">
        <text class="vc-mic-icon">🎙️</text>
      </view>
      <text class="vc-hint">语音记账</text>
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
import { ref, computed, onMounted, onBeforeUnmount } from 'vue' // Vue 组合式 API：ref/computed 响应式，onMounted/onBeforeUnmount 生命周期
import { startVoice, stopVoice } from '../utils/voice' // 跨平台语音识别（讯飞/微信插件）
import { parseVoiceCommands, hasApiKey } from '../utils/ai' // AI 解析语音文本为记账动作（支持一次多笔），检查是否已配置 API Key
import { hasXfyunConfig } from '../utils/voice' // 检查是否已配置讯飞语音识别
import { executeCommands } from '../utils/command' // 批量执行解析出的记账命令并返回汇总结果
import {
  useCategoryStore,
  useAccountStore,
  useLedgerStore,
  useBudgetStore,
} from '../stores' // 分类/账户/账本/预算状态仓库

type State = 'idle' | 'listening' | 'processing' | 'result'

const state = ref<State>('idle')
const interimText = ref('')
const resultMessage = ref('')
const resultSuccess = ref(false)

// ===== 悬浮位置与拖拽 =====
const POS_KEY = 'beecount_vc_pos'
const fabPos = ref({ x: 0, y: 0 })
const isDragging = ref(false)
const hasMoved = ref(false)
const dragOffset = ref({ dx: 0, dy: 0 })
let vcEl: HTMLElement | null = null

// 空闲胶囊约 150px 宽 / 50px 高；展开态固定宽
function fabSize() {
  if (state.value === 'idle') return { w: 150, h: 50 }
  return { w: 320, h: 50 }
}

function clampPos(x: number, y: number, w: number, h: number) {
  const vw = uni.getSystemInfoSync().windowWidth
  const vh = uni.getSystemInfoSync().windowHeight
  return {
    x: Math.round(Math.min(Math.max(0, x), Math.max(0, vw - w))),
    y: Math.round(Math.min(Math.max(0, y), Math.max(0, vh - h))),
  }
}

function restorePos() {
  try {
    const saved = uni.getStorageSync(POS_KEY)
    if (saved && typeof saved.x === 'number' && typeof saved.y === 'number') {
      fabPos.value = { x: saved.x, y: saved.y }
      return
    }
  } catch (e) { /* 忽略 */ }
  // 默认位置：水平居中、垂直约 72% 高度（避开右下角记账按钮）
  const vw = uni.getSystemInfoSync().windowWidth
  const vh = uni.getSystemInfoSync().windowHeight
  fabPos.value = clampPos(Math.round((vw - 150) / 2), Math.round(vh * 0.72), 150, 50)
}

function savePos() {
  try { uni.setStorageSync(POS_KEY, fabPos.value) } catch (e) { /* 忽略 */ }
}

function onDragStart(clientX: number, clientY: number) {
  if (state.value !== 'idle') return // 仅空闲态可拖动，避免误触
  isDragging.value = true
  hasMoved.value = false
  dragOffset.value = { dx: clientX - fabPos.value.x, dy: clientY - fabPos.value.y }
}

function onDragMove(clientX: number, clientY: number) {
  if (!isDragging.value) return
  const { w, h } = fabSize()
  const p = clampPos(clientX - dragOffset.value.dx, clientY - dragOffset.value.dy, w, h)
  if (Math.abs(p.x - fabPos.value.x) > 2 || Math.abs(p.y - fabPos.value.y) > 2) hasMoved.value = true
  fabPos.value = p
}

function onDragEnd() {
  if (!isDragging.value) return
  isDragging.value = false
  if (hasMoved.value) savePos()
  setTimeout(() => { hasMoved.value = false }, 60)
}

function onTouchStart(e: any) {
  const t = e.touches && e.touches[0]
  if (t) onDragStart(t.clientX, t.clientY)
}
function onTouchMove(e: any) {
  const t = e.touches && e.touches[0]
  if (t) onDragMove(t.clientX, t.clientY)
}
function onTouchEnd() { onDragEnd() }

onMounted(() => {
  restorePos()
  // #ifdef H5
  vcEl = document.querySelector('.vc-fab') as HTMLElement | null
  if (vcEl) {
    vcEl.addEventListener('mousedown', handleMouseDown)
  }
  // #endif
})

onBeforeUnmount(() => {
  // #ifdef H5
  if (vcEl) {
    vcEl.removeEventListener('mousedown', handleMouseDown)
    window.removeEventListener('mousemove', handleMouseMove)
    window.removeEventListener('mouseup', handleMouseUp)
    vcEl = null
  }
  // #endif
})

// #ifdef H5
function handleMouseDown(e: MouseEvent) {
  e.preventDefault()
  onDragStart(e.clientX, e.clientY)
  window.addEventListener('mousemove', handleMouseMove)
  window.addEventListener('mouseup', handleMouseUp)
}
function handleMouseMove(e: MouseEvent) { onDragMove(e.clientX, e.clientY) }
function handleMouseUp() {
  onDragEnd()
  window.removeEventListener('mousemove', handleMouseMove)
  window.removeEventListener('mouseup', handleMouseUp)
}
// #endif

const fabStyle = computed(() => ({
  left: fabPos.value.x + 'px',
  top: fabPos.value.y + 'px',
}))

const catStore = useCategoryStore()
const accStore = useAccountStore()
const ledgerStore = useLedgerStore()
const budgetStore = useBudgetStore()

let resultTimer: ReturnType<typeof setTimeout> | null = null

function onTap() {
  if (hasMoved.value) return // 刚刚拖动过，不算点击
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
    showResult(false, '请先在「AI 设置」中配置 AI 服务的 API Key')
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
    // 一次解析可能返回多笔（如"午饭30，打车15"）
    const actions = await parseVoiceCommands(text, {
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

    console.log('[VC] AI parsed actions:', JSON.stringify(actions))

    const usable = actions.filter(a => a.action !== 'unknown')
    if (usable.length === 0) {
      showResult(false, actions[0]?.confirmation || '抱歉，没有理解您的指令')
      return
    }

    resultMessage.value =
      usable.length > 1
        ? `识别到 ${usable.length} 笔，正在记录…`
        : usable[0].confirmation || '正在记录…'
    resultSuccess.value = true

    await new Promise(r => setTimeout(r, 500))
    const result = executeCommands(usable)
    console.log('[VC] Execute result:', result)
    if (result.navigateTo) uni.navigateTo({ url: result.navigateTo })
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
  // 错误文案较长，停留更久，保证读完
  resultTimer = setTimeout(() => {
    state.value = 'idle'
    resultMessage.value = ''
  }, success ? 3500 : 7000)
}
</script>

<style scoped>
/* ===== Floating draggable pill container ===== */
.vc-fab {
  position: fixed;
  display: inline-block;
  z-index: 998;
  pointer-events: auto;
  cursor: grab;
  touch-action: none; /* 允许 touch 拖拽 */
  width: max-content;
}

.vc-fab.dragging {
  cursor: grabbing;
  opacity: 0.9;
}

/* 非空闲态展开为固定宽度，展示更多信息 */
.vc-fab.listening,
.vc-fab.processing,
.vc-fab.result {
  width: 320px;
  max-width: calc(100vw - 24px);
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

/* 结果态：文案较长（如麦克风权限被拒绝的处理办法）时高度自适应，避免被截断 */
.vc-fab.result .vc-bar {
  height: auto;
  min-height: 100rpx;
  max-height: 280rpx;
  padding: 20rpx 32rpx;
  align-items: flex-start;
  border-radius: 36rpx;
}

.vc-result-icon {
  font-size: 32rpx;
  flex-shrink: 0;
  margin-right: 16rpx;
}
.vc-fab.result .vc-result-icon { margin-top: 4rpx; }

.vc-result-text {
  font-size: 26rpx;
  flex: 1;
  line-height: 1.45;
  white-space: normal;
  word-break: break-word;
  max-height: 220rpx;
  overflow-y: auto;
}

.vc-bar.success .vc-result-text { color: #166534; }
.vc-bar.error .vc-result-text { color: #991b1b; }
</style>
