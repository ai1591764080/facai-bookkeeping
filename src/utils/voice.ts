/**
 * 跨平台语音识别工具（讯飞语音听写方案）
 *
 * 策略：
 * - H5 浏览器: 讯飞语音听写 WebSocket 流式 API（实时返回、国内可用）
 * - 微信小程序: 微信同声传译插件
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
    onError(`无法访问麦克风: ${e.message || '权限被拒绝'}`)
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

// ---------- 统一 API ----------

export type VoiceMode = 'xfyun' | 'wechat' | 'none'

export function getVoiceMode(): VoiceMode {
  // #ifdef MP-WEIXIN
  return initWxPlugin()?.getRecordRecognitionManager ? 'wechat' : 'none'
  // #endif

  // #ifdef H5
  if (hasXfyunConfig() && typeof WebSocket !== 'undefined' && navigator.mediaDevices?.getUserMedia) {
    return 'xfyun'
  }
  return 'none'
  // #endif

  // fallback
  if (hasXfyunConfig() && typeof WebSocket !== 'undefined') return 'xfyun'
  return 'none'
}

export function isSupported(): boolean {
  return getVoiceMode() !== 'none'
}

export function startVoice(onResult: VoiceCallback, onError: ErrorCallback): boolean {
  const mode = getVoiceMode()

  if (mode === 'xfyun') {
    startXfyun(onResult, onError)
    return true
  }
  if (mode === 'wechat') return startWx(onResult, onError)

  onError('请先在 AI 设置中配置讯飞语音识别的 AppID、API Key、API Secret')
  return false
}

export function stopVoice() {
  const mode = getVoiceMode()
  if (mode === 'xfyun') stopXfyun()
  else if (mode === 'wechat') stopWx()
  isListening = false
}

export function isVoiceListening(): boolean {
  return isListening
}
