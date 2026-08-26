<template>
  <!-- 统一可拖拽工具条：添加 / AI / 语音，贴边自动折叠，划一下重新出来 -->
  <view
    class="dock"
    :class="[edge, { dragging: isDragging, collapsed }]"
    :style="dockStyle"
    @tap="onRootTap"
    @touchstart.stop="onTouchStart"
    @touchmove.stop.prevent="onTouchMove"
    @touchend.stop="onTouchEnd"
    @touchcancel.stop="onTouchEnd"
  >
    <!-- ===== 语音模式：水平胶囊 ===== -->
    <view v-if="voiceMode" class="dock-voice">
      <view v-if="vcState === 'listening'" class="dvc-bar listening">
        <view class="dvc-waves">
          <view class="dvc-wave" /><view class="dvc-wave" /><view class="dvc-wave" />
          <view class="dvc-wave" /><view class="dvc-wave" /><view class="dvc-wave" />
        </view>
        <text class="dvc-text">{{ interimText || '正在聆听...' }}</text>
        <view class="dvc-stop" data-btn="stop" @tap.stop="onRootTap">
          <text class="dvc-stop-text">完成</text>
        </view>
      </view>
      <view v-else-if="vcState === 'processing'" class="dvc-bar processing">
        <view class="dvc-spinner" />
        <text class="dvc-text primary">AI 分析中...</text>
      </view>
      <view v-else-if="vcState === 'result'" class="dvc-bar" :class="resultSuccess ? 'success' : 'error'">
        <text class="dvc-result-icon">{{ resultSuccess ? '✅' : '❌' }}</text>
        <text class="dvc-text">{{ resultMessage }}</text>
      </view>
    </view>

    <!-- ===== 三按钮模式（可拖拽 + 点击） ===== -->
    <view v-else class="dock-btns">
      <view class="dock-btn add" data-btn="0"><text class="dock-btn-icon" data-btn="0">＋</text></view>
      <view class="dock-btn ai" data-btn="1"><text class="dock-btn-icon" data-btn="1">🤖</text></view>
      <view class="dock-btn mic" data-btn="2"><text class="dock-btn-icon" data-btn="2">🎙️</text></view>
      <view class="dock-grip"><text class="dock-grip-dots">⠿</text></view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import { startVoice, stopVoice, hasXfyunConfig, getVoiceMode } from '../utils/voice'
import { parseVoiceCommand, hasApiKey } from '../utils/ai'
import { executeCommand } from '../utils/command'
import { useCategoryStore, useAccountStore, useLedgerStore, useBudgetStore } from '../stores'

type VcState = 'idle' | 'listening' | 'processing' | 'result'

// ===== 尺寸（px） =====
const BTN = 56
const GAP = 12
const PAD = 10
const DOCK_W = BTN + PAD * 2           // 76
const DOCK_H = BTN * 3 + GAP * 2 + PAD * 2 // 212
const VOICE_W = 300
const VOICE_H = 64
const COLLAPSED_W = 46
const COLLAPSED_H = 150
const MOVE_THRESHOLD = 8 // 超过该位移才视为拖动

// ===== 语音状态 =====
const vcState = ref<VcState>('idle')
const interimText = ref('')
const resultMessage = ref('')
const resultSuccess = ref(false)
const voiceMode = ref(false)
let resultTimer: ReturnType<typeof setTimeout> | null = null

// ===== 位置与拖拽 =====
const POS_KEY = 'beecount_dock_pos'
const fabPos = ref({ x: 0, y: 0 })
const isDragging = ref(false)
const hasMoved = ref(false)
const dragOffset = ref({ dx: 0, dy: 0 })
const collapsed = ref(false)
const edge = ref<'left' | 'right'>('right')
let lastTapAt = 0
let dockEl: HTMLElement | null = null

function currentSize() {
  if (collapsed.value) return { w: COLLAPSED_W, h: COLLAPSED_H }
  if (voiceMode.value) return { w: VOICE_W, h: VOICE_H }
  return { w: DOCK_W, h: DOCK_H }
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
    if (saved && typeof saved.x === 'number') {
      fabPos.value = { x: saved.x, y: saved.y }
      collapsed.value = !!saved.collapsed
      edge.value = saved.edge || 'right'
      return
    }
  } catch (e) { /* 忽略 */ }
  const vw = uni.getSystemInfoSync().windowWidth
  const vh = uni.getSystemInfoSync().windowHeight
  // 默认：右侧贴边折叠，不展开（点一下/划一下再展开）
  fabPos.value = clampPos(vw - COLLAPSED_W, vh * 0.5, COLLAPSED_W, COLLAPSED_H)
  edge.value = 'right'
  collapsed.value = true
}

