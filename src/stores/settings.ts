import { defineStore } from 'pinia'
import { ref } from 'vue'

export const useSettingsStore = defineStore('settings', () => {
  const theme = ref<'light' | 'dark'>(
    (uni.getStorageSync('beecount_theme') as 'light' | 'dark') || 'light'
  )
  const currency = ref<string>(uni.getStorageSync('beecount_currency') || 'CNY')
  const monthStartDay = ref<number>(Number(uni.getStorageSync('beecount_month_start')) || 1)

  function setTheme(t: 'light' | 'dark') {
    theme.value = t
    uni.setStorageSync('beecount_theme', t)
  }

  function setCurrency(c: string) {
    currency.value = c
    uni.setStorageSync('beecount_currency', c)
  }

  function setMonthStartDay(d: number) {
    monthStartDay.value = d
    uni.setStorageSync('beecount_month_start', d)
  }

  return { theme, currency, monthStartDay, setTheme, setCurrency, setMonthStartDay }
})
