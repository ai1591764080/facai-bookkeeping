<template>
  <view class="page">
    <view class="container">
      <!-- AI 服务配置 -->
      <view class="card">
        <text class="section-title">🤖 AI 服务配置</text>
        <text class="desc">支持任意 OpenAI 兼容协议的服务：DeepSeek、OpenAI、通义千问、智谱、Kimi、豆包、硅基流动、Groq、本地 Ollama，也可直连 Claude 或填写自定义中转地址。</text>

        <view class="setting-item">
          <text class="setting-label">服务商</text>
          <picker :range="providers" :range-key="'name'" :value="providerIndex" @change="onProviderChange">
            <view class="picker-value">
              <text>{{ providers[providerIndex].name }}</text>
              <text class="picker-arrow">▸</text>
            </view>
          </picker>
        </view>

        <view class="input-group">
          <text class="input-label">接口地址</text>
          <input
            v-model="baseUrl"
            class="input-field"
            type="text"
            placeholder="https://xxx/v1/chat/completions"
          />
        </view>

        <view class="input-group">
          <text class="input-label">模型名称</text>
          <input
            v-model="model"
            class="input-field"
            type="text"
            :placeholder="modelPlaceholder"
          />
        </view>

        <view class="input-group">
          <text class="input-label">API Key</text>
          <input
            v-model="apiKey"
            class="input-field"
            type="text"
            :placeholder="keyPlaceholder"
            :password="!showKey"
          />
          <view class="input-actions">
            <view class="toggle-btn" @tap="showKey = !showKey">
              <text class="toggle-text">{{ showKey ? '隐藏' : '显示' }}</text>
            </view>
          </view>
        </view>

        <text class="setting-hint">接口地址可只填根地址（如 https://api.deepseek.com 或 .../v1），保存时会自动补全为完整接口地址</text>

        <view class="btn-row">
          <view class="btn-secondary" @tap="testConnection">
            <text>{{ testing ? '测试中…' : '🧪 测试连接' }}</text>
          </view>
          <view class="btn-primary save-btn" @tap="saveConfig">保存</view>
        </view>
      </view>

      <!-- How to get API Key -->
      <view class="card">
        <text class="section-title">📖 如何获取 API Key</text>
        <view class="steps">
          <view class="step">
            <text class="step-num">1</text>
            <text class="step-text">打开所选服务商的开放平台（路径见下方提示）</text>
          </view>
          <view class="step">
            <text class="step-num">2</text>
            <text class="step-text">注册并登录账号，进入 API Key / 密钥管理页</text>
          </view>
          <view class="step">
            <text class="step-num">3</text>
            <text class="step-text">创建新密钥，复制后粘贴到上方 API Key 输入框</text>
          </view>
          <view class="step">
            <text class="step-num">4</text>
            <text class="step-text">点「测试连接」验证，通过后再点「保存」</text>
          </view>
        </view>
        <view class="asr-help">
          <text class="asr-help-text">当前服务商获取方式：{{ currentDoc }}</text>
        </view>
      </view>

      <!-- Speech Recognition -->
      <view class="card">
        <text class="section-title">🎙️ 语音识别方式</text>
        <text class="desc">可自行选择识别方式。未配置任何接口时，默认使用浏览器原生识别（Web Speech API），开箱即用。</text>

        <view class="setting-item">
          <text class="setting-label">识别方式</text>
          <picker :range="asrOptions" :range-key="'name'" :value="asrIndex" @change="onAsrChange">
            <view class="picker-value">
              <text>{{ asrOptions[asrIndex].name }}</text>
              <text class="picker-arrow">▸</text>
            </view>
          </picker>
        </view>
        <text class="setting-hint">{{ asrOptions[asrIndex].desc }}</text>

        <!-- 自定义语音接口的配置项 -->
        <block v-if="asrEngine === 'api'">
          <view class="input-group">
            <text class="input-label">接口地址</text>
            <input
              v-model="asrUrl"
              class="input-field"
              type="text"
              placeholder="https://xxx/v1/audio/transcriptions"
            />
          </view>
          <view class="input-group">
            <text class="input-label">模型名称</text>
            <input
              v-model="asrModel"
              class="input-field"
              type="text"
              placeholder="如 whisper-1"
            />
          </view>
          <view class="input-group">
            <text class="input-label">API Key</text>
            <input
              v-model="asrKey"
              class="input-field"
              type="text"
              placeholder="语音接口的 API Key"
              :password="!showAsrKey"
            />
            <view class="input-actions">
              <view class="toggle-btn" @tap="showAsrKey = !showAsrKey">
                <text class="toggle-text">{{ showAsrKey ? '隐藏' : '显示' }}</text>
              </view>
            </view>
          </view>
          <text class="setting-hint">接口地址可只填根地址（如 https://api.openai.com 或 .../v1），保存时会自动补全。采用 OpenAI 音频转写兼容格式。</text>
          <view class="btn-row">
            <view class="btn-secondary" @tap="testAsr">
              <text>{{ asrTesting ? '测试中…' : '🧪 测试接口' }}</text>
            </view>
            <view class="btn-primary save-btn" @tap="saveAsr">保存</view>
          </view>
        </block>

        <!-- 浏览器原生识别：无需配置 -->
        <view v-else-if="asrEngine === 'webspeech'" class="asr-help">
          <text class="asr-help-text">
            {{ webSpeechSupported ? '当前浏览器支持原生识别，无需任何配置，点击麦克风即可说话。' : '当前浏览器不支持 Web Speech API，建议使用 Chrome / Edge / Safari，或改用自定义语音接口。' }}
          </text>
        </view>

        <!-- 讯飞 -->
        <block v-else>
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
        </block>
      </view>

      <!-- Status -->
      <view class="card" v-if="hasKey">
        <view class="status-row">
          <text class="status-dot active" />
          <text class="status-text">{{ currentProviderName }} 已配置（{{ currentModel || '未设置模型' }}），AI 分析可用</text>
        </view>
      </view>
      <view class="card" v-else>
        <view class="status-row">
          <text class="status-dot" />
          <text class="status-text">未配置 API Key，AI 分析不可用</text>
        </view>
      </view>

      <view class="card" v-if="activeEngineLabel && activeEngineLabel !== '无可用方式'">
        <view class="status-row">
          <text class="status-dot active" />
          <text class="status-text">语音识别：{{ activeEngineLabel }}（可用）</text>
        </view>
      </view>
      <view class="card" v-else>
        <view class="status-row">
          <text class="status-dot" />
          <text class="status-text">暂无可用语音识别方式，请选择浏览器原生识别或配置语音接口</text>
        </view>
      </view>
    </view>

    <VoiceCommander />
  </view>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue' // Vue 响应式与生命周期：ref/computed 响应式，onMounted 组件挂载后触发
