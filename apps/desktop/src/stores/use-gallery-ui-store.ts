import { create } from "zustand";

interface GalleryUIState {
  lastClickedIndex: number | null;
  setLastClickedIndex: (index: number | null) => void;
  scrollOffset: number;
  setScrollOffset: (offset: number) => void;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  filteredCount: number;
  setFilteredCount: (count: number) => void;
}

export const useGalleryUIStore = create<GalleryUIState>()((set) => ({
  lastClickedIndex: null,
  setLastClickedIndex: (index) => set({ lastClickedIndex: index }),
  scrollOffset: 0,
  setScrollOffset: (offset) => set({ scrollOffset: offset }),
  searchQuery: "",
  setSearchQuery: (query) => set({ searchQuery: query }),
  filteredCount: 0,
  setFilteredCount: (count) => set({ filteredCount: count }),
}));
