// 飞桨 AI Studio OCR 识别模块
// 基于 PaddleOCR-VL 在线 API：识别票据 / 小票 / 账单截图中的文字
// 官方调用方式：提交识别任务(job) -> 轮询任务状态 -> 获取 jsonl 结果(markdown 文本)
import { hasApiKey as hasDeepSeekKey } from './ai'

// ---------- 配置 ----------
const TOKEN_KEY = 'beecount_ocr_token'
const URL_KEY = 'beecount_ocr_url'

// 默认飞桨 AI Studio access token（用户提供）
export const DEFAULT_OCR_TOKEN = '2383f3f0c9defccfed785a884b93b04057db92b7'

// 飞桨 PaddleOCR 官方任务 API 地址（固定，无需修改）
export const DEFAULT_OCR_URL = 'https://paddleocr.aistudio-app.com/api/v2/ocr/jobs'

// OCR 模型
const OCR_MODEL = 'PaddleOCR-VL-1.6'

// 轮询间隔（毫秒）
const POLL_INTERVAL = 2000
// 最大轮询次数（约 5 分钟）
const MAX_POLL = 150

export function getOcrToken(): string {
  return uni.getStorageSync(TOKEN_KEY) || DEFAULT_OCR_TOKEN
}

export function setOcrToken(token: string) {
  uni.setStorageSync(TOKEN_KEY, token)
}

export function getOcrUrl(): string {
  return uni.getStorageSync(URL_KEY) || DEFAULT_OCR_URL
}

export function setOcrUrl(url: string) {
  uni.setStorageSync(URL_KEY, url)
}

export function hasOcrConfig(): boolean {
  return !!getOcrToken()
}

// ---------- 通用请求封装（兼容 H5 / 小程序） ----------
function request<T>(options: {
  url: string
  method: 'GET' | 'POST'
  header?: Record<string, string>
  data?: any
}): Promise<T> {
  return new Promise((resolve, reject) => {
    uni.request({
      url: options.url,
      method: options.method,
      header: options.header,
      data: options.data,
      timeout: 60000,
      success: (r) => {
        if (r.statusCode >= 200 && r.statusCode < 300) resolve(r.data as T)
        else reject(new Error(`HTTP ${r.statusCode}: ${JSON.stringify(r.data)}`))
      },
      fail: (e) => reject(new Error(`网络错误: ${e.errMsg}`)),
    })
  })
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

// ---------- 图片读取为 base64 ----------
export function readFileAsBase64(filePath: string): Promise<string> {
  return new Promise((resolve, reject) => {
    uni.getFileSystemManager().readFile({
      filePath,
      encoding: 'base64',
      success: (res) => resolve(String(res.data)),
      fail: (err) => reject(new Error(`读取图片失败: ${err.errMsg}`)),
    })
  })
}

// ---------- 任务提交 ----------
interface JobResponse {
  data?: { jobId?: string }
}

interface JobResultResponse {
  data?: {
    state?: 'pending' | 'running' | 'done' | 'failed'
    errorMsg?: string
    extractProgress?: {
      totalPages?: number
      extractedPages?: number
      startTime?: string
      endTime?: string
    }
    resultUrl?: { jsonUrl?: string }
  }
}

async function submitJob(imageBase64: string): Promise<string> {
  const token = getOcrToken()
  const url = getOcrUrl()
  if (!token) throw new Error('未配置飞桨 AI Studio 访问令牌')

  const headers = {
    Authorization: `bearer ${token}`,
  }

  const optionalPayload = {
    useDocOrientationClassify: false,
    useDocUnwarping: false,
    useChartRecognition: false,
  }

  // 本地文件模式：base64 -> Blob -> FormData
  // #ifdef H5
  const binary = atob(imageBase64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  const blob = new Blob([bytes], { type: 'image/jpeg' })
  const formData = new FormData()
  formData.append('file', blob, 'receipt.jpg')
  formData.append('model', OCR_MODEL)
  formData.append('optionalPayload', JSON.stringify(optionalPayload))

  const jobId = await request<JobResponse>({
    url,
    method: 'POST',
    header: headers,
    data: formData,
  }).then((r) => r?.data?.jobId)
  // #endif

  // #ifndef H5
  // 非 H5 端：小程序无 FormData 便捷上传，走 JSON + 可访问的文件 URL
  // 注意：AI Studio 本地文件模式依赖真实文件上传，小程序端若失败需改用支持的上传方式
  const jobIdNonH5 = await request<JobResponse>({
    url,
    method: 'POST',
    header: { ...headers, 'Content-Type': 'application/json' },
    data: {
      model: OCR_MODEL,
      optionalPayload: JSON.stringify(optionalPayload),
      fileUrl: `data:image/jpeg;base64,${imageBase64}`,
    },
  }).then((r) => r?.data?.jobId)
  // #endif

  // #ifdef H5
  if (!jobId) throw new Error('OCR 任务提交失败：未返回 jobId')
  return jobId
  // #endif

  // #ifndef H5
  if (!jobIdNonH5) throw new Error('OCR 任务提交失败：未返回 jobId')
  return jobIdNonH5 as string
  // #endif
}

async function pollJob(token: string, jobId: string): Promise<string> {
  const url = getOcrUrl()
  let pollCount = 0
  while (pollCount < MAX_POLL) {
    await sleep(POLL_INTERVAL)
    pollCount++

    const res = await request<JobResultResponse>({
      url: `${url}/${jobId}`,
      method: 'GET',
      header: { Authorization: `bearer ${token}` },
    })

    const state = res?.data?.state
    if (state === 'done') {
      const jsonUrl = res?.data?.resultUrl?.jsonUrl
      if (!jsonUrl) throw new Error('OCR 任务完成但未返回结果地址')
      return await fetchResult(jsonUrl)
    } else if (state === 'failed') {
      throw new Error(`OCR 识别失败: ${res?.data?.errorMsg || '未知错误'}`)
    }
    // pending / running 继续轮询
  }
  throw new Error('OCR 识别超时，请稍后重试')
}

// ---------- 获取结果（jsonl）并提取 markdown 文本 ----------
interface JsonlItem {
  result?: {
    layoutParsingResults?: {
      markdown?: { text?: string }
    }[]
  }
}

async function fetchResult(jsonUrl: string): Promise<string> {
  const text = await request<string>({ url: jsonUrl, method: 'GET' })
  const lines = String(text)
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length > 0)

  const parts: string[] = []
  for (const line of lines) {
    try {
      const item = JSON.parse(line) as JsonlItem
      const results = item.result?.layoutParsingResults || []
      for (const res of results) {
        const md = res.markdown?.text?.trim()
        if (md) parts.push(md)
      }
    } catch {
      // 跳过无法解析的行
    }
  }

  const content = parts.join('\n').trim()
  if (!content) throw new Error('未识别到任何文字，请更换更清晰的图片')
  return content
}

/**
 * 识别图片文字
 * @param imageBase64 图片 base64（不含 data: 前缀）
 * @returns 识别出的文字（markdown 文本）
 */
export async function recognizeImage(imageBase64: string): Promise<string> {
  const token = getOcrToken()
  if (!token) throw new Error('未配置飞桨 AI Studio 访问令牌')

  const jobId = await submitJob(imageBase64)
  return await pollJob(token, jobId)
}

// ---------- 页面提示 ----------
export function ocrReadyHint(): string {
  if (!hasDeepSeekKey()) {
    return '扫描识别前请先在「我的 → AI 设置」配置 DeepSeek API Key，用于智能归档整理。'
  }
  return ''
}
