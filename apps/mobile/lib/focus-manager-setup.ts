import { focusManager } from '@tanstack/react-query'
import { AppState, type AppStateStatus } from 'react-native'

let registered = false

export function registerFocusManager() {
  if (registered) return
  registered = true
  focusManager.setEventListener((handleFocus) => {
    const sub = AppState.addEventListener('change', (state: AppStateStatus) => {
      handleFocus(state === 'active')
    })
    return () => sub.remove()
  })
}
