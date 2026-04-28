import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { supabase } from "../lib/supabase";
import { Users, Plus, X } from "lucide-react";
import { Link } from "react-router-dom";
import type { Group } from "../types";

export default function Groups() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [groupName, setGroupName] = useState("");
  const [groupDescription, setGroupDescription] = useState("");
  const [error, setError] = useState("");

  const { data: groups, isLoading } = useQuery<Group[]>({
    queryKey: ["groups"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("group_members")
        .select("group:groups(*)")
        .eq("user_id", (await supabase.auth.getUser()).data.user!.id);
      if (error) throw error;
      return ((data as unknown as { group: Group }[]) || [])?.map((d) => d.group).filter((g) => g?.is_active) || [];
    },
  });

  const createGroup = useMutation({
    mutationFn: async () => {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) throw new Error("Not authenticated");

      const permanentCode = Math.random()
        .toString(36)
        .substring(2, 10)
        .toUpperCase();

      const { data: group, error: groupError } = await supabase
        .from("groups")
        .insert({
          name: groupName.trim(),
          description: groupDescription.trim() || null,
          created_by: userData.user.id,
          permanent_invite_code: permanentCode,
        })
        .select()
        .single();

      if (groupError) throw groupError;

      // Add creator as admin
      const { error: memberError } = await supabase
        .from("group_members")
        .insert({
          group_id: group.id,
          user_id: userData.user.id,
          role: "admin",
        });

      if (memberError) throw memberError;

      return group;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["groups"] });
      setShowCreateModal(false);
      setGroupName("");
      setGroupDescription("");
      setError("");
    },
    onError: (err: Error) => {
      setError(err.message);
    },
  });

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!groupName.trim()) return;
    createGroup.mutate();
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="p-4 space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-gray-900">{t("nav.groups")}</h1>
          <button
            onClick={() => setShowCreateModal(true)}
            className="w-10 h-10 bg-primary-600 text-white rounded-full flex items-center justify-center shadow-sm hover:bg-primary-700 transition-colors"
          >
            <Plus className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-3">
          {isLoading && (
            <div className="flex justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" />
            </div>
          )}

          {groups?.map((group) => (
            <Link
              key={group.id}
              to={`/groups/${group.id}`}
              className="block bg-white rounded-xl border border-gray-100 p-4 shadow-sm hover:shadow-md transition-shadow active:scale-[0.98]"
            >
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-primary-100 rounded-xl flex items-center justify-center flex-shrink-0">
                  <Users className="w-6 h-6 text-primary-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-gray-900 truncate">
                    {group.name}
                  </h3>
                  {group.description && (
                    <p className="text-sm text-gray-500 truncate">
                      {group.description}
                    </p>
                  )}
                </div>
              </div>
            </Link>
          ))}

          {!isLoading && (!groups || groups.length === 0) && (
            <div className="text-center py-8 text-gray-400">
              <Users className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p>{t("group.noGroups")}</p>
              <button
                onClick={() => setShowCreateModal(true)}
                className="mt-3 text-primary-600 font-medium"
              >
                {t("group.createFirst", "Criar primeiro grupo")}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Create Group Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center">
          <div className="bg-white rounded-t-2xl sm:rounded-2xl w-full max-w-md p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900">
                {t("group.createNew", "Novo grupo")}
              </h2>
              <button
                onClick={() => {
                  setShowCreateModal(false);
                  setError("");
                  setGroupName("");
                  setGroupDescription("");
                }}
                className="p-2 hover:bg-gray-100 rounded-lg"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {t("group.name", "Nome do grupo")}
                </label>
                <input
                  type="text"
                  required
                  value={groupName}
                  onChange={(e) => setGroupName(e.target.value)}
                  placeholder={t("group.namePlaceholder", "Ex: Clube Padel SP")}
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {t("group.description", "Descrição (opcional)")}
                </label>
                <textarea
                  value={groupDescription}
                  onChange={(e) => setGroupDescription(e.target.value)}
                  placeholder={t("group.descriptionPlaceholder", "Ex: Grupo de amigos que jogam toda terça")}
                  rows={3}
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500 resize-none"
                />
              </div>

              {error && (
                <div className="bg-red-50 rounded-lg p-3 text-red-700 text-sm">{error}</div>
              )}

              <button
                type="submit"
                disabled={createGroup.isPending || !groupName.trim()}
                className="w-full py-3 bg-primary-600 text-white rounded-xl font-medium disabled:opacity-50"
              >
                {createGroup.isPending ? t("app.loading") : t("app.create")}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
