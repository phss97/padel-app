import { useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { supabase } from "../lib/supabase";
import { useAuthStore } from "../stores/authStore";
import { useMutation, useQuery } from "@tanstack/react-query";
import { ArrowLeft, Users, CheckCircle, AlertCircle, LogIn } from "lucide-react";

export default function JoinGroup() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { user } = useAuthStore();
  const code = searchParams.get("code");
  const [error, setError] = useState("");
  const [joined, setJoined] = useState(false);

  const { data: group, isLoading: isLoadingGroup } = useQuery({
    queryKey: ["group-by-code", code],
    queryFn: async () => {
      if (!code) return null;
      const { data, error } = await supabase
        .from("groups")
        .select("*, venues(name)")
        .eq("invite_code", code)
        .eq("is_active", true)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!code,
  });

  const { data: existingMembership } = useQuery({
    queryKey: ["group-membership", group?.id, user?.id],
    queryFn: async () => {
      if (!group?.id || !user?.id) return null;
      const { data, error } = await supabase
        .from("group_members")
        .select("*")
        .eq("group_id", group.id)
        .eq("user_id", user.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!group?.id && !!user?.id,
  });

  const joinGroup = useMutation({
    mutationFn: async () => {
      if (!group?.id) throw new Error("No group");
      if (!user?.id) throw new Error("Not authenticated");
      const { error } = await supabase.from("group_members").insert({
        group_id: group.id,
        user_id: user.id,
        role: "member",
      });
      if (error) throw error;
    },
    onSuccess: () => {
      setJoined(true);
      setTimeout(() => {
        navigate(`/groups/${group?.id}`);
      }, 1500);
    },
    onError: (err: Error) => {
      setError(err.message);
    },
  });

  const handleLoginRedirect = () => {
    localStorage.setItem("auth_redirect", window.location.href);
    navigate("/");
  };

  if (!code) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-xl p-6 shadow-sm text-center space-y-4">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto" />
          <h1 className="text-lg font-semibold text-gray-900">
            {t("group.invalidCode", "Código de convite inválido")}
          </h1>
          <button
            onClick={() => navigate("/groups")}
            className="px-4 py-2 bg-primary-600 text-white rounded-lg"
          >
            {t("app.back")}
          </button>
        </div>
      </div>
    );
  }

  if (isLoadingGroup) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" />
      </div>
    );
  }

  if (!group) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-xl p-6 shadow-sm text-center space-y-4">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto" />
          <h1 className="text-lg font-semibold text-gray-900">
            {t("group.notFound", "Grupo não encontrado")}
          </h1>
          <p className="text-gray-500 text-sm">
            {t(
              "group.codeExpired",
              "O código pode ter expirado ou o grupo não existe mais"
            )}
          </p>
          <button
            onClick={() => navigate("/groups")}
            className="px-4 py-2 bg-primary-600 text-white rounded-lg"
          >
            {t("app.back")}
          </button>
        </div>
      </div>
    );
  }

  const isExpired = group.invite_expires_at
    ? new Date(group.invite_expires_at) < new Date()
    : true;

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="flex items-center gap-3 p-4">
          <button
            onClick={() => navigate(-1)}
            className="p-2 -ml-2 hover:bg-gray-100 rounded-lg"
          >
            <ArrowLeft className="w-5 h-5 text-gray-600" />
          </button>
          <h1 className="text-lg font-semibold text-gray-900">
            {t("group.joinGroup", "Entrar no grupo")}
          </h1>
        </div>
      </div>

      <div className="p-4">
        <div className="bg-white rounded-xl border border-gray-100 p-6 shadow-sm space-y-6">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 bg-primary-100 rounded-2xl flex items-center justify-center">
              <Users className="w-8 h-8 text-primary-600" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-900">
                {group.name}
              </h2>
              {group.venues?.name && (
                <p className="text-gray-500">{group.venues.name}</p>
              )}
            </div>
          </div>

          {isExpired ? (
            <div className="bg-red-50 rounded-lg p-4 text-center">
              <AlertCircle className="w-6 h-6 text-red-500 mx-auto mb-2" />
              <p className="text-red-700 font-medium">
                {t("group.inviteExpired", "Este convite expirou")}
              </p>
            </div>
          ) : !user ? (
            <div className="space-y-3">
              <p className="text-sm text-gray-600 text-center">
                {t("auth.loginToJoin", "Faça login para entrar no grupo")}
              </p>
              <button
                onClick={handleLoginRedirect}
                className="w-full py-3 bg-primary-600 text-white rounded-xl font-medium flex items-center justify-center gap-2"
              >
                <LogIn className="w-5 h-5" />
                {t("auth.login", "Entrar")}
              </button>
            </div>
          ) : existingMembership ? (
            <div className="bg-green-50 rounded-lg p-4 text-center space-y-2">
              <CheckCircle className="w-6 h-6 text-green-500 mx-auto" />
              <p className="text-green-700 font-medium">
                {t("group.alreadyMember", "Você já é membro deste grupo")}
              </p>
              <button
                onClick={() => navigate(`/groups/${group.id}`)}
                className="px-4 py-2 bg-primary-600 text-white rounded-lg text-sm"
              >
                {t("app.goToGroup", "Ir para o grupo")}
              </button>
            </div>
          ) : joined ? (
            <div className="bg-green-50 rounded-lg p-4 text-center space-y-2">
              <CheckCircle className="w-6 h-6 text-green-500 mx-auto" />
              <p className="text-green-700 font-medium">
                {t("group.joined", "Você entrou no grupo!")}
              </p>
            </div>
          ) : (
            <button
              onClick={() => joinGroup.mutate()}
              disabled={joinGroup.isPending}
              className="w-full py-3 bg-primary-600 text-white rounded-xl font-medium disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {joinGroup.isPending ? (
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <CheckCircle className="w-5 h-5" />
              )}
              {t("group.join", "Entrar no grupo")}
            </button>
          )}

          {error && (
            <div className="bg-red-50 rounded-lg p-3 text-red-700 text-sm text-center">
              {error}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
