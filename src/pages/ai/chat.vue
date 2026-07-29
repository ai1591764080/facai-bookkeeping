<template>
  <view class="page">
    <!-- Nav Bar -->
    <view class="nav-bar" :style="{ paddingTop: statusBarHeight + 'px' }">
      <view class="nav-bar-inner">
        <view class="nav-back" @tap="goBack">
          <text class="nav-back-icon">&#10094;</text>
        </view>
        <text class="nav-title">AI 记账助手</text>
        <view class="nav-action" @tap="clearChat">
          <text class="nav-action-text">清空</text>
        </view>
      </view>
    </view>
    <view :style="{ height: (statusBarHeight + 44) + 'px' }" />

    <!-- Chat Area -->
    <scroll-view
      scroll-y
      class="chat-area"
      :scroll-top="scrollTop"
      :style="{ height: `calc(100vh - ${statusBarHeight + 44}px - 140rpx)` }"
    >
      <!-- Welcome message -->
      <view v-if="aiStore.chatHistory.length === 0" class="welcome">
        <text class="welcome-icon">🤖</text>
        <text class="welcome-title">嗨，我是你的 AI 记账助手</text>
        <text class="welcome-desc">你可以问我关于你的消费数据的任何问题，比如：</text>
        <view class="suggestion-list">
          <view v-for="(s, i) in suggestions" :key="i" class="suggestion-chip" @tap="askSuggestion(s)">
            <text>{{ s }}</text>
          </view>
        </view>
      </view>

      <!-- Messages -->
      <view
        v-for="(msg, i) in aiStore.chatHistory"
        :key="i"
        class="message-row"
        :class="msg.role"
      >
        <view v-if="msg.role === 'assistant'" class="avatar ai-avatar">
          <text>🤖</text>
        </view>
        <view class="bubble" :class="msg.role">
          <text class="bubble-text" :user-select="true">{{ msg.content }}</text>
        </view>
        <view v-if="msg.role === 'user'" class="avatar user-avatar">
          <text>😊</text>
        </view>
      </view>

      <!-- Loading indicator -->
      <view v-if="aiStore.isLoading" class="message-row assistant">
        <view class="avatar ai-avatar"><text>🤖</text></view>
        <view class="bubble assistant">
          <view class="typing-indicator">
            <view class="typing-dot" /><view class="typing-dot" /><view class="typing-dot" />
          </view>
        </view>
      </view>

      <view style="height: 40rpx;" />
    </scroll-view>

    <!-- Input Area -->
    <view class="input-area">
      <view class="chat-mic-btn" :class="{ recording: isRecording }" @tap="toggleVoice">
        <text v-if="isRecording" class="chat-mic-icon active">🔴</text>
        <text v-else class="chat-mic-icon">🎙️</text>
      </view>
      <input
        v-model="inputText"
        class="chat-input"
        placeholder="输入你的问题..."
        :confirm-type="'send'"
        @confirm="sendMessage"
      />
      <view class="send-btn" :class="{ disabled: !inputText.trim() || aiStore.isLoading }" @tap="sendMessage">
        <text class="send-icon">➤</text>
      </view>
    </view>

    <!-- Voice Recording Indicator -->
    <view v-if="isRecording" class="voice-indicator">
      <view class="voice-indicator-waves">
        <view class="vi-wave" /><view class="vi-wave" /><view class="vi-wave" />
      </view>
      <text class="voice-indicator-text">{{ voiceInterimText || '正在聆听...' }}</text>
      <text class="voice-indicator-stop" @tap="stopVoiceInput">点击停止</text>
    </view>

    <VoiceCommander />
  </view>
</template>

<script setup lang="ts">
import { ref, nextTick } from 'vue'
import VoiceCommander from '../../components/VoiceCommander.vue'
import { useAiStore, useTransactionStore, useCategoryStore, useAccountStore } from '../../stores'
import { chatAboutFinance } from '../../utils/ai'
import { hasApiKey } from '../../utils/ai'
import { startVoice, stopVoice, isSupported as isVoiceSupported } from '../../utils/voice'

const aiStore = useAiStore()
const txStore = useTransactionStore()
const catStore = useCategoryStore()
const accStore = useAccountStore()

const statusBarHeight = ref(0)
const inputText = ref('')
const scrollTop = ref(0)

uni.getSystemInfo({ success(res) { statusBarHeight.value = res.statusBarHeight || 0 } })

const suggestions = [
  '这个月花了多少钱？',
  '哪个分类花得最多？',
  '和上个月比有什么变化？',
  '给我一些省钱建议',
  '我最近一周的消费怎么样？',
]

