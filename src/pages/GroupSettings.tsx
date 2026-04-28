import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { supabase } from "../lib/supabase";
import { useAuthStore } from "../stores/authStore";
import {
  ArrowLeft,
  Users,
  Trash2,
  AlertTriangle,
  Shield,
  UserMinus,
  MapPin,
  Save,
} from "lucide-react";
import type { Group, Venue } from "../types";

interface MemberWithProfile {
  id: string;
  user_id: string;
  role: string;
  joined_at: string;
  profile: { name: string; id: string };
}

export default function GroupSettings() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const user = useAuthStore((state) => state.user);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [saveMessage, setSaveMessage] = useState("");

  const [editName, setEditName] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editDefaultVenueId, setEditDefaultVenueId] = useState("");
  const [editMax1h, setEditMax1h] = useState(4);
  const [editMax2h, setEditMax2h] = useState(6);
  const [editMax3h, setEditMax3h] = useState(8);

  const { data: group, isLoading } = useQuery<Group>({
    queryKey: ["group", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("groups")
        .select("*")
        .eq("id", id)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  const { data: venues } = useQuery<Venue[]>({
    queryKey: ["group-venues", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("venues")
        .select("*")
        .eq("group_id", id);
      if (error) throw error;
      return data || [];
    },
    enabled: !!id,
  });

  const { data: members } = useQuery<MemberWithProfile[]>({
    queryKey: ["group-members", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("group_members")
        .select("*, profile:profiles(name, id)")
        .eq("group_id", id)
        .order("joined_at", { ascending: true });
      if (error) throw error;
      return (data || []) as MemberWithProfile[];
    },
    enabled: !!id,
  });

  useEffect(() => {
    if (group) {
      setEditName(group.name || "");
      setEditDescription(group.description || "");
      setEditDefaultVenueId(group.default_venue_id || "");
      setEditMax1h(group.max_players_1h || 4);
      setEditMax2h(group.max_players_2h || 6);
      setEditMax3h(group.max_players_3h_plus || 8);
    }
  }, [group]);

  const updateGroup = useMutation({
    mutationFn: async () => {
      if (!id) throw new Error("No group ID");
      const { error } = await supabase
        .from("groups")
        .update({
          name: editName.trim(),
          description: editDescription.trim() || null,
          default_venue_id: editDefaultVenueId || null,
          max_players_1h: editMax1h,
          max_players_2h: editMax2h,
          max_players_3h_plus: editMax3h,
        })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["group", id] });
      setSaveMessage(t("group.saved", "Salvo!"));
      setTimeout(() => setSaveMessage(""), 2000);
    },
    onError: () => {
      setSaveMessage(t("group.saveError", "Erro ao salvar"));
    },
  });

  const softDeleteGroup = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("groups")
        .update({ is_active: false })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["groups"] });
      navigate("/groups");
    },
  });

  const updateMemberRole = useMutation({
    mutationFn: async ({
      memberId,
      role,
    }: {
      memberId: string;
      role: string;
    }) => {
      const { error } = await supabase
        .from("group_members")
        .update({ role })
        .eq("id", memberId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["group-members", id] });
    },
  });

  const removeMember = useMutation({
    mutationFn: async (memberId: string) => {
      const { error } = await supabase
        .from("group_members")
        .delete()
        .eq("id", memberId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["group-members", id] });
    },
  });

  if (!id) return null;
  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600" />
      </div>
    );
  }

  const isAdmin = members?.some(
    (m) => m.user_id === user?.id && m.role === "admin"
  );

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
            {t("group.settings", "Configurações")}
          </h1>
        </div>
      </div>

      <div className="p-4 space-y-6">
        {/* Group Info Edit */}
        <div className="bg-white rounded-xl border border-gray-100 p-4 space-y-4">
          <h2 className="text-base font-semibold text-gray-900">
            {t("group.info", "Informações do grupo")}
          </h2>
          <div className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {t("group.name", "Nome do grupo")}
              </label>
              <input
                type="text"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {t("group.description", "Descrição")}
              </label>
              <textarea
                value={editDescription}
                onChange={(e) => setEditDescription(e.target.value)}
                rows={2}
                className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary-500 resize-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {t("group.defaultVenue", "Quadra padrão")}
              </label>
              <div className="relative">
                <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <select
                  value={editDefaultVenueId}
                  onChange={(e) => setEditDefaultVenueId(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary-500"
                >
                  <option value="">{t("group.noDefaultVenue")}</option>
                  {venues?.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  {t("group.max1h", "Max 1h")}
                </label>
                <input
                  type="number"
                  min={2}
                  value={editMax1h}
                  onChange={(e) => setEditMax1h(parseInt(e.target.value) || 4)}
                  className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  {t("group.max2h", "Max 2h")}
                </label>
                <input
                  type="number"
                  min={2}
                  value={editMax2h}
                  onChange={(e) => setEditMax2h(parseInt(e.target.value) || 6)}
                  className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  {t("group.max3h", "Max 3h+")}
                </label>
                <input
                  type="number"
                  min={2}
                  value={editMax3h}
                  onChange={(e) => setEditMax3h(parseInt(e.target.value) || 8)}
                  className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>
            </div>
            <button
              onClick={() => updateGroup.mutate()}
              disabled={updateGroup.isPending}
              className="w-full py-2.5 bg-primary-600 text-white rounded-xl font-medium disabled:opacity-50 hover:bg-primary-700 transition-colors flex items-center justify-center gap-2"
            >
              <Save className="w-4 h-4" />
              {updateGroup.isPending ? t("app.loading") : t("app.save")}
            </button>
            {saveMessage && (
              <p className="text-sm text-green-600 text-center">{saveMessage}</p>
            )}
          </div>
        </div>

        {/* Members */}
        <div className="bg-white rounded-xl border border-gray-100 p-4 space-y-4">
          <h2 className="text-base font-semibold text-gray-900 flex items-center gap-2">
            <Users className="w-5 h-5 text-primary-600" />
            {t("group.members", "Membros")} ({members?.length || 0})
          </h2>
          <div className="space-y-2">
            {members?.map((member) => (
              <div
                key={member.id}
                className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl"
              >
                <div className="w-10 h-10 bg-primary-100 rounded-full flex items-center justify-center flex-shrink-0">
                  <Users className="w-5 h-5 text-primary-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-gray-900 truncate">
                    {member.profile?.name || member.user_id}
                  </p>
                  <p className="text-xs text-gray-500">
                    {member.role === "admin"
                      ? t("group.admin", "Admin")
                      : t("group.member", "Membro")}
                  </p>
                </div>
                {isAdmin && member.user_id !== user?.id && (
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() =>
                        updateMemberRole.mutate({
                          memberId: member.id,
                          role: member.role === "admin" ? "member" : "admin",
                        })
                      }
                      disabled={updateMemberRole.isPending}
                      className="p-2 hover:bg-gray-200 rounded-lg transition-colors"
                      title={
                        member.role === "admin"
                          ? t("group.demote", "Rebaixar")
                          : t("group.promote", "Promover")
                      }
                    >
                      <Shield
                        className={`w-4 h-4 ${
                          member.role === "admin"
                            ? "text-gray-400"
                            : "text-primary-600"
                        }`}
                      />
                    </button>
                    <button
                      onClick={() => removeMember.mutate(member.id)}
                      disabled={removeMember.isPending}
                      className="p-2 hover:bg-red-100 rounded-lg transition-colors"
                      title={t("group.remove", "Remover")}
                    >
                      <UserMinus className="w-4 h-4 text-red-500" />
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Danger Zone */}
        <div className="bg-white rounded-xl border border-red-100 p-4 space-y-3">
          <h3 className="text-sm font-medium text-red-700 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4" />
            {t("group.dangerZone", "Zona de perigo")}
          </h3>
          <p className="text-sm text-gray-500">
            {t(
              "group.deleteWarning",
              "Desativar o grupo remove-o da lista. Os dados históricos são preservados."
            )}
          </p>
          {!showDeleteConfirm ? (
            <button
              onClick={() => setShowDeleteConfirm(true)}
              className="w-full py-3 border border-red-200 text-red-600 rounded-xl font-medium hover:bg-red-50 transition-colors flex items-center justify-center gap-2"
            >
              <Trash2 className="w-4 h-4" />
              {t("group.deactivate", "Desativar grupo")}
            </button>
          ) : (
            <div className="space-y-3">
              <p className="text-sm text-red-600 font-medium">
                {t("group.confirmDeactivate", "Tem certeza? Esta ação não pode ser desfeita.")}
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => softDeleteGroup.mutate()}
                  disabled={softDeleteGroup.isPending}
                  className="flex-1 py-3 bg-red-600 text-white rounded-xl font-medium disabled:opacity-50 hover:bg-red-700 transition-colors"
                >
                  {softDeleteGroup.isPending
                    ? t("app.loading")
                    : t("group.confirm", "Sim, desativar")}
                </button>
                <button
                  onClick={() => setShowDeleteConfirm(false)}
                  className="flex-1 py-3 bg-gray-100 text-gray-700 rounded-xl font-medium hover:bg-gray-200 transition-colors"
                >
                  {t("app.cancel")}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
