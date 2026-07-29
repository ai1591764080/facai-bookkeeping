/**
 * Shared Pinia instance — allows independently-mounted Vue apps
 * (like VoiceCommander via DOM injection) to share the same stores.
 */
import type { Pinia } from 'pinia'

let _pinia: Pinia | null = null

export function setSharedPinia(p: Pinia) {
  _pinia = p
}

export function getSharedPinia(): Pinia | null {
  return _pinia
}
