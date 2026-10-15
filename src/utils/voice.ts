/**
 * 跨平台语音识别工具（多引擎可切换）
 *
 * 支持三种识别引擎，用户在「我的 → AI 设置」自行选择：
 * 1. Web Speech API — 浏览器原生识别，免配置、免费，Chrome/Edge/Safari 可用（仅 H5）
 * 2. 自定义接口 — 录音后上传到任意语音转写接口（OpenAI /audio/transcriptions 兼容格式）
 * 3. 讯飞语音听写 — 流式 WebSocket，实时上屏（仅 H5）
 * 4. 微信同声传译插件 — 微信小程序端自动使用
 *
 * 未配置任何接口时默认使用 Web Speech API，保证开箱可用。
 *
 * 讯飞语音听写（流式版）WebSocket API:
 *   URL: wss://iat-api.xfyun.cn/v2/iat
 *   鉴权: HMAC-SHA256 签名 (apiKey + apiSecret)
 *   音频: PCM 16bit 16kHz mono, base64 编码, 每 40ms 发送 1280 字节
 *   结果: 实时流式返回识别文字（支持动态修正）
 */

export interface VoiceResult {
  text: string
  isFinal: boolean
}

export type VoiceCallback = (result: VoiceResult) => void
export type ErrorCallback = (error: string) => void

// ---------- 识别引擎配置 ----------

export type ASREngine = 'webspeech' | 'api' | 'xfyun'

export interface ASRConfig {
  engine: ASREngine // 用户选择的识别引擎
  apiUrl: string // 自定义语音转写接口地址
  apiKey: string // 自定义接口鉴权 Key
  model: string // 模型名，如 whisper-1
}

export const ASR_OPTIONS: { key: ASREngine; name: string; desc: string; hint: string }[] = [
  {
    key: 'webspeech',
    name: '浏览器原生识别（Web Speech API）',
    desc: '免配置、免费，识别在浏览器本地完成，需联网且仅 Chrome/Edge/Safari 支持',
    hint: '无需填写任何配置',
  },
  {
    key: 'api',
    name: '自定义语音接口',
    desc: '录音后上传到你配置的任意语音转写接口，支持 OpenAI 音频转写兼容格式',
    hint: '需填写接口地址、API Key 与模型名',
  },
  {
    key: 'xfyun',
    name: '讯飞语音听写',
    desc: '流式识别，实时上屏，国内速度快，需讯飞 AppID/APIKey/APISecret',
    hint: '需填写讯飞三项凭证',
  },
]

const ASR_CONFIG_KEY = 'beecount_asr_config'
const DEFAULT_ASR_URL = 'https://api.openai.com/v1/audio/transcriptions'

function defaultASRConfig(): ASRConfig {
  return { engine: 'webspeech', apiUrl: DEFAULT_ASR_URL, apiKey: '', model: 'whisper-1' }
}

/** 读取识别引擎配置 */
export function getASRConfig(): ASRConfig {
  const raw = uni.getStorageSync(ASR_CONFIG_KEY)
  if (raw) {
    try {
      const cfg = typeof raw === 'string' ? JSON.parse(raw) : raw
      if (cfg && typeof cfg === 'object') return { ...defaultASRConfig(), ...cfg }
    } catch (e) {
      // 存储损坏时回退默认
    }
  }
  // 向后兼容：旧版只配过讯飞，则视为讯飞引擎
  if (hasXfyunConfig()) return { ...defaultASRConfig(), engine: 'xfyun' }
  return defaultASRConfig()
}

/** 写入识别引擎配置（局部更新） */
export function setASRConfig(patch: Partial<ASRConfig>): ASRConfig {
  const next = { ...getASRConfig(), ...patch }
  uni.setStorageSync(ASR_CONFIG_KEY, JSON.stringify(next))
  return next
}

/** 补全转写接口地址：只填根地址或 /v1 时自动补齐 */
export function normalizeASRUrl(raw: string): string {
  let u = (raw || '').trim().replace(/\/+$/, '')
  if (!u) return ''
  if (/\/audio\/transcriptions$/i.test(u)) return u
  if (/\/v\d+$/i.test(u)) return `${u}/audio/transcriptions`
  return `${u}/v1/audio/transcriptions`
}

