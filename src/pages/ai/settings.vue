<template>
  <view class="page">
    <view class="container">
      <!-- API Key Settings -->
      <view class="card">
        <text class="section-title">🔑 API 配置</text>
        <text class="desc">请输入 DeepSeek API Key，用于驱动 AI 分析功能。</text>
        <view class="input-group">
          <text class="input-label">API Key</text>
          <input
            v-model="apiKey"
            class="input-field"
            type="text"
            placeholder="sk-xxxxxxxxxxxxxxxxxxxxxxxx"
            :password="!showKey"
          />
          <view class="input-actions">
            <view class="toggle-btn" @tap="showKey = !showKey">
              <text class="toggle-text">{{ showKey ? '隐藏' : '显示' }}</text>
            </view>
          </view>
        </view>
        <view class="btn-primary save-btn" @tap="saveKey">保存</view>
      </view>

      <!-- How to get API Key -->
      <view class="card">
        <text class="section-title">📖 如何获取 API Key</text>
        <view class="steps">
          <view class="step">
            <text class="step-num">1</text>
            <text class="step-text">访问 DeepSeek 开放平台：platform.deepseek.com</text>
          </view>
          <view class="step">
            <text class="step-num">2</text>
            <text class="step-text">注册/登录 DeepSeek 账号</text>
          </view>
          <view class="step">
            <text class="step-num">3</text>
            <text class="step-text">进入"API Keys"页面，点击"创建 API Key"</text>
          </view>
          <view class="step">
            <text class="step-num">4</text>
            <text class="step-text">复制生成的 API Key 粘贴到上方输入框</text>
          </view>
        </view>
      </view>

      <!-- Speech Recognition - iFlytek -->
      <view class="card">
        <text class="section-title">🎙️ 语音识别配置（讯飞）</text>
        <text class="desc">语音识别使用科大讯飞语音听写服务，实时返回识别结果，国内快速稳定。</text>
        <view class="input-group">
          <text class="input-label">AppID</text>
          <input
            v-model="xfAppId"
            class="input-field"
            type="text"
            placeholder="讯飞开放平台 AppID"
          />
        </view>
        <view class="input-group">
          <text class="input-label">API Key</text>
          <input
            v-model="xfApiKey"
            class="input-field"
            type="text"
            placeholder="讯飞 API Key"
            :password="!showXfKey"
          />
          <view class="input-actions">
            <view class="toggle-btn" @tap="showXfKey = !showXfKey">
              <text class="toggle-text">{{ showXfKey ? '隐藏' : '显示' }}</text>
            </view>
          </view>
        </view>
        <view class="input-group">
          <text class="input-label">API Secret</text>
          <input
            v-model="xfApiSecret"
            class="input-field"
            type="text"
            placeholder="讯飞 API Secret"
            :password="!showXfSecret"
          />
          <view class="input-actions">
            <view class="toggle-btn" @tap="showXfSecret = !showXfSecret">
              <text class="toggle-text">{{ showXfSecret ? '隐藏' : '显示' }}</text>
            </view>
          </view>
        </view>
        <view class="btn-primary save-btn" @tap="saveXfyunConfig">保存</view>
        <view class="asr-help">
          <text class="asr-help-text">获取方式：访问 www.xfyun.cn → 控制台 → 语音识别 → 语音听写 → 创建应用获取 AppID / APIKey / APISecret</text>
        </view>
      </view>

      <!-- Model Settings -->
      <view class="card">
        <text class="section-title">⚙️ 模型设置</text>
        <view class="setting-item">
          <text class="setting-label">分析模型</text>
          <picker :range="models" :range-key="'label'" :value="modelIndex" @change="onModelChange">
            <view class="picker-value">
              <text>{{ models[modelIndex].label }}</text>
              <text class="picker-arrow">▸</text>
            </view>
          </picker>
        </view>
        <text class="setting-hint">{{ models[modelIndex].desc }}</text>
      </view>

      <!-- Status -->
      <view class="card" v-if="hasKey">
        <view class="status-row">
          <text class="status-dot active" />
          <text class="status-text">DeepSeek API Key 已配置，AI 分析可用</text>
        </view>
      </view>
      <view class="card" v-else>
        <view class="status-row">
          <text class="status-dot" />
          <text class="status-text">未配置 DeepSeek API Key，AI 分析不可用</text>
        </view>
      </view>

      <view class="card" v-if="hasXfyun">
        <view class="status-row">
          <text class="status-dot active" />
          <text class="status-text">讯飞语音已配置，语音识别可用</text>
        </view>
      </view>
      <view class="card" v-else>
        <view class="status-row">
          <text class="status-dot" />
          <text class="status-text">未配置讯飞语音，语音识别不可用</text>
        </view>
      </view>
    </view>

    <VoiceCommander />
  </view>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue' // Vue 响应式与生命周期：ref 响应式，onMounted 组件挂载后触发
import VoiceCommander from '../../components/VoiceCommander.vue' // 语音记账组件
import { setApiKey, hasApiKey as checkHasApiKey } from '../../utils/ai' // 保存/读取 AI API Key
import { setXfyunConfig, hasXfyunConfig, getXfyunConfig } from '../../utils/voice' // 讯飞语音识别配置的写入/检查/读取

