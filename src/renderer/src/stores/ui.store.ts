import { create } from 'zustand'

export type AppPage = 'connections' | 'products' | 'briefing'

interface UiState {
  currentPage: AppPage
  setPage: (page: AppPage) => void
}

export const useUiStore = create<UiState>((set) => ({
  currentPage: 'connections',
  setPage: (page) => set({ currentPage: page })
}))