/** 测试自定义转写接口连通性（用一段静音音频探测，主要验证鉴权与地址） */
export async function testASRConnection(
  patch?: Partial<ASRConfig>
): Promise<{ ok: boolean; msg: string }> {
  const cfg = patch ? { ...getASRConfig(), ...patch } : getASRConfig()
  const url = normalizeASRUrl(cfg.apiUrl)
  if (!url) return { ok: false, msg: '请先填写语音接口地址' }
  if (!cfg.apiKey) return { ok: false, msg: '请先填写语音接口 API Key' }
  try {
    await transcribe(url, cfg.apiKey, cfg.model || 'whisper-1', buildSilenceWav())
    return { ok: true, msg: '接口连通，配置可用' }
  } catch (e: any) {
    const msg = e?.message || '连接失败'
    // 静音音频常被判为无内容，只要不是鉴权/地址类错误就视为连通
    if (/401|403|404|invalid api key|unauthor/i.test(msg)) return { ok: false, msg }
    if (/400|500|502|503/i.test(msg)) return { ok: true, msg: '接口可达（静音探测被拒属正常），配置可用' }
    return { ok: false, msg }
  }
}

// ---------- 讯飞 API 凭证管理 ----------

export interface XfyunConfig {
  appId: string
  apiKey: string
  apiSecret: string
}

export function getXfyunConfig(): XfyunConfig {
  return {
    appId: uni.getStorageSync('beecount_xfyun_appid') || '',
    apiKey: uni.getStorageSync('beecount_xfyun_apikey') || '',
    apiSecret: uni.getStorageSync('beecount_xfyun_secret') || '',
  }
}

export function setXfyunConfig(config: Partial<XfyunConfig>) {
  if (config.appId !== undefined) uni.setStorageSync('beecount_xfyun_appid', config.appId)
  if (config.apiKey !== undefined) uni.setStorageSync('beecount_xfyun_apikey', config.apiKey)
  if (config.apiSecret !== undefined) uni.setStorageSync('beecount_xfyun_secret', config.apiSecret)
}

export function hasXfyunConfig(): boolean {
  const c = getXfyunConfig()
  return !!(c.appId && c.apiKey && c.apiSecret)
}

// ---------- HMAC-SHA256 签名 (Web Crypto API) ----------

async function hmacSha256Base64(key: string, message: string): Promise<string> {
  const enc = new TextEncoder()
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    enc.encode(key),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  )
  const sig = await crypto.subtle.sign('HMAC', cryptoKey, enc.encode(message))
  return btoa(String.fromCharCode(...new Uint8Array(sig)))
}

// ---------- 生成讯飞 WebSocket 鉴权 URL ----------

async function buildXfyunWsUrl(config: XfyunConfig): Promise<string> {
  const host = 'iat-api.xfyun.cn'
  const path = '/v2/iat'
  const date = new Date().toUTCString()

  // 1. 签名原始串
  const signatureOrigin = `host: ${host}\ndate: ${date}\nGET ${path} HTTP/1.1`

  // 2. HMAC-SHA256 签名
  const signature = await hmacSha256Base64(config.apiSecret, signatureOrigin)

  // 3. 鉴权原始串
  const authorizationOrigin =
    `api_key="${config.apiKey}", algorithm="hmac-sha256", ` +
    `headers="host date request-line", signature="${signature}"`

  // 4. Base64 编码
  const authorization = btoa(authorizationOrigin)

  // 5. URL 拼接
  const params = new URLSearchParams({ authorization, date, host })
  return `wss://${host}${path}?${params.toString()}`
}

// ---------- 音频工具 ----------

function float32ToInt16(f32: Float32Array): Int16Array {
  const i16 = new Int16Array(f32.length)
  for (let i = 0; i < f32.length; i++) {
    const s = Math.max(-1, Math.min(1, f32[i]))
    i16[i] = s < 0 ? s * 0x8000 : s * 0x7FFF
  }
  return i16
}

function arrayBufferToBase64(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf)
  let bin = ''
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i])
  return btoa(bin)
}

// ---------- 讯飞语音听写核心 ----------

let isListening = false
let ws: WebSocket | null = null
let audioCtx: AudioContext | null = null
let micStream: MediaStream | null = null
let processor: ScriptProcessorNode | null = null
let pcmQueue: number[] = []
let sendTimer: ReturnType<typeof setInterval> | null = null