function savePos() {
  try {
    uni.setStorageSync(POS_KEY, { x: fabPos.value.x, y: fabPos.value.y, collapsed: collapsed.value, edge: edge.value })
  } catch (e) { /* 忽略 */ }
}

function onDragStart(clientX: number, clientY: number) {
  if (voiceMode.value) return // 语音模式不拖拽
  if (collapsed.value) expand() // 折叠态：按下立即展开
  isDragging.value = true
  hasMoved.value = false
  dragOffset.value = { dx: clientX - fabPos.value.x, dy: clientY - fabPos.value.y }
}

function onDragMove(clientX: number, clientY: number) {
  if (!isDragging.value) return
  const { w, h } = currentSize()
  const p = clampPos(clientX - dragOffset.value.dx, clientY - dragOffset.value.dy, w, h)
  if (Math.abs(p.x - fabPos.value.x) > MOVE_THRESHOLD || Math.abs(p.y - fabPos.value.y) > MOVE_THRESHOLD) {
    hasMoved.value = true
  }
  fabPos.value = p
}

function onDragEnd() {
  if (!isDragging.value) return
  isDragging.value = false
  if (hasMoved.value) {
    settle() // 拖动结束：贴边吸附 / 折叠
    savePos()
  }
  setTimeout(() => { hasMoved.value = false }, 80)
}

// 松手吸附：贴近左/右边缘则折叠，否则保持
function settle() {
  const { w, h } = currentSize()
  const vw = uni.getSystemInfoSync().windowWidth
  const distLeft = fabPos.value.x
  const distRight = vw - (fabPos.value.x + w)
  if (distRight < 56) {
    collapsed.value = true
    edge.value = 'right'
    fabPos.value = clampPos(vw - COLLAPSED_W, fabPos.value.y, COLLAPSED_W, COLLAPSED_H)
  } else if (distLeft < 56) {
    collapsed.value = true
    edge.value = 'left'
    fabPos.value = clampPos(0, fabPos.value.y, COLLAPSED_W, COLLAPSED_H)
  } else {
    collapsed.value = false
    edge.value = distLeft < vw / 2 ? 'left' : 'right'
  }
}

function expand() {
  collapsed.value = false
  const { w, h } = currentSize()
  fabPos.value = clampPos(fabPos.value.x, fabPos.value.y, w, h)
}

function clampKeepInView() {
  const { w, h } = currentSize()
  fabPos.value = clampPos(fabPos.value.x, fabPos.value.y, w, h)
}

// ===== touch（移动端） =====
function onTouchStart(e: any) {
  const t = e.touches && e.touches[0]
  if (t) onDragStart(t.clientX, t.clientY)
}
function onTouchMove(e: any) {
  const t = e.touches && e.touches[0]
  if (t) onDragMove(t.clientX, t.clientY)
}
function onTouchEnd() { onDragEnd() }

// ===== 点击：统一由 @tap 处理（跨端可靠，复用 VoiceCommander 模式） =====
function onRootTap(e: any) {
  if (hasMoved.value) return // 刚刚拖动过，不算点击
  // 防抖：H5 触摸屏 touch+mouse 可能触发两次
  const now = Date.now()
  if (now - lastTapAt < 300) return
  lastTapAt = now

  if (voiceMode.value) {
    if (readBtn(e) === 'stop') onVoiceStop()
    return
  }
  if (collapsed.value) { expand(); return }

  const idx = readBtn(e)
  if (idx === 0) uni.navigateTo({ url: '/pages/add/add' })
  else if (idx === 1) uni.navigateTo({ url: '/pages/ai/chat' })
  else if (idx === 2) startListening()
}

// 从事件对象读取 data-btn（兼容 H5 DOM 与小程序：向上查找最近的 data-btn），返回数字索引
function readBtn(e: any): number | null {
  if (!e) return null
  let node = e.target || e.currentTarget
  if (!node) return null
  let raw: any = null
  // H5: DOM 元素支持 closest
  if (typeof node.closest === 'function') {
    const el = node.closest('[data-btn]')
    if (el && el.dataset && el.dataset.btn !== undefined) raw = el.dataset.btn
  } else {
    // 小程序 / 其他：向上遍历
    while (node) {
      const ds = node.dataset || {}
      if (ds.btn !== undefined && ds.btn !== null) { raw = ds.btn; break }
      node = node.parentNode
    }
  }
  if (raw === null) return null
  const s = String(raw)
  if (s === 'stop') return s as any // 语音胶囊的"完成"按钮
  const n = typeof raw === 'number' ? raw : parseInt(s, 10)
  return isNaN(n) ? null : n
}