const apiKey = ref('')
const showKey = ref(false)
const hasKey = ref(false)

// 讯飞语音配置
const xfAppId = ref('')
const xfApiKey = ref('')
const xfApiSecret = ref('')
const showXfKey = ref(false)
const showXfSecret = ref(false)
const hasXfyun = ref(false)

const modelIndex = ref(0)

const models = [
  { label: 'DeepSeek-V4-Pro', value: 'deepseek-v4-pro', desc: '旗舰模型，分析更准确，适合深度财务分析' },
  { label: 'DeepSeek-V4-Flash', value: 'deepseek-v4-flash', desc: '轻量快速模型，性价比高，适合日常记账分析' },
]

onMounted(() => {
  hasKey.value = checkHasApiKey()
  hasXfyun.value = hasXfyunConfig()
  const savedModel = uni.getStorageSync('beecount_ai_model')
  if (savedModel) {
    const idx = models.findIndex((m) => m.value === savedModel)
    if (idx >= 0) modelIndex.value = idx
  }
})

function saveKey() {
  const key = apiKey.value.trim()
  if (!key) {
    uni.showToast({ title: '请输入 API Key', icon: 'none' })
    return
  }
  if (!key.startsWith('sk-')) {
    uni.showToast({ title: 'API Key 格式不正确，应以 sk- 开头', icon: 'none' })
    return
  }
  setApiKey(key)
  hasKey.value = true
  uni.showToast({ title: '保存成功', icon: 'success' })
  apiKey.value = ''
}

function saveXfyunConfig() {
  const appId = xfAppId.value.trim()
  const key = xfApiKey.value.trim()
  const secret = xfApiSecret.value.trim()

  if (!appId || !key || !secret) {
    uni.showToast({ title: '请填写完整的 AppID、API Key、API Secret', icon: 'none' })
    return
  }

  setXfyunConfig({ appId, apiKey: key, apiSecret: secret })
  hasXfyun.value = true
  uni.showToast({ title: '保存成功', icon: 'success' })
  xfAppId.value = ''
  xfApiKey.value = ''
  xfApiSecret.value = ''
}

function onModelChange(e: any) {
  const idx = Number(e.detail.value)
  modelIndex.value = idx
  uni.setStorageSync('beecount_ai_model', models[idx].value)
  uni.showToast({ title: '已切换模型', icon: 'success' })
}
</script>

<style scoped>
.page {
  min-height: 100vh;
  background: var(--bg);
}

.desc {
  font-size: 26rpx;
  color: var(--text-secondary);
  margin-bottom: 24rpx;
  line-height: 1.6;
}

.input-group {
  margin-bottom: 24rpx;
}

.input-label {
  font-size: 26rpx;
  color: var(--text-secondary);
  margin-bottom: 12rpx;
  display: block;
}

.input-field {
  width: 100%;
  height: 80rpx;
  background: var(--bg);
  border-radius: var(--radius);
  padding: 0 24rpx;
  font-size: 28rpx;
  color: var(--text-primary);
  box-sizing: border-box;
}

.input-actions {
  display: flex;
  justify-content: flex-end;
  margin-top: 12rpx;
}

.toggle-btn {
  padding: 8rpx 16rpx;
}

.toggle-text {
  font-size: 24rpx;
  color: var(--primary);
}

.save-btn {
  width: 100%;
  height: 84rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 30rpx;
}

.asr-help {
  margin-top: 16rpx;
}

.asr-help-text {
  font-size: 24rpx;
  color: var(--text-tertiary);
  line-height: 1.6;
}

/* Steps */
.steps {
  margin-top: 8rpx;
}

.step {
  display: flex;
  align-items: flex-start;
  margin-bottom: 20rpx;
}

.step-num {
  width: 40rpx; height: 40rpx;
  background: var(--primary);
  color: #fff;
  border-radius: 50%;
  display: flex; align-items: center; justify-content: center;
  font-size: 22rpx;
  font-weight: 600;
  flex-shrink: 0;
  margin-right: 16rpx;
  margin-top: 2rpx;
}

.step-text {
  font-size: 26rpx;
  color: var(--text-primary);
  line-height: 1.6;
  flex: 1;
}

/* Settings */
.setting-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16rpx 0;
}

.setting-label {
  font-size: 28rpx;
  color: var(--text-primary);
}

.picker-value {
  display: flex;
  align-items: center;
  background: var(--bg);
  padding: 12rpx 20rpx;
  border-radius: var(--radius);
  font-size: 26rpx;
  color: var(--primary);
}

.picker-arrow {
  margin-left: 8rpx;
  color: var(--text-tertiary);
}

.setting-hint {
  font-size: 24rpx;
  color: var(--text-tertiary);
  margin-top: 8rpx;
}

/* Status */
.status-row {
  display: flex;
  align-items: center;
}

.status-dot {
  width: 16rpx; height: 16rpx;
  border-radius: 50%;
  background: var(--text-tertiary);
  margin-right: 12rpx;
}

.status-dot.active {
  background: var(--income);
}

.status-text {
  font-size: 28rpx;
  color: var(--text-primary);
}
</style>