// 麦克风错误统一转为中文提示：getUserMedia 抛出的英文错误直接展示既看不懂又容易超出提示框
export function micErrorMessage(e: any): string {
  const name = String(e?.name || '')
  const msg = String(e?.message || '')
  if (name === 'NotFoundError' || name === 'DevicesNotFoundError' || /no device|not found/i.test(msg)) {
    return '未检测到麦克风设备，请检查设备连接后重试'
  }
  if (name === 'NotAllowedError' || name === 'SecurityError' || /permission|denied|拒绝/i.test(msg)) {
    return '麦克风权限被拒绝：请点击浏览器地址栏的锁形图标（或系统设置）允许使用麦克风，然后重试'
  }
  if (name === 'NotReadableError' || name === 'TrackStartError') {
    return '麦克风被其它程序占用，请关闭后重试'
  }
  return `无法访问麦克风：${msg || '未知错误'}`
}

async function startXfyun(onResult: VoiceCallback, onError: ErrorCallback): Promise<boolean> {
  const config = getXfyunConfig()
  if (!config.appId || !config.apiKey || !config.apiSecret) {
    onError('请先在 AI 设置中配置讯飞的 AppID、API Key、API Secret')
    return false
  }

  // 1. 获取麦克风
  try {
    micStream = await navigator.mediaDevices.getUserMedia({
      audio: { sampleRate: 16000, channelCount: 1, echoCancellation: true, noiseSuppression: true }
    })
  } catch (e: any) {
    onError(micErrorMessage(e))
    return false
  }

  // 2. WebSocket 连接
  let wsUrl: string
  try {
    wsUrl = await buildXfyunWsUrl(config)
  } catch (e: any) {
    onError(`鉴权失败: ${e.message}`)
    cleanup()
    return false
  }

  try {
    ws = new WebSocket(wsUrl)
  } catch (e: any) {
    onError(`WebSocket 连接失败: ${e.message}`)
    cleanup()
    return false
  }

  // 动态修正：按 sn 存储识别片段
  const parts = new Map<number, string>()

  ws.onopen = () => {
    console.log('[iFlytek] WebSocket connected')
    isListening = true

    // 3. 音频采集
    try {
      audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 })
    } catch {
      audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)()
    }

    const src = audioCtx!.createMediaStreamSource(micStream!)
    const srcRate = audioCtx!.sampleRate
    const needResample = srcRate !== 16000

    processor = audioCtx!.createScriptProcessor(4096, 1, 1)
    pcmQueue = []

    processor.onaudioprocess = (ev) => {
      if (!isListening) return
      const raw = ev.inputBuffer.getChannelData(0)
      let pcm: Int16Array
      if (needResample) {
        const ratio = srcRate / 16000
        const len = Math.round(raw.length / ratio)
        const resampled = new Float32Array(len)
        for (let i = 0; i < len; i++) {
          const idx = i * ratio
          const lo = Math.floor(idx)
          const hi = Math.min(lo + 1, raw.length - 1)
          resampled[i] = raw[lo] * (1 - (idx - lo)) + raw[hi] * (idx - lo)
        }
        pcm = float32ToInt16(resampled)
      } else {
        pcm = float32ToInt16(raw)
      }
      for (let i = 0; i < pcm.length; i++) pcmQueue.push(pcm[i])
    }

    src.connect(processor)
    processor.connect(audioCtx!.destination)

    // 4. 每 40ms 发一帧 (640 samples = 1280 bytes PCM16 at 16kHz)
    const FRAME = 640
    let frameIdx = 0

    sendTimer = setInterval(() => {
      if (!ws || ws.readyState !== WebSocket.OPEN) return

      const chunk = pcmQueue.splice(0, FRAME)
      if (chunk.length === 0 && frameIdx > 0) return
      const buf = new Int16Array(Math.max(chunk.length, FRAME))
      if (chunk.length > 0) buf.set(new Int16Array(chunk))
      const b64 = arrayBufferToBase64(buf.buffer)

      if (frameIdx === 0) {
        ws.send(JSON.stringify({
          common: { app_id: config.appId },
          business: { language: 'zh_cn', domain: 'iat', accent: 'mandarin', dwa: 'wpgs', ptt: 0 },
          data: { status: 0, format: 'audio/L16;rate=16000', encoding: 'raw', audio: b64 },
        }))
      } else {
        ws.send(JSON.stringify({
          data: { status: 1, format: 'audio/L16;rate=16000', encoding: 'raw', audio: b64 },
        }))
      }
      frameIdx++
    }, 40)
  }

  ws.onmessage = (ev) => {
    try {
      const resp = JSON.parse(ev.data)
      if (resp.code !== 0) {
        const codeMsgs: Record<number, string> = {
          10005: 'AppID 与 APIKey 不匹配',
          10006: '鉴权失败，请检查 APIKey/APISecret',
          10008: '接口无权限，请在讯飞控制台开通语音听写服务',
          10014: '接口流量不足',
          10407: '用户IP无权限',
        }
        onError(codeMsgs[resp.code] || `讯飞错误 ${resp.code}: ${resp.message || '未知'}`)
        cleanup()
        return
      }

      const sn = resp?.data?.result?.sn
      const pgs = resp?.data?.result?.pgs
      const rg = resp?.data?.result?.rg
      const status = resp?.data?.status

      // 提取当前帧文字
      let text = ''
      if (resp?.data?.result?.ws) {
        for (const w of resp.data.result.ws) {
          for (const cw of w.cw) text += cw.w
        }
      }

      // 动态修正
      if (pgs === 'apd') {
        parts.set(sn, text)
      } else if (pgs === 'rpl') {
        if (Array.isArray(rg) && rg.length === 2) {
          for (let i = rg[0]; i <= rg[1]; i++) parts.delete(i)
        }
        parts.set(sn, text)
      } else {
        parts.set(sn, text)
      }

      // 拼接完整文本
      const full = Array.from(parts.keys()).sort((a, b) => a - b).map(k => parts.get(k) || '').join('')

      if (status === 2) {
        onResult({ text: full, isFinal: true })
        cleanup()
      } else {
        onResult({ text: full, isFinal: false })
      }
    } catch (e) {
      console.error('[iFlytek] Parse error:', e)
    }
  }

  ws.onerror = () => {
    onError('WebSocket 连接错误，请检查网络或讯飞配置')
    cleanup()
  }

  ws.onclose = (ev) => {
    if (isListening && ev.code !== 1000) onError(`连接已断开 (${ev.code})`)
    isListening = false
  }

  return true
}

