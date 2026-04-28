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
  signUpWithEmail: (email: string, password: string) => Promise<{ error?: Error; user?: User | null }>;
  signInWithPassword: (email: string, password: string) => Promise<{ error?: Error }>;
  signInWithGoogle: () => Promise<{ error?: Error }>;
  resetPassword: (email: string) => Promise<{ error?: Error }>;
  signOut: () => Promise<void>;
}

let authSubscription: { unsubscribe: () => void } | null = null;

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  session: null,
  isLoading: false,
  isInitialized: false,

  setUser: (user) => set({ user }),
  setSession: (session) => set({ session }),
  setIsLoading: (isLoading) => set({ isLoading }),

  initialize: async () => {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (session) {
      const { data } = await supabase.auth.getUser();
      set({ session, user: data.user, isInitialized: true });
    } else {
      set({ isInitialized: true });
    }

    authSubscription?.unsubscribe();
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      set({ session, user: session?.user ?? null });
      if (_event === "SIGNED_IN") {
        const redirect = localStorage.getItem("auth_redirect");
        if (redirect) {
          localStorage.removeItem("auth_redirect");
          window.location.href = redirect;
        }
      }
    });
    authSubscription = subscription;
  },

  signInWithEmail: async (email) => {
    set({ isLoading: true });
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/groups`,
      },
    });
    set({ isLoading: false });
    return { error: error || undefined };
  },

  signUpWithEmail: async (email, password) => {
    set({ isLoading: true });
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/groups`,
      },
    });
    set({ isLoading: false });
    return { error: error || undefined, user: data.user };
  },

  signInWithPassword: async (email, password) => {
    set({ isLoading: true });
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    set({ isLoading: false });
    return { error: error || undefined };
  },

  signInWithGoogle: async () => {
    set({ isLoading: true });
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/groups`,
      },
    });
    set({ isLoading: false });
    return { error: error || undefined };
  },

  resetPassword: async (email) => {
    set({ isLoading: true });
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/`,
    });
    set({ isLoading: false });
    return { error: error || undefined };
  },

  signOut: async () => {
    set({ isLoading: true });
    authSubscription?.unsubscribe();
    authSubscription = null;
    await supabase.auth.signOut();
    set({ user: null, session: null, isLoading: false });
  },
}));
