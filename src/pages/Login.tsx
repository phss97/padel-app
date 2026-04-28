import type { FC, FormEvent } from "react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useAuthStore } from "../stores/authStore";
import { LogIn, Mail, Globe, Lock, KeyRound } from "lucide-react";

type AuthMode = "magic" | "signin" | "signup";

type MessageType = "info" | "success" | "error";

const modeTabs: { key: AuthMode; labelKey: string; fallback: string }[] = [
  { key: "magic", labelKey: "auth.magicLink", fallback: "Link mágico" },
  { key: "signin", labelKey: "auth.password", fallback: "Senha" },
];

const Login: FC = () => {
  const { t, i18n } = useTranslation();
  const { signInWithEmail, signUpWithEmail, signInWithPassword, signInWithGoogle, isLoading } =
    useAuthStore();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [authMode, setAuthMode] = useState<AuthMode>("magic");
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState<MessageType>("info");

  const handleMagicLink = async (e: FormEvent) => {
    e.preventDefault();
    setMessage("");
    const { error } = await signInWithEmail(email);
    if (error) {
      setMessageType("error");
      setMessage(error.message);
    } else {
      setMessageType("success");
      setMessage(t("auth.magicLinkSent", "Link enviado! Verifique seu e-mail."));
      setEmail("");
    }
  };

  const handlePasswordSignIn = async (e: FormEvent) => {
    e.preventDefault();
    setMessage("");
    const { error } = await signInWithPassword(email, password);
    if (error) {
      setMessageType("error");
      setMessage(error.message);
    }
  };

  const handleSignUp = async (e: FormEvent) => {
    e.preventDefault();
    setMessage("");
    if (password !== confirmPassword) {
      setMessageType("error");
      setMessage(t("auth.passwordsDontMatch", "As senhas não coincidem."));
      return;
    }
    const { error } = await signUpWithEmail(email, password);
    if (error) {
      setMessageType("error");
      setMessage(error.message);
    } else {
      setMessageType("success");
      setMessage(
        t("auth.signUpSuccess", "Conta criada! Verifique seu e-mail para confirmar.")
      );
      setAuthMode("signin");
      setPassword("");
      setConfirmPassword("");
    }
  };

  const toggleLanguage = () => {
    i18n.changeLanguage(i18n.language === "pt" ? "en" : "pt");
  };

  const switchMode = (mode: AuthMode) => {
    setAuthMode(mode);
    setMessage("");
    setMessageType("info");
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <div className="flex-1 flex flex-col items-center justify-center p-6">
        <div className="w-full max-w-sm space-y-8">
          <div className="flex justify-end">
            <button
              onClick={toggleLanguage}
              className="flex items-center gap-2 text-sm text-muted-foreground hover:text-muted-foreground"
            >
              <Globe className="w-4 h-4" />
              {i18n.language === "pt" ? "English" : "Português"}
            </button>
          </div>

          <div className="text-center space-y-2">
            <div className="mx-auto w-16 h-16 bg-primary rounded-2xl flex items-center justify-center shadow-lg">
              <LogIn className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-2xl font-bold text-foreground">{t("app.title")}</h1>
            <p className="text-muted-foreground">
              {t("auth.subtitle", "Organize suas partidas de padel")}
            </p>
          </div>

          {/* Mode toggle */}
          <div className="flex bg-muted rounded-xl p-1">
            {modeTabs.map((mode) => (
              <button
                key={mode.key}
                onClick={() => switchMode(mode.key)}
                className={`flex-1 py-2 text-sm font-medium rounded-lg transition-colors ${
                  authMode === mode.key
                    ? "bg-surface text-primary shadow-sm"
                    : "text-muted-foreground hover:text-muted-foreground"
                }`}
              >
                {t(mode.labelKey, mode.fallback)}
              </button>
            ))}
          </div>

          {/* Magic Link Form */}
          {authMode === "magic" && (
            <form onSubmit={handleMagicLink} className="space-y-4">
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                <input
                  type="email"
                  required
                  placeholder={t("auth.email")}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 bg-surface border border-border rounded-xl text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                />
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-3 bg-primary hover:bg-primary/90 disabled:opacity-50 text-white font-semibold rounded-xl transition-colors"
              >
                {isLoading ? t("app.loading") : t("auth.sendMagicLink", "Enviar link")}
              </button>
            </form>
          )}

          {/* Password Sign In / Sign Up */}
          {(authMode === "signin" || authMode === "signup") && (
            <form
              onSubmit={authMode === "signin" ? handlePasswordSignIn : handleSignUp}
              className="space-y-4"
            >
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                <input
                  type="email"
                  required
                  placeholder={t("auth.email")}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 bg-surface border border-border rounded-xl text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                />
              </div>

              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                <input
                  type="password"
                  required
                  placeholder={t("auth.password", "Senha")}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 bg-surface border border-border rounded-xl text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                />
              </div>

              {authMode === "signup" && (
                <div className="relative">
                  <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                  <input
                    type="password"
                    required
                    placeholder={t("auth.confirmPassword", "Confirmar senha")}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="w-full pl-10 pr-4 py-3 bg-surface border border-border rounded-xl text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                  />
                </div>
              )}

              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-3 bg-primary hover:bg-primary/90 disabled:opacity-50 text-white font-semibold rounded-xl transition-colors"
              >
                {isLoading
                  ? t("app.loading")
                  : t(authMode === "signin" ? "auth.signIn" : "auth.signUp", authMode === "signin" ? "Entrar" : "Criar conta")}
              </button>

              <div className="text-center">
                {authMode === "signin" ? (
                  <button
                    type="button"
                    onClick={() => switchMode("signup")}
                    className="text-sm text-primary hover:text-primary/90 font-medium"
                  >
                    {t("auth.noAccount", "Não tem conta? Cadastre-se")}
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => switchMode("signin")}
                    className="text-sm text-primary hover:text-primary/90 font-medium"
                  >
                    {t("auth.hasAccount", "Já tem conta? Entrar")}
                  </button>
                )}
              </div>
            </form>
          )}

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-border"></div>
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-2 bg-background text-muted-foreground">{t("auth.or")}</span>
            </div>
          </div>

          <button
            onClick={() => signInWithGoogle()}
            disabled={isLoading}
            className="w-full py-3 bg-surface border border-border hover:bg-background disabled:opacity-50 text-muted-foreground font-semibold rounded-xl transition-colors flex items-center justify-center gap-2"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24">
              <path
                fill="#4285F4"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
              />
              <path
                fill="#34A853"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="#FBBC05"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
              />
              <path
                fill="#EA4335"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
              />
            </svg>
            {t("auth.google")}
          </button>

          {message && (
            <div
              className={`p-3 rounded-lg text-sm text-center ${
                messageType === "success"
                  ? "bg-green-500/10 text-green-500"
                  : messageType === "error"
                  ? "bg-destructive/10 text-destructive"
                  : "bg-muted text-muted-foreground"
              }`}
            >
              {message}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Login;
