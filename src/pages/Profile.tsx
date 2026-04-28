import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useAuthStore } from "../stores/authStore";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "../lib/supabase";
import { LogOut, Globe, Bell, Mail, User, Save } from "lucide-react";

export default function Profile() {
  const { t, i18n } = useTranslation();
  const { user, signOut } = useAuthStore();
  const queryClient = useQueryClient();
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [name, setName] = useState("");
  const [saveMessage, setSaveMessage] = useState("");

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
    if (profile?.name) setName(profile.name);
  }, [profile]);

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
      <h1 className="text-2xl font-bold text-gray-900">{t("nav.profile")}</h1>

      {user && (
        <div className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="w-14 h-14 bg-primary-100 rounded-full flex items-center justify-center">
              <User className="w-7 h-7 text-primary-600" />
            </div>
            <div className="flex-1">
              <p className="font-semibold text-gray-900">{user.email}</p>
              <p className="text-sm text-gray-500">
                {t("profile.memberSince", "Membro desde")}{" "}
                {profile?.created_at
                  ? new Date(profile.created_at).toLocaleDateString()
                  : "..."}
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="bg-white rounded-xl border border-gray-100 shadow-sm divide-y divide-gray-100">
        {/* Name edit */}
        <div className="p-4 space-y-3">
          <label className="block text-sm font-medium text-gray-700">
            {t("profile.displayName", "Nome / Apelido")}
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t("profile.namePlaceholder", "Seu nome")}
              className="flex-1 px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
            <button
              onClick={() => updateProfile.mutate()}
              disabled={updateProfile.isPending}
              className="px-4 py-2.5 bg-primary-600 text-white rounded-xl font-medium disabled:opacity-50 hover:bg-primary-700 transition-colors flex items-center gap-2"
            >
              <Save className="w-4 h-4" />
              {updateProfile.isPending ? t("app.loading") : t("app.save")}
            </button>
          </div>
          {saveMessage && (
            <p className="text-sm text-green-600">{saveMessage}</p>
          )}
        </div>

        {/* Language dropdown */}
        <div className="flex items-center gap-3 p-4">
          <Globe className="w-5 h-5 text-gray-500" />
          <span className="flex-1 text-gray-900">{t("profile.language", "Idioma")}</span>
          <select
            value={i18n.language}
            onChange={(e) => handleLanguageChange(e.target.value)}
            className="px-3 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-primary-500"
          >
            <option value="pt">Português</option>
            <option value="en">English</option>
          </select>
        </div>

        {/* Push notifications toggle (placeholder) */}
        <div className="flex items-center gap-3 p-4">
          <Bell className="w-5 h-5 text-gray-500" />
          <span className="flex-1 text-gray-900">{t("profile.pushNotifications", "Notificações push")}</span>
          <label className="relative inline-flex items-center cursor-pointer">
            <input type="checkbox" className="sr-only peer" defaultChecked />
            <div className="w-11 h-6 bg-gray-200 peer-focus:ring-2 peer-focus:ring-primary-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary-600"></div>
          </label>
        </div>

        {/* Email notifications toggle (placeholder) */}
        <div className="flex items-center gap-3 p-4">
          <Mail className="w-5 h-5 text-gray-500" />
          <span className="flex-1 text-gray-900">{t("profile.emailNotifications", "Notificações por email")}</span>
          <label className="relative inline-flex items-center cursor-pointer">
            <input type="checkbox" className="sr-only peer" />
            <div className="w-11 h-6 bg-gray-200 peer-focus:ring-2 peer-focus:ring-primary-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary-600"></div>
          </label>
        </div>
      </div>

      <button
        onClick={handleSignOut}
        disabled={isSigningOut}
        className="w-full flex items-center justify-center gap-2 p-4 bg-red-50 text-red-600 rounded-xl font-medium hover:bg-red-100 transition-colors"
      >
        <LogOut className="w-5 h-5" />
        {isSigningOut ? t("app.loading") : t("auth.logout")}
      </button>
    </div>
  );
}