function goBack() {
  uni.navigateBack()
}

function clearChat() {
  aiStore.clearChat()
}

function askSuggestion(text: string) {
  inputText.value = text
  sendMessage()
}

async function sendMessage() {
  const text = inputText.value.trim()
  if (!text || aiStore.isLoading) return

  if (!hasApiKey()) {
    uni.showModal({
      title: '未配置 API Key',
      content: '使用 AI 功能需要先配置DeepSeek API Key，是否去设置？',
      confirmText: '去设置',
      success(res) {
        if (res.confirm) uni.navigateTo({ url: '/pages/ai/settings' })
      },
    })
    return
  }

  inputText.value = ''
  aiStore.addChatMessage('user', text)
  aiStore.setLoading(true)
  scrollToBottom()

  try {
    const reply = await chatAboutFinance(
      aiStore.getHistoryForAPI(),
      text,
      txStore.transactions,
      catStore.categories,
      accStore.accounts
    )
    aiStore.addChatMessage('assistant', reply)
  } catch (e: any) {
    aiStore.addChatMessage('assistant', `抱歉，出错了：${e.message}`)
  } finally {
    aiStore.setLoading(false)
    scrollToBottom()
  }
}

function scrollToBottom() {
  nextTick(() => { scrollTop.value = 999999 })
}

// ---------- Voice Input ----------
const isRecording = ref(false)
const voiceInterimText = ref('')

function toggleVoice() {
  if (isRecording.value) {
    stopVoiceInput()
    return
  }
  if (!isVoiceSupported()) {
    uni.showModal({
      title: '不支持语音识别',
      content: '当前浏览器不支持语音识别，请使用 Chrome 浏览器。',
      showCancel: false,
    })
    return
  }

  isRecording.value = true
  voiceInterimText.value = ''

  startVoice(
    (result) => {
      voiceInterimText.value = result.text
      if (result.isFinal && result.text.trim()) {
        inputText.value = result.text.trim()
        isRecording.value = false
        voiceInterimText.value = ''
        setTimeout(() => sendMessage(), 300)
      }
    },
    (error) => {
      isRecording.value = false
      voiceInterimText.value = ''
      uni.showToast({ title: error, icon: 'none', duration: 3000 })
    }
  )
}

function stopVoiceInput() {
  stopVoice()
  if (voiceInterimText.value.trim()) {
    inputText.value = voiceInterimText.value.trim()
  }
  isRecording.value = false
  voiceInterimText.value = ''
}
</script>

<style scoped>
.page {
  min-height: 100vh;
  background: var(--bg);
  display: flex;
  flex-direction: column;
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
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 24rpx;
}

.nav-back {
  width: 60rpx; height: 60rpx;
  display: flex; align-items: center; justify-content: center;
}

.nav-back-icon { font-size: 36rpx; color: var(--text-primary); }
.nav-title { font-size: 32rpx; font-weight: 600; color: var(--text-primary); }
.nav-action { padding: 8rpx 16rpx; }
.nav-action-text { font-size: 26rpx; color: var(--primary); }

/* Chat Area */
.chat-area {
  flex: 1;
  padding: 24rpx;
  box-sizing: border-box;
}

/* Welcome */
.welcome {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 80rpx 40rpx 40rpx;
}

.welcome-icon { font-size: 100rpx; margin-bottom: 20rpx; }
.welcome-title { font-size: 36rpx; font-weight: 600; color: var(--text-primary); margin-bottom: 12rpx; }
.welcome-desc { font-size: 26rpx; color: var(--text-secondary); margin-bottom: 40rpx; }

.suggestion-list {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 16rpx;
}

.suggestion-chip {
  background: var(--card);
  border: 2rpx solid var(--border);
  border-radius: 40rpx;
  padding: 16rpx 28rpx;
  font-size: 26rpx;
  color: var(--primary);
}

.suggestion-chip:active {
  background: var(--primary-light);
  border-color: var(--primary);
}

/* Messages */
.message-row {
  display: flex;
  align-items: flex-start;
  margin-bottom: 28rpx;
}

.message-row.user { justify-content: flex-end; }
.message-row.assistant { justify-content: flex-start; }

.avatar {
  width: 64rpx; height: 64rpx;
  border-radius: 50%;
  display: flex; align-items: center; justify-content: center;
  font-size: 32rpx;
  flex-shrink: 0;
}

.ai-avatar {
  background: var(--primary-light);
  margin-right: 16rpx;
}

