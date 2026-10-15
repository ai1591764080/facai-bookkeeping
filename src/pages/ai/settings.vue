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

        <!-- 浏览器原生识别：无需配置，但需要麦克风权限 + 能访问谷歌语音服务 -->
        <view v-else-if="asrEngine === 'webspeech'" class="asr-help">
          <text class="asr-help-text">
            {{ webSpeechSupported ? '当前浏览器支持原生识别，无需填写配置。' : '当前浏览器不支持 Web Speech API，建议使用 Chrome / Edge / Safari，或改用自定义语音接口。' }}
          </text>

          <!-- 麦克风权限状态 -->
          <view class="perm-row">
            <text class="perm-label">麦克风权限</text>
            <text class="perm-state" :class="micPermission">{{ micPermissionText }}</text>
          </view>
          <view v-if="!secureContext" class="warn-box">
            <text class="warn-text">
              ⚠️ 当前不是安全环境（用局域网 IP 的 http 访问）。浏览器只在 https 或 localhost 下提供麦克风，请用 http://localhost:5173 打开，或改用自定义语音接口。
            </text>
          </view>

          <view class="btn-row">
            <view class="btn-secondary" @tap="checkMic">
              <text>{{ micChecking ? '检测中…' : '🎤 检测麦克风' }}</text>
            </view>
          </view>
          <text v-if="micCheckMsg" class="asr-help-text">{{ micCheckMsg }}</text>

          <!-- 授权步骤 -->
          <view class="guide-box">
            <text class="guide-title">怎么给麦克风权限（Chrome / Edge）</text>
            <text class="guide-step">1. 点击浏览器地址栏最左侧的 🔒 锁形图标</text>
            <text class="guide-step">2. 找到「麦克风」，改为「允许」</text>
            <text class="guide-step">3. 回到本页面，刷新后重新点击麦克风按钮</text>
            <text class="guide-step">若之前点过「拒绝」：地址栏锁图标 → 网站设置 → 麦克风 → 允许；或在 chrome://settings/content/microphone 中把本站从「已阻止」里移除。</text>
            <text class="guide-step">系统层面：Windows 设置 → 隐私 → 麦克风 → 允许桌面应用访问麦克风。</text>
          </view>

          <view class="warn-box">
            <text class="warn-text">
              ⚠️ Chrome / Edge 的「浏览器原生识别」实际要把录音上传到谷歌语音服务，国内网络大多连不上，表现为点了麦克风一直转圈或提示网络异常。这种情况请改用「自定义语音接口」（填任意 OpenAI 兼容的音频转写地址即可）。
            </text>
          </view>
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

      <!-- 配置备份：把设置项与账目数据分开备份 -->
      <view class="card">
        <text class="section-title">⚙️ 配置备份</text>
        <text class="desc">导出全部设置：AI 服务、语音引擎与密钥、讯飞凭证、OCR、主题与货币等偏好。换设备或重装后一次导入即可恢复，不用再一项项重填。</text>
        <view class="btn-row">
          <view class="btn-secondary" @tap="exportConfigFile">
            <text>📤 导出配置</text>
          </view>
          <view class="btn-primary" @tap="importConfigFile">
            <text>📥 导入配置（文件）</text>
          </view>
        </view>
        <view class="btn-row">
          <view class="btn-secondary" @tap="importFromClipboard()">
            <text>📋 从剪贴板导入</text>
          </view>
        </view>
        <text class="setting-hint">进入本页会自动检查剪贴板，若里面是配置文件会直接提示导入；也可在页面上按 Ctrl/⌘+V 粘贴配置文本。导出后会顺带复制到剪贴板，方便粘到另一台设备。</text>
        <text class="setting-hint">⚠️ 配置文件里包含 API Key 明文，请妥善保管、不要发给他人。账目数据请在「我的 → 导出」单独备份。</text>
      </view>
    </view>

    <DraggableDock />
  </view>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount } from 'vue' // Vue 响应式与生命周期：ref/computed 响应式，onMounted 挂载后触发，onBeforeUnmount 卸载前清理
