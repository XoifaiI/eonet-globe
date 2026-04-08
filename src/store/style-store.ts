import { create } from "zustand"

export const useStyleReady = create<{ ready: boolean; version: number }>(() => ({
  ready: true,
  version: 0,
}))
