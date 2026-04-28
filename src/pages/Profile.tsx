import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useAuthStore } from "../stores/authStore";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "../lib/supabase";
import { LogOut, Globe, Bell, Mail, User, Save, Moon } from "lucide-react";
import { useAppStore } from "../stores/appStore";

export default function Profile() {
  const { t, i18n } = useTranslation();
  const { user, signOut } = useAuthStore();
  const { theme, setTheme } = useAppStore();
  const queryClient = useQueryClient();
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [name, setName] = useState("");
  const [saveMessage, setSaveMessage] = useState("");
  const [hasHydrated, setHasHydrated] = useState(false);

  const { data: profile } = useQuery({
    queryKey: ["profile", user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!user?.id,
  });

  useEffect(() => {
    if (profile?.name && !hasHydrated) {
      setName(profile.name);
      setHasHydrated(true);
    }
  }, [profile, hasHydrated]);

  const updateProfile = useMutation({
    mutationFn: async () => {
      if (!user?.id) throw new Error("Not authenticated");
      const { error } = await supabase
        .from("profiles")
        .update({ name: name.trim() })
        .eq("id", user.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["profile", user?.id] });
      setSaveMessage(t("profile.saved", "Salvo!"));
      setTimeout(() => setSaveMessage(""), 2000);
    },
    onError: () => {
      setSaveMessage(t("profile.saveError", "Erro ao salvar"));
    },
  });

  const handleSignOut = async () => {
    setIsSigningOut(true);
    await signOut();
    setIsSigningOut(false);
  };

  const handleLanguageChange = (lang: string) => {
    i18n.changeLanguage(lang);
  };

  return (
    <div className="p-4 space-y-6">
      <h1 className="text-2xl font-bold text-foreground">{t("nav.profile")}</h1>

      {user && (
        <div className="bg-surface rounded-xl border border-border p-4 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="w-14 h-14 bg-primary/10 rounded-full flex items-center justify-center">
              <User className="w-7 h-7 text-primary" />
            </div>
            <div className="flex-1">
              <p className="font-semibold text-foreground">{user.email}</p>
              <p className="text-sm text-muted-foreground">
                {t("profile.memberSince", "Membro desde")}{" "}
                {profile?.created_at
                  ? new Date(profile.created_at).toLocaleDateString(i18n.language)
                  : "..."}
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="bg-surface rounded-xl border border-border shadow-sm divide-y divide-border">
        {/* Name edit */}
        <div className="p-4 space-y-3">
          <label className="block text-sm font-medium text-muted-foreground">
            {t("profile.displayName", "Nome / Apelido")}
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t("profile.namePlaceholder", "Seu nome")}
              className="flex-1 px-4 py-2.5 bg-background border border-border rounded-xl text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
            />
            <button
              onClick={() => {
                if (name.trim() === (profile?.name || "")) return;
                updateProfile.mutate();
              }}
              disabled={updateProfile.isPending}
              className="px-4 py-2.5 bg-primary text-white rounded-xl font-medium disabled:opacity-50 hover:bg-primary/90 transition-colors flex items-center gap-2"
            >
              <Save className="w-4 h-4" />
              {updateProfile.isPending ? t("app.loading") : t("app.save")}
            </button>
          </div>
          {saveMessage && (
            <p className="text-sm text-green-500">{saveMessage}</p>
          )}
        </div>

        {/* Language dropdown */}
        <div className="flex items-center gap-3 p-4">
          <Globe className="w-5 h-5 text-muted-foreground" />
          <span className="flex-1 text-foreground">{t("profile.language", "Idioma")}</span>
          <select
            value={i18n.language}
            onChange={(e) => handleLanguageChange(e.target.value)}
            className="px-3 py-1.5 bg-background border border-border rounded-lg text-sm text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
          >
            <option value="pt">Português</option>
            <option value="en">English</option>
          </select>
        </div>

        {/* Push notifications toggle (placeholder) */}
        <div className="flex items-center gap-3 p-4">
          <Bell className="w-5 h-5 text-muted-foreground" />
          <span className="flex-1 text-foreground">{t("profile.pushNotifications", "Notificações push")}</span>
          <label className="relative inline-flex items-center cursor-pointer">
            <input type="checkbox" className="sr-only peer" defaultChecked />
            <div className="w-11 h-6 bg-muted peer-focus:ring-2 peer-focus:ring-primary/30 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-surface after:border-border after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
          </label>
        </div>

        {/* Theme toggle */}
        <div className="flex items-center gap-3 p-4">
          <Moon className="w-5 h-5 text-muted-foreground" />
          <span className="flex-1 text-foreground">{t("profile.theme", "Tema")}</span>
          <div className="flex rounded-lg border border-border overflow-hidden">
            {(["light", "dark", "system"] as const).map((tOption) => (
              <button
                key={tOption}
                onClick={() => setTheme(tOption)}
                className={`px-3 py-1.5 text-sm font-medium transition-colors ${
                  theme === tOption
                    ? "bg-primary text-primary-foreground"
                    : "bg-surface text-muted-foreground hover:bg-muted"
                }`}
              >
                {tOption === "light" && t("profile.themeLight", "Claro")}
                {tOption === "dark" && t("profile.themeDark", "Escuro")}
                {tOption === "system" && t("profile.themeSystem", "Auto")}
              </button>
            ))}
          </div>
        </div>

        {/* Email notifications toggle (placeholder) */}
        <div className="flex items-center gap-3 p-4">
          <Mail className="w-5 h-5 text-muted-foreground" />
          <span className="flex-1 text-foreground">{t("profile.emailNotifications", "Notificações por email")}</span>
          <label className="relative inline-flex items-center cursor-pointer">
            <input type="checkbox" className="sr-only peer" />
            <div className="w-11 h-6 bg-muted peer-focus:ring-2 peer-focus:ring-primary/30 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-surface after:border-border after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
          </label>
        </div>
      </div>

      <button
        onClick={handleSignOut}
        disabled={isSigningOut}
        className="w-full flex items-center justify-center gap-2 p-4 bg-destructive/10 text-destructive rounded-xl font-medium hover:bg-destructive/10 transition-colors"
      >
        <LogOut className="w-5 h-5" />
        {isSigningOut ? t("app.loading") : t("auth.logout")}
      </button>
    </div>
  );
}