function cleanup() {
  if (sendTimer) { clearInterval(sendTimer); sendTimer = null }

  if (ws && ws.readyState === WebSocket.OPEN) {
    try {
      ws.send(JSON.stringify({
        data: { status: 2, format: 'audio/L16;rate=16000', encoding: 'raw', audio: '' },
      }))
    } catch { /* */ }
    setTimeout(() => { try { ws?.close() } catch { /* */ }; ws = null }, 1500)
  } else {
    ws = null
  }

  if (processor) { try { processor.disconnect() } catch { /* */ }; processor = null }
  if (audioCtx) { try { audioCtx.close() } catch { /* */ }; audioCtx = null }
  if (micStream) { micStream.getTracks().forEach(t => t.stop()); micStream = null }
  pcmQueue = []
}

function stopXfyun() {
  isListening = false
  cleanup()
}

// ---------- 微信小程序（微信同声传译插件） ----------

let wxPlugin: any = null

function initWxPlugin() {
  if (wxPlugin) return wxPlugin
  try {
    // @ts-ignore
    wxPlugin = (wx as any).requirePlugin('WechatSI') || null
  } catch { wxPlugin = null }
  return wxPlugin
}

function startWx(onResult: VoiceCallback, onError: ErrorCallback): boolean {
  const plugin = initWxPlugin()
  if (!plugin?.getRecordRecognitionManager) {
    onError('微信小程序需要配置"微信同声传译"插件')
    return false
  }
  const manager = plugin.getRecordRecognitionManager()
  manager.onRecognize = (res: any) => { onResult({ text: res.result, isFinal: false }) }
  manager.onStop = (res: any) => {
    if (res.result) onResult({ text: res.result, isFinal: true })
  }
  manager.onError = (res: any) => { onError(`语音错误: ${res.retcode || res.errMsg}`) }
  manager.start({ lang: 'zh_CN', duration: 30000 })
  isListening = true
  return true
}