.user-avatar {
  background: var(--bg);
  margin-left: 16rpx;
}

.bubble {
  max-width: 70%;
  padding: 24rpx 28rpx;
  border-radius: 24rpx;
  line-height: 1.6;
}

.bubble.user {
  background: var(--primary);
  color: #fff;
  border-bottom-right-radius: 8rpx;
}

.bubble.assistant {
  background: var(--card);
  color: var(--text-primary);
  border-bottom-left-radius: 8rpx;
  box-shadow: 0 2rpx 8rpx var(--shadow);
}

.bubble-text {
  font-size: 28rpx;
  word-break: break-all;
  white-space: pre-wrap;
}

/* Typing indicator */
.typing-indicator {
  display: flex;
  align-items: center;
  gap: 8rpx;
  padding: 8rpx 0;
}

.typing-dot {
  width: 12rpx; height: 12rpx;
  border-radius: 50%;
  background: var(--text-tertiary);
  animation: typing 1.2s infinite;
}

.typing-dot:nth-child(2) { animation-delay: 0.2s; }
.typing-dot:nth-child(3) { animation-delay: 0.4s; }

@keyframes typing {
  0%, 60%, 100% { opacity: 0.3; transform: scale(0.8); }
  30% { opacity: 1; transform: scale(1); }
}

/* Input Area */
.input-area {
  display: flex;
  align-items: center;
  padding: 16rpx 24rpx;
  padding-bottom: calc(16rpx + env(safe-area-inset-bottom));
  background: var(--card);
  box-shadow: 0 -2rpx 12rpx var(--shadow);
  gap: 16rpx;
}

.chat-input {
  flex: 1;
  height: 76rpx;
  background: var(--bg);
  border-radius: 40rpx;
  padding: 0 28rpx;
  font-size: 28rpx;
  color: var(--text-primary);
}

.send-btn {
  width: 76rpx; height: 76rpx;
  border-radius: 50%;
  background: var(--primary);
  display: flex; align-items: center; justify-content: center;
  flex-shrink: 0;
}

.send-btn.disabled { opacity: 0.5; }
.send-icon { font-size: 32rpx; color: #fff; }

/* Chat Mic Button */
.chat-mic-btn {
  width: 64rpx; height: 64rpx;
  border-radius: 50%;
  background: var(--bg);
  display: flex; align-items: center; justify-content: center;
  flex-shrink: 0;
  border: 2rpx solid var(--border);
  transition: all 0.2s ease;
}

.chat-mic-btn:active { transform: scale(0.9); }

.chat-mic-btn.recording {
  background: #FF6B6B;
  border-color: #FF6B6B;
  animation: chat-mic-pulse 1s infinite;
}

.chat-mic-icon { font-size: 28rpx; }
.chat-mic-icon.active { font-size: 24rpx; }

@keyframes chat-mic-pulse {
  0%, 100% { box-shadow: 0 0 0 0 rgba(255, 107, 107, 0.4); }
  50% { box-shadow: 0 0 0 12rpx rgba(255, 107, 107, 0); }
}

/* Voice Indicator Bar */
.voice-indicator {
  position: fixed;
  bottom: 140rpx;
  left: 50%;
  transform: translateX(-50%);
  background: var(--card);
  border-radius: 40rpx;
  padding: 16rpx 32rpx;
  display: flex;
  align-items: center;
  gap: 16rpx;
  box-shadow: 0 8rpx 32rpx rgba(0, 0, 0, 0.15);
  z-index: 200;
}

.voice-indicator-waves {
  display: flex; align-items: center; gap: 4rpx; height: 32rpx;
}

.vi-wave {
  width: 6rpx;
  background: var(--primary);
  border-radius: 3rpx;
  animation: vi-wave 0.8s ease-in-out infinite;
}

.vi-wave:nth-child(1) { height: 12rpx; animation-delay: 0s; }
.vi-wave:nth-child(2) { height: 24rpx; animation-delay: 0.2s; }
.vi-wave:nth-child(3) { height: 12rpx; animation-delay: 0.4s; }

@keyframes vi-wave {
  0%, 100% { transform: scaleY(0.5); }
  50% { transform: scaleY(1.2); }
}

.voice-indicator-text {
  font-size: 26rpx;
  color: var(--text-primary);
  max-width: 400rpx;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.voice-indicator-stop {
  font-size: 24rpx;
  color: var(--primary);
  font-weight: 500;
  padding: 4rpx 16rpx;
}
</style>