// ===== H5 鼠标拖拽（mousedown 不 preventDefault，避免吞掉 click/tap） =====
onMounted(() => {
  restorePos()
  // #ifdef H5
  dockEl = document.querySelector('.dock') as HTMLElement | null
  if (dockEl) {
    dockEl.addEventListener('mousedown', handleMouseDown)
    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleMouseUp)
  }
  // #endif
})

onBeforeUnmount(() => {
  // #ifdef H5
  if (dockEl) {
    dockEl.removeEventListener('mousedown', handleMouseDown)
    window.removeEventListener('mousemove', handleMouseMove)
    window.removeEventListener('mouseup', handleMouseUp)
    dockEl = null
  }
  // #endif
})

// #ifdef H5
function handleMouseDown(e: MouseEvent) {
  if (voiceMode.value) return
  onDragStart(e.clientX, e.clientY)
}
function handleMouseMove(e: MouseEvent) { onDragMove(e.clientX, e.clientY) }
function handleMouseUp() { onDragEnd() }
// #endif

const dockStyle = computed(() => ({
  left: fabPos.value.x + 'px',
  top: fabPos.value.y + 'px',
}))

// ===== 语音逻辑（复用 VoiceCommander） =====
const catStore = useCategoryStore()
const accStore = useAccountStore()
const ledgerStore = useLedgerStore()
const budgetStore = useBudgetStore()

function startListening() {
  // 前置校验：缺配置给明确提示
  if (getVoiceMode() === 'none') {
    uni.showModal({
      title: '语音识别未开启',
      content: '语音记账需要配置讯飞语音的 AppID、APIKey、APISecret（在「AI 设置」中填写），是否现在去配置？',
      confirmText: '去配置',
      cancelText: '取消',
      success: (r) => { if (r.confirm) uni.navigateTo({ url: '/pages/ai/settings' }) },
    })
    return
  }
  if (!hasApiKey()) {
    uni.showModal({
      title: '缺少 AI 配置',
      content: '语音指令需要 DeepSeek API Key 来解析，是否现在去「AI 设置」配置？',
      confirmText: '去配置',
      cancelText: '取消',
      success: (r) => { if (r.confirm) uni.navigateTo({ url: '/pages/ai/settings' }) },
    })
    return
  }
  if (resultTimer) { clearTimeout(resultTimer); resultTimer = null }
  voiceMode.value = true
  vcState.value = 'listening'
  interimText.value = ''
  clampKeepInView()

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

function onVoiceStop() {
  stopVoice()
  if (interimText.value.trim()) {
    processCommand(interimText.value.trim())
  } else {
    resetVoice()
  }
}

async function processCommand(text: string) {
  vcState.value = 'processing'
  interimText.value = ''
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
    if (action.action === 'unknown') {
      showResult(false, action.confirmation || '抱歉，没有理解您的指令')
      return
    }
    resultMessage.value = action.confirmation
    resultSuccess.value = true
    await new Promise(r => setTimeout(r, 500))
    const result = executeCommand(action)
    showResult(result.success, result.message)
  } catch (e: any) {
    showResult(false, `AI 解析失败: ${e.message || '请重试'}`)
  }
}

function showResult(success: boolean, message: string) {
  resultSuccess.value = success
  resultMessage.value = message
  vcState.value = 'result'
  if (resultTimer) clearTimeout(resultTimer)
  resultTimer = setTimeout(() => {
    resetVoice()
  }, 4000)
}

function resetVoice() {
  vcState.value = 'idle'
  interimText.value = ''
  resultMessage.value = ''
  voiceMode.value = false
  clampKeepInView()
  savePos()
}
</script>

<style scoped>
.dock {
  position: fixed;
  z-index: 998;
  cursor: grab;
  touch-action: none;
  user-select: none;
}
.dock.dragging { cursor: grabbing; opacity: 0.92; }