function stopWx() {
  const plugin = initWxPlugin()
  if (plugin?.getRecordRecognitionManager) {
    try { plugin.getRecordRecognitionManager().stop() } catch { /* */ }
  }
  isListening = false
}

// ---------- Web Speech API（浏览器原生识别，免配置） ----------

interface SpeechRecognitionLike {
  lang: string
  continuous: boolean
  interimResults: boolean
  maxAlternatives: number
  start(): void
  stop(): void
  abort(): void
  onresult: ((ev: any) => void) | null
  onerror: ((ev: any) => void) | null
  onend: (() => void) | null
}

function getSpeechRecognitionCtor(): (new () => SpeechRecognitionLike) | null {
  // #ifdef H5
  if (typeof window === 'undefined') return null
  const w = window as any
  return w.SpeechRecognition || w.webkitSpeechRecognition || null
  // #endif
  // #ifndef H5
  return null
  // #endif
}

/** 当前环境是否支持浏览器原生语音识别 */
export function isWebSpeechSupported(): boolean {
  return !!getSpeechRecognitionCtor()
}

let recognition: SpeechRecognitionLike | null = null

function startWebSpeech(onResult: VoiceCallback, onError: ErrorCallback): boolean {
  const Ctor = getSpeechRecognitionCtor()
  if (!Ctor) {
    onError('当前浏览器不支持 Web Speech API，请改用自定义语音接口，或在 Chrome / Edge / Safari 中使用')
    return false
  }

  try {
    const rec = new Ctor()
    recognition = rec
    rec.lang = 'zh-CN'
    rec.continuous = true
    rec.interimResults = true
    rec.maxAlternatives = 1

    // 超时保护：原生识别依赖谷歌服务，连不上时会一直卡在"正在聆听"且不给任何回调
    const startTimer = setTimeout(() => {
      try { rec.stop() } catch (e) { /* 忽略未启动的异常 */ }
      onError('浏览器原生识别无响应：Chrome / Edge 需要连接谷歌语音服务，国内网络通常连不上。建议改用「自定义语音接口」（设置页可切换）。')
    }, 6000)

    rec.onresult = (ev: any) => {
      clearTimeout(startTimer)
      let interim = ''
      let finalText = ''
      for (let i = ev.resultIndex || 0; i < ev.results.length; i++) {
        const r = ev.results[i]
        const t = (r[0] && r[0].transcript) || ''
        if (r.isFinal) finalText += t
        else interim += t
      }
      if (finalText) onResult({ text: finalText, isFinal: true })
      else if (interim) onResult({ text: interim, isFinal: false })
    }

    rec.onerror = (ev: any) => {
      clearTimeout(startTimer)
      const key = String(ev?.error || '')
      if (key === 'aborted') return
      const msgs: Record<string, string> = {
        'not-allowed': '麦克风权限被拒绝：请点击浏览器地址栏的锁形图标（或系统设置）允许使用麦克风，然后重试',
        'service-not-allowed': '浏览器语音服务不可用（Chrome/Edge 的原生识别依赖谷歌服务，国内通常连不上），请改用自定义语音接口',
        'no-speech': '未检测到说话，请再试一次',
        network: '网络异常：Chrome/Edge 的浏览器原生识别要连接谷歌语音服务，国内网络基本连不上，建议改用自定义语音接口',
        'audio-capture': '未找到麦克风设备，请检查设备或浏览器权限设置',
      }
      onError(msgs[key] || `语音识别失败：${key || '未知错误'}`)
    }

    rec.onend = () => {
      clearTimeout(startTimer)
      isListening = false
    }

    rec.start()
    isListening = true
    return true
  } catch (e: any) {
    onError(`启动语音识别失败：${e?.message || '未知错误'}`)
    return false
  }
}

function stopWebSpeech() {
  isListening = false
  if (recognition) {
    try { recognition.stop() } catch (e) { /* 忽略未启动时的异常 */ }
    recognition = null
  }
}

// ---------- 自定义语音接口（录音后上传转写） ----------