import DraggableDock from '../../components/DraggableDock.vue' // 可拖拽、贴边折叠的工具条（添加/AI/语音），与各页面入口保持一致
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
  micErrorMessage,
} from '../../utils/voice' // 语音识别：引擎配置、接口连通测试、浏览器原生识别检测、麦克风错误提示与讯飞凭证读写
import {
  collectConfigFile,
  configFileName,
  validateConfigFile,
  applyConfigFile,
  configSummary,
  readClipboardText,
  writeClipboardText,
  textFingerprint,
} from '../../utils/configBackup' // 配置备份：收集/校验/写入全部设置项、剪贴板读写
import { saveTextFile, pickTextFile } from '../../utils/backup' // 跨平台文件存取：H5 下载与选文件、小程序转发/读取
import type { ConfigFile } from '../../utils/configBackup' // 配置文件类型

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

// 麦克风权限与环境检测
const micPermission = ref<'unknown' | 'granted' | 'denied' | 'prompt'>('unknown')
const secureContext = ref(true)
const micChecking = ref(false)
const micCheckMsg = ref('')
const micPermissionText = computed(() => {
  if (micPermission.value === 'granted') return '✅ 已允许'
  if (micPermission.value === 'denied') return '❌ 被拒绝'
  if (micPermission.value === 'prompt') return '⚠️ 尚未授权'
  return '❓ 未知'
})

// 讯飞语音配置
const xfAppId = ref('')
const xfApiKey = ref('')
const xfApiSecret = ref('')
const showXfKey = ref(false)
const showXfSecret = ref(false)
const hasXfyun = ref(false)

/** 进入页面后自动检查剪贴板的延时器，离开页面时清理 */
let clipTimer: ReturnType<typeof setTimeout> | null = null

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

  // 回填已保存的讯飞凭证，方便核对是否已配置
  const xf = getXfyunConfig()
  xfAppId.value = xf.appId
  xfApiKey.value = xf.apiKey
  xfApiSecret.value = xf.apiSecret

  // 语音识别配置
  const asr = getASRConfig()
  const ai = asrOptions.findIndex((o) => o.key === asr.engine)
  asrIndex.value = ai >= 0 ? ai : 0
  asrUrl.value = asr.apiUrl
  asrModel.value = asr.model
  webSpeechSupported.value = isWebSpeechSupported()
  activeEngineLabel.value = getVoiceModeLabel()

  // #ifdef H5
  // 非 https / 非 localhost 时浏览器不提供麦克风（局域网 IP 访问必然失败），先提示出来
  secureContext.value = typeof window !== 'undefined' ? !!window.isSecureContext : true
  detectMicPermission()
  // 粘贴配置文本：在页面上按 Ctrl/⌘+V 也能触发导入（剪贴板读取被浏览器拒绝时仍可用）
  document.addEventListener('paste', onPaste)
  // #endif

  // 进入页面后自动检查剪贴板，里面是配置文件就直接提示导入；延时是为了等页面拿到焦点
  clipTimer = setTimeout(() => importFromClipboard(undefined, true), 1500)
})

onBeforeUnmount(() => {
  if (clipTimer) clearTimeout(clipTimer)
  // #ifdef H5
  document.removeEventListener('paste', onPaste)
  // #endif
})

/** 读取麦克风权限状态（浏览器支持 permissions API 时可用） */
async function detectMicPermission() {
  try {
    const perms: any = (navigator as any).permissions
    if (perms && typeof perms.query === 'function') {
      const st = await perms.query({ name: 'microphone' })
      micPermission.value = (st.state as any) || 'unknown'
      return
    }
  } catch (e) { /* 浏览器不支持则保持未知 */ }
  micPermission.value = 'unknown'
}

