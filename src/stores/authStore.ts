import { create } from "zustand";
import { supabase } from "../lib/supabase";
import type { User, Session } from "@supabase/supabase-js";

interface AuthState {
  user: User | null;
  session: Session | null;
  isLoading: boolean;
  isInitialized: boolean;
  setUser: (user: User | null) => void;
  setSession: (session: Session | null) => void;
  setIsLoading: (loading: boolean) => void;
  initialize: () => Promise<void>;
  signInWithEmail: (email: string) => Promise<{ error?: Error }>;
  signInWithGoogle: () => Promise<{ error?: Error }>;
  signOut: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  session: null,
  isLoading: false,
  isInitialized: false,

  setUser: (user) => set({ user }),
  setSession: (session) => set({ session }),
  setIsLoading: (isLoading) => set({ isLoading }),

  initialize: async () => {
    // Get current session
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (session) {
      const { data } = await supabase.auth.getUser();
      set({ session, user: data.user, isInitialized: true });
    } else {
      set({ isInitialized: true });
    }

    // Listen for auth changes
    supabase.auth.onAuthStateChange((_event, session) => {
      set({ session, user: session?.user ?? null });
    });
  },

  signInWithEmail: async (email) => {
    set({ isLoading: true });
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/dashboard`,
      },
    });
    set({ isLoading: false });
    return { error: error || undefined };
  },

  signInWithGoogle: async () => {
    set({ isLoading: true });
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/dashboard`,
      },
    });
    set({ isLoading: false });
    return { error: error || undefined };
  },

  signOut: async () => {
    set({ isLoading: true });
    await supabase.auth.signOut();
    set({ user: null, session: null, isLoading: false });
  },
}));