let mediaRecorder: MediaRecorder | null = null
let recordedChunks: Blob[] = []
let apiMicStream: MediaStream | null = null

function pickMimeType(): string {
  const candidates = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg;codecs=opus']
  for (const t of candidates) {
    try {
      if (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(t)) return t
    } catch (e) { /* 继续尝试下一个候选 */ }
  }
  return ''
}

/** 生成一段极短静音 WAV，用于探测转写接口连通性 */
function buildSilenceWav(): Blob {
  const sampleRate = 8000
  const numSamples = Math.floor(sampleRate * 0.2)
  const buffer = new ArrayBuffer(44 + numSamples * 2)
  const view = new DataView(buffer)
  const writeStr = (offset: number, s: string) => {
    for (let i = 0; i < s.length; i++) view.setUint8(offset + i, s.charCodeAt(i))
  }
  writeStr(0, 'RIFF')
  view.setUint32(4, 36 + numSamples * 2, true)
  writeStr(8, 'WAVE')
  writeStr(12, 'fmt ')
  view.setUint32(16, 16, true)
  view.setUint16(20, 1, true) // PCM
  view.setUint16(22, 1, true) // 单声道
  view.setUint32(24, sampleRate, true)
  view.setUint32(28, sampleRate * 2, true)
  view.setUint16(32, 2, true)
  view.setUint16(34, 16, true)
  writeStr(36, 'data')
  view.setUint32(40, numSamples * 2, true)
  return new Blob([buffer], { type: 'audio/wav' })
}