/** 实际申请一次麦克风，用户点了允许就说明可用 */
async function checkMic() {
  if (micChecking.value) return
  micChecking.value = true
  micCheckMsg.value = ''
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
    stream.getTracks().forEach((t) => t.stop())
    micPermission.value = 'granted'
    micCheckMsg.value = '✅ 麦克风可用。注意：这只是麦克风权限，Chrome/Edge 的原生识别还需要能连上谷歌语音服务，若点击后一直无反应请改用自定义语音接口。'
  } catch (e: any) {
    micPermission.value = 'denied'
    micCheckMsg.value = '❌ ' + micErrorMessage(e)
  } finally {
    micChecking.value = false
  }
}

function onAsrChange(e: any) {
  asrIndex.value = Number(e.detail.value)
  // 选择讯飞时：凭证已经配好就立刻生效，没配好则等保存凭证时再切换
  if (asrEngine.value === 'xfyun') {
    if (hasXfyunConfig()) setASRConfig({ engine: 'xfyun' })
  } else {
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
  // 只存凭证不会切换引擎：必须同时把当前识别引擎改为讯飞，否则仍会走原来的引擎
  setASRConfig({ engine: 'xfyun' })
  hasXfyun.value = true
  activeEngineLabel.value = getVoiceModeLabel()
  // 保留已保存的凭证在输入框里，方便核对（此前会被清空，看起来像没保存）
  xfAppId.value = appId
  xfApiKey.value = key
  xfApiSecret.value = secret
  uni.showToast({ title: '已保存并切换到讯飞语音听写', icon: 'success' })
}

// ---------- 配置备份与恢复 ----------

/** 已处理过的剪贴板内容指纹，避免同一段配置反复弹窗 */
const HANDLED_CLIP_KEY = 'beecount_cfg_clip_handled'

/** 刷新页面：主题、货币等存在内存 store 里的配置需要刷新才生效 */
function reloadApp() {
  // #ifdef H5
  window.location.reload()
  // #endif
  // #ifndef H5
  uni.reLaunch({ url: '/pages/index/index' })
  // #endif
}

/** 解析配置文本，不是合法配置文件则返回 null */
function parseConfigText(text: string): ConfigFile | null {
  let raw: unknown
  try {
    raw = JSON.parse(text)
  } catch (e) {
    return null
  }
  const v = validateConfigFile(raw)
  return v.ok ? v.file : null
}

/** 确认后写入配置，并询问是否刷新 */
function confirmAndApply(file: ConfigFile, extraInfo = '') {
  const items = configSummary(file)
  uni.showModal({
    title: '导入配置',
    content: `将导入 ${items.length} 项配置${extraInfo}并覆盖当前同名设置，是否继续？`,
    success: (res) => {
      if (!res.confirm) return
      const n = applyConfigFile(file)
      uni.showModal({
        title: '导入完成',
        content: `已写入 ${n} 项配置。主题、货币、每月起始日等项需要刷新页面后生效，是否立即刷新？`,
        success: (r) => {
          if (!r.confirm) return
          reloadApp()
        },
      })
    },
  })
}

/** 导出全部配置到 JSON 文件，并顺带复制到剪贴板 */
async function exportConfigFile() {
  const file = collectConfigFile()
  const count = Object.keys(file.config).length
  if (count === 0) {
    uni.showToast({ title: '当前还没有任何配置可导出', icon: 'none' })
    return
  }
  const text = JSON.stringify(file, null, 2)
  let copied = false
  try {
    await saveTextFile(text, configFileName())
    copied = await writeClipboardText(text)
  } catch (e: any) {
    uni.showToast({ title: e?.message || '导出失败', icon: 'none' })
    return
  }
  // 自己导出的内容不再触发自动导入提示
  uni.setStorageSync(HANDLED_CLIP_KEY, textFingerprint(text))
  uni.showToast({
    title: copied ? `已导出 ${count} 项配置，并已复制到剪贴板` : `已导出 ${count} 项配置`,
    icon: 'success',
  })
}

/** 选择配置文件并写入本地 */
async function importConfigFile() {
  let text = ''
  try {
    text = await pickTextFile()
  } catch (e: any) {
    uni.showToast({ title: e?.message || '未选择文件', icon: 'none' })
    return
  }
  const file = parseConfigText(text)
  if (!file) {
    uni.showToast({ title: '文件不是有效的配置文件', icon: 'none' })
    return
  }
  confirmAndApply(file)
}

/**
 * 从剪贴板导入配置
 * @param preset 已有文本时直接传入（如粘贴事件），否则主动读取剪贴板
 * @param auto 是否为进入页面时的自动检测：读不到内容或不合法时静默跳过，且同一段内容只提示一次
 */
async function importFromClipboard(preset?: string, auto = false) {
  const text = (preset !== undefined ? preset : await readClipboardText()).trim()
  if (!text) {
    if (!auto) uni.showToast({ title: '剪贴板为空，请先复制配置内容', icon: 'none' })
    return
  }

  const file = parseConfigText(text)
  if (!file) {
    if (!auto) uni.showToast({ title: '剪贴板内容不是有效的配置文件', icon: 'none' })
    return
  }

  const fp = textFingerprint(text)
  if (auto && fp === uni.getStorageSync(HANDLED_CLIP_KEY)) return // 这段内容已经提示过，不再打扰

  const when = file.exportedAt ? file.exportedAt.slice(0, 10) : ''
  uni.showModal({
    title: auto ? '检测到配置' : '导入配置',
    content: `剪贴板中有 ${configSummary(file).length} 项配置${when ? `（导出于 ${when}）` : ''}，是否导入并覆盖当前同名设置？`,
    success: (res) => {
      uni.setStorageSync(HANDLED_CLIP_KEY, fp)
      if (!res.confirm) return
      const n = applyConfigFile(file)
      uni.showModal({
        title: '导入完成',
        content: `已写入 ${n} 项配置。主题、货币、每月起始日等项需要刷新页面后生效，是否立即刷新？`,
        success: (r) => {
          if (!r.confirm) return
          reloadApp()
        },
      })
    },
  })
}

/** 页面内粘贴：内容恰好是配置文件时就走导入流程 */
function onPaste(e: any) {
  const text = e?.clipboardData?.getData?.('text') || ''
  if (!text) return
  if (!parseConfigText(text)) return // 普通文本粘贴不打断用户
  if (e.preventDefault) e.preventDefault()
  importFromClipboard(text)
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

/* 麦克风权限状态与指引 */
.perm-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 16rpx;
  padding: 16rpx 20rpx;
  background: var(--bg-secondary, #f7f8fa);
  border-radius: 12rpx;
}
.perm-label { font-size: 26rpx; color: var(--text-secondary); }
.perm-state { font-size: 26rpx; font-weight: 600; }
.perm-state.granted { color: #16a34a; }
.perm-state.denied { color: #dc2626; }
.perm-state.prompt { color: #f59e0b; }
.perm-state.unknown { color: var(--text-tertiary); }

.warn-box {
  margin-top: 16rpx;
  padding: 18rpx 20rpx;
  background: #fffbeb;
  border: 2rpx solid #fde68a;
  border-radius: 12rpx;
}
.warn-text { font-size: 24rpx; color: #92400e; line-height: 1.6; }

.guide-box {
  margin-top: 20rpx;
  padding: 20rpx;
  background: var(--bg-secondary, #f7f8fa);
  border-radius: 12rpx;
}
.guide-title { font-size: 26rpx; font-weight: 600; color: var(--text-primary); }
.guide-step { display: block; margin-top: 10rpx; font-size: 24rpx; color: var(--text-secondary); line-height: 1.6; }

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