import VoiceCommander from '../../components/VoiceCommander.vue' // 语音记账组件
import {
  AI_PROVIDERS,
  getAIConfig,
  setAIConfig,
  testAIConnection,
  normalizeUrl,
  hasApiKey as checkHasApiKey,
} from '../../utils/ai' // AI 服务商预设、配置读写、地址补全与连接测试
import {
  ASR_OPTIONS,
  getASRConfig,
  setASRConfig,
  normalizeASRUrl,
  testASRConnection,
  isWebSpeechSupported,
  getVoiceModeLabel,
  setXfyunConfig,
  hasXfyunConfig,
  getXfyunConfig,
} from '../../utils/voice' // 语音识别：引擎配置、接口连通测试、浏览器原生识别检测与讯飞凭证读写

// AI 服务配置
const providers = AI_PROVIDERS
const providerIndex = ref(0)
const baseUrl = ref('')
const model = ref('')
const apiKey = ref('')
const showKey = ref(false)
const hasKey = ref(false)
const testing = ref(false)

// 语音识别配置
const asrOptions = ASR_OPTIONS
const asrIndex = ref(0)
const asrEngine = computed(() => asrOptions[asrIndex.value].key)
const asrUrl = ref('')
const asrModel = ref('')
const asrKey = ref('')
const showAsrKey = ref(false)
const asrTesting = ref(false)
const webSpeechSupported = ref(false)
const activeEngineLabel = ref('')

// 讯飞语音配置
const xfAppId = ref('')
const xfApiKey = ref('')
const xfApiSecret = ref('')
const showXfKey = ref(false)
const showXfSecret = ref(false)
const hasXfyun = ref(false)

const currentProvider = computed(() => providers[providerIndex.value])
const currentProviderName = computed(() => currentProvider.value.name)
const currentDoc = computed(() => currentProvider.value.doc)
const currentModel = computed(() => model.value.trim())
const keyPlaceholder = computed(() => {
  const p = currentProvider.value
  return p.optionalKey ? '本地服务可留空' : `通常以 ${p.keyHint} 开头`
})
const modelPlaceholder = computed(() => currentProvider.value.model || '如 deepseek-chat')

