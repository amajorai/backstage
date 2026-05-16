import type { GridStateSnapshot } from "react-virtuoso";
import { create } from "zustand";

export type SearchMode = "text" | "semantic";

interface GalleryUIState {
  lastClickedIndex: number | null;
  setLastClickedIndex: (index: number | null) => void;
  scrollOffset: number;
  setScrollOffset: (offset: number) => void;
  gridSnapshot: GridStateSnapshot | null;
  setGridSnapshot: (snapshot: GridStateSnapshot | null) => void;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  filteredCount: number;
  setFilteredCount: (count: number) => void;
  selectedFolderId: string | null;
  setSelectedFolderId: (id: string | null) => void;
  bulkMoveFolderOpen: boolean;
  setBulkMoveFolderOpen: (open: boolean) => void;
  // Semantic search
  searchMode: SearchMode;
  setSearchMode: (mode: SearchMode) => void;
  semanticResultIds: string[] | null;
  setSemanticResultIds: (ids: string[] | null) => void;
  isSemanticSearching: boolean;
  setIsSemanticSearching: (v: boolean) => void;
}

export const useGalleryUIStore = create<GalleryUIState>()((set) => ({
  lastClickedIndex: null,
  setLastClickedIndex: (index) => set({ lastClickedIndex: index }),
  scrollOffset: 0,
  setScrollOffset: (offset) => set({ scrollOffset: offset }),
  gridSnapshot: null,
  setGridSnapshot: (snapshot) => set({ gridSnapshot: snapshot }),
  searchQuery: "",
  setSearchQuery: (query) => set({ searchQuery: query }),
  filteredCount: 0,
  setFilteredCount: (count) => set({ filteredCount: count }),
  selectedFolderId: null,
  setSelectedFolderId: (id) => set({ selectedFolderId: id }),
  bulkMoveFolderOpen: false,
  setBulkMoveFolderOpen: (open) => set({ bulkMoveFolderOpen: open }),
  searchMode: "text",
  setSearchMode: (mode) => set({ searchMode: mode }),
  semanticResultIds: null,
  setSemanticResultIds: (ids) => set({ semanticResultIds: ids }),
  isSemanticSearching: false,
  setIsSemanticSearching: (v) => set({ isSemanticSearching: v }),
}));
