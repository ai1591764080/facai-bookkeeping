import { defineStore } from 'pinia' // Pinia：defineStore 定义响应式状态仓库
import { ref } from 'vue' // Vue 响应式：ref 声明响应式数据

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

export const useAiStore = defineStore('ai', () => {
  const chatHistory = ref<ChatMessage[]>([])
  const isLoading = ref(false)
  const insightsCache = ref<string>('')
  const insightsCacheTime = ref<string>('')
  const budgetPrediction = ref<string>('')
  const budgetPredictionTime = ref<string>('')

  function addChatMessage(role: 'user' | 'assistant', content: string) {
    chatHistory.value.push({ role, content })
  }

  function clearChat() {
    chatHistory.value = []
  }

  function getHistoryForAPI(): ChatMessage[] {
    // Keep last 20 messages to stay within token limits
    return chatHistory.value.slice(-20)
  }

  function setLoading(v: boolean) {
    isLoading.value = v
  }

  function setInsightsCache(content: string) {
    insightsCache.value = content
    insightsCacheTime.value = new Date().toISOString()
  }

  function isInsightsCacheValid(): boolean {
    if (!insightsCache.value || !insightsCacheTime.value) return false
    const cacheTime = new Date(insightsCacheTime.value).getTime()
    const now = Date.now()
    return now - cacheTime < 30 * 60 * 1000 // 30 minutes
  }

  function setBudgetPrediction(content: string) {
    budgetPrediction.value = content
    budgetPredictionTime.value = new Date().toISOString()
  }

  function isBudgetPredictionValid(): boolean {
    if (!budgetPrediction.value || !budgetPredictionTime.value) return false
    const cacheTime = new Date(budgetPredictionTime.value).getTime()
    const now = Date.now()
    return now - cacheTime < 30 * 60 * 1000
  }

  return {
    chatHistory,
    isLoading,
    insightsCache,
    budgetPrediction,
    addChatMessage,
    clearChat,
    getHistoryForAPI,
    setLoading,
    setInsightsCache,
    isInsightsCacheValid,
    setBudgetPrediction,
    isBudgetPredictionValid,
  }
})