/** 调用语音转写接口，兼容 {text} / {data.text} / {result} 等多种返回格式 */
async function transcribe(url: string, apiKey: string, model: string, audio: Blob): Promise<string> {
  const form = new FormData()
  const mt = (audio.type || '').toLowerCase()
  const ext = mt.includes('webm') ? 'webm' : mt.includes('mp4') ? 'm4a' : mt.includes('ogg') ? 'ogg' : 'wav'
  form.append('file', audio, `voice.${ext}`)
  if (model) form.append('model', model)
  form.append('language', 'zh')

  const res = await fetch(url, {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}` },
    body: form,
  })

  if (!res.ok) {
    let detail = ''
    try { detail = (await res.text()).slice(0, 150) } catch (e) { /* 忽略读取失败 */ }
    throw new Error(`接口返回 ${res.status}：${detail || res.statusText}`)
  }

  const data: any = await res.json().catch(() => null)
  const text = data?.text ?? data?.data?.text ?? data?.result ?? data?.transcription ?? ''
  return String(text || '').trim()
}

function cleanupApiStream() {
  if (apiMicStream) {
    try { apiMicStream.getTracks().forEach((t) => t.stop()) } catch (e) { /* 忽略 */ }
    apiMicStream = null
  }
}

async function startApiASR(onResult: VoiceCallback, onError: ErrorCallback): Promise<boolean> {
  const cfg = getASRConfig()
  const url = normalizeASRUrl(cfg.apiUrl)
  if (!url) { onError('请先在设置中配置语音识别接口地址'); return false }
  if (!cfg.apiKey) { onError('请先在设置中配置语音识别接口的 API Key'); return false }

  if (typeof MediaRecorder === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
    onError('当前环境不支持录音，请改用浏览器原生识别（Web Speech API）')
    return false
  }

  try {
    apiMicStream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: true, noiseSuppression: true },
    })
  } catch (e: any) {
    onError(micErrorMessage(e))
    return false
  }

  try {
    const mimeType = pickMimeType()
    mediaRecorder = new MediaRecorder(apiMicStream, mimeType ? { mimeType } : undefined)
    recordedChunks = []

    mediaRecorder.ondataavailable = (ev: any) => {
      if (ev.data && ev.data.size > 0) recordedChunks.push(ev.data)
    }

    mediaRecorder.onstop = async () => {
      const type = mediaRecorder?.mimeType || mimeType || 'audio/webm'
      const blob = new Blob(recordedChunks, { type })
      recordedChunks = []
      cleanupApiStream()

      if (blob.size === 0) { onError('未采集到音频，请重试'); return }
      onResult({ text: '识别中…', isFinal: false })
      try {
        const text = await transcribe(url, cfg.apiKey, cfg.model || 'whisper-1', blob)
        if (!text) onError('识别结果为空，请再说一次')
        else onResult({ text, isFinal: true })
      } catch (e: any) {
        onError(e?.message || '识别失败')
      }
    }

    mediaRecorder.start()
    isListening = true
    return true
  } catch (e: any) {
    onError(`录音启动失败：${e?.message || '未知错误'}`)
    cleanupApiStream()
    return false
  }
}

function stopApiASR() {
  isListening = false
  if (mediaRecorder && mediaRecorder.state !== 'inactive') {
    try { mediaRecorder.stop() } catch (e) { /* 忽略 */ }
  } else {
    cleanupApiStream()
  }
}

// ---------- 统一 API ----------

export type VoiceMode = 'xfyun' | 'wechat' | 'webspeech' | 'api' | 'none'

/** 当前实际会使用的识别引擎：优先用户所选，所选不可用时自动回退 */
export function getVoiceMode(): VoiceMode {
  // #ifdef MP-WEIXIN
  // 小程序端不使用 Web Speech API，统一走微信同声传译插件
  return initWxPlugin()?.getRecordRecognitionManager ? 'wechat' : 'none'
  // #endif

  // #ifdef H5
  const cfg = getASRConfig()
  const canWebSpeech = isWebSpeechSupported()
  const canApi = !!(normalizeASRUrl(cfg.apiUrl) && cfg.apiKey)
  const canXfyun =
    hasXfyunConfig() && typeof WebSocket !== 'undefined' && !!navigator.mediaDevices?.getUserMedia

  // 用户显式选择的引擎优先
  if (cfg.engine === 'webspeech' && canWebSpeech) return 'webspeech'
  if (cfg.engine === 'api' && canApi) return 'api'
  if (cfg.engine === 'xfyun' && canXfyun) return 'xfyun'

  // 所选引擎不可用时回退：优先免配置的浏览器原生识别
  if (canWebSpeech) return 'webspeech'
  if (canApi) return 'api'
  if (canXfyun) return 'xfyun'
  return 'none'
  // #endif

  // 其他平台
  const c = getASRConfig()
  if (c.engine === 'api' && normalizeASRUrl(c.apiUrl) && c.apiKey) return 'api'
  if (hasXfyunConfig() && typeof WebSocket !== 'undefined') return 'xfyun'
  return 'none'
}

/** 当前引擎是否需要用户配置（用于 UI 提示） */
export function getVoiceModeLabel(): string {
  const m = getVoiceMode()
  const map: Record<string, string> = {
    webspeech: '浏览器原生识别',
    api: '自定义语音接口',
    xfyun: '讯飞语音听写',
    wechat: '微信同声传译',
    none: '无可用方式',
  }
  return map[m] || m
}

export function isSupported(): boolean {
  return getVoiceMode() !== 'none'
}

// 记录本次实际启动的引擎，避免停止时因配置变化而误停
let activeEngine: VoiceMode = 'none'

export function startVoice(onResult: VoiceCallback, onError: ErrorCallback): boolean {
  const mode = getVoiceMode()
  activeEngine = mode

  if (mode === 'webspeech') return startWebSpeech(onResult, onError)
  if (mode === 'wechat') return startWx(onResult, onError)
  if (mode === 'xfyun') {
    startXfyun(onResult, onError)
    return true
  }
  if (mode === 'api') {
    startApiASR(onResult, onError)
    return true
  }

  onError(
    '当前没有可用的语音识别方式。可在设置中选择「浏览器原生识别」，或配置语音接口 / 讯飞凭证'
  )
  return false
}

export function stopVoice() {
  if (activeEngine === 'webspeech') stopWebSpeech()
  else if (activeEngine === 'api') stopApiASR()
  else if (activeEngine === 'xfyun') stopXfyun()
  else if (activeEngine === 'wechat') stopWx()
  else {
    // 兼容未记录引擎的情况，按当前配置停止
    const mode = getVoiceMode()
    if (mode === 'xfyun') stopXfyun()
    else if (mode === 'wechat') stopWx()
    else if (mode === 'webspeech') stopWebSpeech()
    else if (mode === 'api') stopApiASR()
  }
  activeEngine = 'none'
  isListening = false
}

export function isVoiceListening(): boolean {
  return isListening
}