/* ===== 三按钮模式 ===== */
.dock-btns {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  padding: 10px;
  background: rgba(255, 255, 255, 0.9);
  border: 1px solid rgba(79, 110, 247, 0.18);
  border-radius: 20px;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.12);
  backdrop-filter: blur(6px);
}
.dock-btn {
  width: 56px;
  height: 56px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.12);
  transition: transform 0.15s ease;
}
.dock-btn:active { transform: scale(0.92); }
.dock-btn.add { background: linear-gradient(135deg, #4f6ef7, #6f9bf7); }
.dock-btn.ai { background: linear-gradient(135deg, #7c5cf0, #a06cf7); }
.dock-btn.mic { background: linear-gradient(135deg, #f76b6b, #f79a6b); }
.dock-btn-icon { font-size: 30px; color: #fff; line-height: 1; }
.dock-grip {
  width: 34px;
  height: 18px;
  border-radius: 9px;
  background: rgba(79, 110, 247, 0.12);
  display: flex;
  align-items: center;
  justify-content: center;
}
.dock-grip-dots { font-size: 20px; color: rgba(79, 110, 247, 0.5); line-height: 1; }

/* ===== 折叠态窄条 ===== */
.dock.collapsed::before {
  content: '⠿';
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 100%;
  background: rgba(255, 255, 255, 0.92);
  border: 1px solid rgba(79, 110, 247, 0.25);
  border-radius: 12px;
  box-shadow: 0 6px 18px rgba(0, 0, 0, 0.1);
  font-size: 22px;
  color: #4f6ef7;
}
.dock.collapsed .dock-btns { display: none; }
.dock.collapsed.edge-left::before { border-radius: 0 12px 12px 0; }
.dock.collapsed.edge-right::before { border-radius: 12px 0 0 12px; }

/* ===== 语音胶囊 ===== */
.dock-voice {
  width: 300px;
  max-width: calc(100vw - 20px);
}
.dvc-bar {
  display: flex;
  align-items: center;
  height: 60px;
  background: var(--card);
  border-radius: 32px;
  padding: 0 22px;
  box-shadow: 0 8px 28px rgba(79, 110, 247, 0.2);
  border: 1px solid var(--primary-light);
}
.dvc-bar.listening {
  background: linear-gradient(135deg, #ff6b6b, #ee5a5a);
  border-color: transparent;
  box-shadow: 0 8px 28px rgba(255, 107, 107, 0.35);
}
.dvc-bar.processing { border-color: var(--primary); }
.dvc-bar.success { background: #f0fdf4; border-color: var(--income); }
.dvc-bar.error { background: #fef2f2; border-color: var(--expense); }
.dvc-text { font-size: 15px; flex: 1; color: #fff; overflow: hidden; white-space: nowrap; text-overflow: ellipsis; }
.dvc-text.primary { color: var(--primary); font-weight: 600; }
.dvc-bar.success .dvc-text { color: #166534; }
.dvc-bar.error .dvc-text { color: #991b1b; }
.dvc-result-icon { font-size: 18px; flex-shrink: 0; margin-right: 8px; }

.dvc-waves { display: flex; align-items: center; gap: 3px; height: 30px; flex-shrink: 0; margin-right: 10px; }
.dvc-wave { width: 4px; background: rgba(255, 255, 255, 0.85); border-radius: 2px; animation: dvc-wave-anim 0.7s ease-in-out infinite; }
.dvc-wave:nth-child(1) { height: 10px; }
.dvc-wave:nth-child(2) { height: 18px; animation-delay: 0.08s; }
.dvc-wave:nth-child(3) { height: 24px; animation-delay: 0.16s; }
.dvc-wave:nth-child(4) { height: 28px; animation-delay: 0.24s; }
.dvc-wave:nth-child(5) { height: 24px; animation-delay: 0.32s; }
.dvc-wave:nth-child(6) { height: 18px; animation-delay: 0.40s; }
@keyframes dvc-wave-anim { 0%,100% { transform: scaleY(0.4); } 50% { transform: scaleY(1.1); } }

.dvc-stop { flex-shrink: 0; background: rgba(255, 255, 255, 0.25); border-radius: 18px; padding: 6px 16px; margin-left: 10px; }
.dvc-stop-text { font-size: 14px; color: #fff; font-weight: 600; }

.dvc-spinner { width: 22px; height: 22px; border: 3px solid var(--primary-light); border-top-color: var(--primary); border-radius: 50%; animation: dvc-spin 0.7s linear infinite; flex-shrink: 0; margin-right: 10px; }
@keyframes dvc-spin { to { transform: rotate(360deg); } }
</style>