onMounted(() => {
  const cfg = getAIConfig()
  const idx = providers.findIndex((p) => p.key === cfg.provider)
  providerIndex.value = idx >= 0 ? idx : 0
  baseUrl.value = cfg.baseUrl
  model.value = cfg.model
  hasKey.value = checkHasApiKey()
  hasXfyun.value = hasXfyunConfig()

  // 语音识别配置
  const asr = getASRConfig()
  const ai = asrOptions.findIndex((o) => o.key === asr.engine)
  asrIndex.value = ai >= 0 ? ai : 0
  asrUrl.value = asr.apiUrl
  asrModel.value = asr.model
  webSpeechSupported.value = isWebSpeechSupported()
  activeEngineLabel.value = getVoiceModeLabel()
})

function onAsrChange(e: any) {
  asrIndex.value = Number(e.detail.value)
  // 仅记录用户选择的引擎，具体凭证由下方表单保存
  if (asrEngine.value !== 'xfyun') {
    setASRConfig({ engine: asrEngine.value })
  }
  activeEngineLabel.value = getVoiceModeLabel()
}

/** 校验并收集自定义语音接口配置 */
function collectAsr(): { engine: 'api'; apiUrl: string; apiKey: string; model: string } | null {
  const url = asrUrl.value.trim()
  const key = asrKey.value.trim()
  const mdl = asrModel.value.trim()

  if (!url) {
    uni.showToast({ title: '请填写语音接口地址', icon: 'none' })
    return null
  }
  if (!mdl) {
    uni.showToast({ title: '请填写模型名称', icon: 'none' })
    return null
  }
  if (!key) {
    uni.showToast({ title: '请填写语音接口 API Key', icon: 'none' })
    return null
  }
  return { engine: 'api', apiUrl: normalizeASRUrl(url), apiKey: key, model: mdl }
}

function saveAsr() {
  const cfg = collectAsr()
  if (!cfg) return
  setASRConfig(cfg)
  asrUrl.value = cfg.apiUrl
  activeEngineLabel.value = getVoiceModeLabel()
  uni.showToast({ title: '保存成功', icon: 'success' })
}

async function testAsr() {
  const cfg = collectAsr()
  if (!cfg) return
  asrTesting.value = true
  try {
    const r = await testASRConnection(cfg)
    uni.showToast({
      title: r.msg.slice(0, 60),
      icon: r.ok ? 'success' : 'none',
      duration: 3000,
    })
  } finally {
    asrTesting.value = false
  }
}

function onProviderChange(e: any) {
  const idx = Number(e.detail.value)
  providerIndex.value = idx
  const p = providers[idx]
  baseUrl.value = p.baseUrl
  if (p.model) model.value = p.model
}

/** 收集并校验当前表单，返回归一化后的配置（校验失败返回 null） */
function collectConfig(): { provider: string; baseUrl: string; model: string; apiKey: string } | null {
  const url = baseUrl.value.trim()
  const key = apiKey.value.trim()
  const mdl = model.value.trim()

  if (!url) {
    uni.showToast({ title: '请填写接口地址', icon: 'none' })
    return null
  }
  if (!mdl) {
    uni.showToast({ title: '请填写模型名称', icon: 'none' })
    return null
  }
  // 本地服务（如 Ollama）允许无 Key，其余必须填写
  if (!key && !currentProvider.value.optionalKey) {
    uni.showToast({ title: '请填写 API Key', icon: 'none' })
    return null
  }

  return {
    provider: currentProvider.value.key,
    baseUrl: normalizeUrl(url),
    model: mdl,
    apiKey: key,
  }
}

function saveConfig() {
  const cfg = collectConfig()
  if (!cfg) return

  setAIConfig(cfg)
  baseUrl.value = cfg.baseUrl
  hasKey.value = checkHasApiKey()
  uni.showToast({ title: '保存成功', icon: 'success' })
}

async function testConnection() {
  const cfg = collectConfig()
  if (!cfg) return

  testing.value = true
  try {
    const r = await testAIConnection(cfg)
    uni.showToast({
      title: r.msg.slice(0, 60),
      icon: r.ok ? 'success' : 'none',
      duration: 3000,
    })
  } finally {
    testing.value = false
  }
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

.btn-row {
  display: flex;
  gap: 16rpx;
  margin-top: 8rpx;
}

.btn-row .save-btn {
  flex: 1;
}

.btn-secondary {
  flex: 1;
  height: 84rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 30rpx;
  border-radius: 16rpx;
  background: var(--primary-light);
  color: var(--primary);
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
