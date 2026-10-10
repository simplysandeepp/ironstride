import { useSyncExternalStore } from 'react'
import { getSwState, subscribeSwState } from '../pwa/swState.ts'

export const useSwState = () => useSyncExternalStore(subscribeSwState, getSwState)
