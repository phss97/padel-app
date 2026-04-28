import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useAuthStore } from "../stores/authStore";
import { LogOut, Globe, Bell, Mail, User } from "lucide-react";

export default function Profile() {
  const { t, i18n } = useTranslation();
  const { user, signOut } = useAuthStore();
  const [isSigningOut, setIsSigningOut] = useState(false);

  const handleSignOut = async () => {
    setIsSigningOut(true);
    await signOut();
    setIsSigningOut(false);
  };

  const toggleLanguage = () => {
    i18n.changeLanguage(i18n.language === "pt" ? "en" : "pt");
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
            <div>
              <p className="font-semibold text-gray-900">{user.email}</p>
              <p className="text-sm text-gray-500">{t("profile.memberSince", "Membro desde")} ...</p>
            </div>
          </div>
        </div>
      )}

      <div className="bg-white rounded-xl border border-gray-100 shadow-sm divide-y divide-gray-100">
        <button
          onClick={toggleLanguage}
          className="w-full flex items-center gap-3 p-4 hover:bg-gray-50 transition-colors"
        >
          <Globe className="w-5 h-5 text-gray-500" />
          <span className="flex-1 text-left text-gray-900">
            {t("profile.language", "Idioma")}
          </span>
          <span className="text-sm text-gray-500">
            {i18n.language === "pt" ? "Português" : "English"}
          </span>
        </button>

        <div className="flex items-center gap-3 p-4">
          <Bell className="w-5 h-5 text-gray-500" />
          <span className="flex-1 text-gray-900">{t("profile.pushNotifications", "Notificações push")}</span>
          <label className="relative inline-flex items-center cursor-pointer">
            <input type="checkbox" className="sr-only peer" defaultChecked />
            <div className="w-11 h-6 bg-gray-200 peer-focus:ring-2 peer-focus:ring-primary-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary-600"></div>
          </label>
        </div>

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
