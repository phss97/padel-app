import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { supabase } from "../lib/supabase";
import { ArrowLeft, Users, Trash2, AlertTriangle } from "lucide-react";
import type { Group } from "../types";

export default function GroupSettings() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

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

  if (!id) return null;
  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600" />
      </div>
    );
  }

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
        {/* Group Info */}
        <div className="bg-white rounded-xl border border-gray-100 p-4 space-y-3">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-primary-100 rounded-xl flex items-center justify-center">
              <Users className="w-6 h-6 text-primary-600" />
            </div>
            <div>
              <p className="font-semibold text-gray-900">{group?.name}</p>
              <p className="text-sm text-gray-500">{group?.description || t("group.noDescription")}</p>
            </div>
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
