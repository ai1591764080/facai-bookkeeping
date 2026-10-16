import { defineStore } from 'pinia' // Pinia：defineStore 定义响应式状态仓库
import { ref } from 'vue' // Vue 响应式：ref 声明响应式数据

/**
 * 把主题写到根节点：颜色全部用 CSS 变量（见 App.vue 的 :root），
 * H5 用 html[data-theme="dark"] 覆盖变量即可整站换色；
 * 其他端没有 document，改导航栏配色兜底。
 */
function applyTheme(t: 'light' | 'dark') {
  // #ifdef H5
  const el = typeof document !== 'undefined' ? document.documentElement : null
  if (el) el.setAttribute('data-theme', t)
  // #endif

  // #ifndef H5
  try {
    uni.setNavigationBarColor({
      frontColor: t === 'dark' ? '#ffffff' : '#000000',
      backgroundColor: t === 'dark' ? '#12131A' : '#F5F6FA',
    })
  } catch (e) {
    /* 端上不支持则忽略 */
  }
  // #endif
}

export const useSettingsStore = defineStore('settings', () => {
  const theme = ref<'light' | 'dark'>(
    (uni.getStorageSync('beecount_theme') as 'light' | 'dark') || 'light'
  )
  const currency = ref<string>(uni.getStorageSync('beecount_currency') || 'CNY')
  const monthStartDay = ref<number>(Number(uni.getStorageSync('beecount_month_start')) || 1)

  function setTheme(t: 'light' | 'dark') {
    theme.value = t
    uni.setStorageSync('beecount_theme', t)
    applyTheme(t)
  }

  function setCurrency(c: string) {
    currency.value = c
    uni.setStorageSync('beecount_currency', c)
  }

  function setMonthStartDay(d: number) {
    monthStartDay.value = d
    uni.setStorageSync('beecount_month_start', d)
  }

  // 启动时立刻生效一次，否则要等用户手动切换才有深色
  applyTheme(theme.value)

  return { theme, currency, monthStartDay, setTheme, setCurrency, setMonthStartDay }
})
