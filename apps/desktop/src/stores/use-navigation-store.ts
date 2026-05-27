import { create } from "zustand";

export type NavigablePage =
  | "gallery"
  | "ai-generate"
  | "ai-projects"
  | "trash"
  | "settings"
  | "explore"
  | "my-channel"
  | "archive";

interface NavigationStore {
  pendingPage: NavigablePage | null;
  navigateTo: (page: NavigablePage) => void;
  clearPending: () => void;
}

export const useNavigationStore = create<NavigationStore>((set) => ({
  pendingPage: null,
  navigateTo: (page) => set({ pendingPage: page }),
  clearPending: () => set({ pendingPage: null }),
}));
