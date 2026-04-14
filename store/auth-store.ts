import { create } from "zustand";
import type { User } from "@/types";

interface AuthState {
  user: User | null;
  setUser: (user: User | null) => void;
  logout: () => void;
}

const STORAGE_KEY = "eonet-auth";

function loadUser(): User | null {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) : null;
  } catch {
    return null;
  }
}

export const useAuthStore = create<AuthState>((set) => ({
  user: loadUser(),
  setUser: (user) => {
    if (user) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(user));
    } else {
      localStorage.removeItem(STORAGE_KEY);
    }
    set({ user });
  },
  logout: () => {
    localStorage.removeItem(STORAGE_KEY);
    set({ user: null });
  },
}));
