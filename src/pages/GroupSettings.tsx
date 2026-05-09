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
  Calendar,
} from "lucide-react";
import type { Group, Venue, RecurringMatch, RecurrenceType } from "../types";
import { LoadingSpinner } from "../components/LoadingSpinner";

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
  const [hasHydrated, setHasHydrated] = useState(false);

  const [newRecurring, setNewRecurring] = useState({
    venue_id: "",
    day_of_week: 1,
    start_time_template: "19:00",
    duration_hours: 1,
    recurrence_type: "indefinite" as RecurrenceType,
    recurrence_count: undefined as number | undefined,
    court_cost: undefined as number | undefined,
  });
  const [recurringMessage, setRecurringMessage] = useState("");
  const [showDeleteRecurringConfirm, setShowDeleteRecurringConfirm] = useState<
    string | null
  >(null);

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
    if (group && !hasHydrated) {
      setEditName(group.name || "");
      setEditDescription(group.description || "");
      setEditDefaultVenueId(group.default_venue_id || "");
      setEditMax1h(group.max_players_1h || 4);
      setEditMax2h(group.max_players_2h || 6);
      setEditMax3h(group.max_players_3h_plus || 8);
      setHasHydrated(true);
    }
  }, [group, hasHydrated]);

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

  const { data: recurringMatches } = useQuery<RecurringMatch[]>({
    queryKey: ["recurring-matches", id],
    queryFn: async () => {
      if (!id) return [];
      const { data, error } = await supabase
        .from("recurring_matches")
        .select("*")
        .eq("group_id", id);
      if (error) throw error;
      return (data || []) as RecurringMatch[];
    },
    enabled: !!id,
  });

  const createRecurring = useMutation({
    mutationFn: async () => {
      if (!id) throw new Error("No group ID");
      const { error } = await supabase.from("recurring_matches").insert({
        group_id: id,
        venue_id: newRecurring.venue_id,
        day_of_week: newRecurring.day_of_week,
        start_time_template: newRecurring.start_time_template,
        duration_hours: newRecurring.duration_hours,
        recurrence_type: newRecurring.recurrence_type,
        recurrence_count: newRecurring.recurrence_count,
        court_cost: newRecurring.court_cost,
        created_by: user?.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["recurring-matches", id] });
      setRecurringMessage(t("recurring.createSuccess"));
      setNewRecurring({
        venue_id: "",
        day_of_week: 1,
        start_time_template: "19:00",
        duration_hours: 1,
        recurrence_type: "indefinite",
        recurrence_count: undefined,
        court_cost: undefined,
      });
      setTimeout(() => setRecurringMessage(""), 2000);
    },
    onError: () => {
      setRecurringMessage(t("recurring.createError"));
    },
  });

  const deleteRecurring = useMutation({
    mutationFn: async (recurringId: string) => {
      const { error } = await supabase.rpc("delete_recurring_with_matches", {
        p_recurring_match_id: recurringId,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["recurring-matches", id] });
      queryClient.invalidateQueries({ queryKey: ["group-matches", id] });
      setShowDeleteRecurringConfirm(null);
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
      <div className="min-h-screen bg-background flex items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  const isAdmin = members?.some(
    (m) => m.user_id === user?.id && m.role === "admin"
  );

  return (
    <div className="min-h-screen bg-background">
      <div className="bg-surface border-b border-border sticky top-0 z-10">
        <div className="flex items-center gap-3 p-4">
          <button
            onClick={() => navigate(-1)}
            className="p-2 -ml-2 hover:bg-muted rounded-lg"
          >
            <ArrowLeft className="w-5 h-5 text-muted-foreground" />
          </button>
          <h1 className="text-lg font-semibold text-foreground">
            {t("group.settings", "Configurações")}
          </h1>
        </div>
      </div>

      <div className="p-4 space-y-6">
        {/* Group Info Edit */}
        <div className="bg-surface rounded-xl border border-border p-4 space-y-4">
          <h2 className="text-base font-semibold text-foreground">
            {t("group.info", "Informações do grupo")}
          </h2>
          <div className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-muted-foreground mb-1">
                {t("group.name", "Nome do grupo")}
              </label>
              <input
                type="text"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                className="w-full px-4 py-2.5 bg-background border border-border rounded-xl text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-muted-foreground mb-1">
                {t("group.description", "Descrição")}
              </label>
              <textarea
                value={editDescription}
                onChange={(e) => setEditDescription(e.target.value)}
                rows={2}
                className="w-full px-4 py-2.5 bg-background border border-border rounded-xl text-foreground focus:outline-none focus:ring-2 focus:ring-primary resize-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-muted-foreground mb-1">
                {t("group.defaultVenue", "Quadra padrão")}
              </label>
              <div className="relative">
                <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                <select
                  value={editDefaultVenueId}
                  onChange={(e) => setEditDefaultVenueId(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 bg-background border border-border rounded-xl text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
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
                <label className="block text-xs font-medium text-muted-foreground mb-1">
                  {t("group.max1h", "Max 1h")}
                </label>
                <input
                  type="number"
                  min={2}
                  value={editMax1h}
                  onChange={(e) => setEditMax1h(parseInt(e.target.value) || 4)}
                  className="w-full px-3 py-2 bg-background border border-border rounded-xl text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">
                  {t("group.max2h", "Max 2h")}
                </label>
                <input
                  type="number"
                  min={2}
                  value={editMax2h}
                  onChange={(e) => setEditMax2h(parseInt(e.target.value) || 6)}
                  className="w-full px-3 py-2 bg-background border border-border rounded-xl text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">
                  {t("group.max3h", "Max 3h+")}
                </label>
                <input
                  type="number"
                  min={2}
                  value={editMax3h}
                  onChange={(e) => setEditMax3h(parseInt(e.target.value) || 8)}
                  className="w-full px-3 py-2 bg-background border border-border rounded-xl text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
            </div>
            <button
              onClick={() => {
                if (
                  editName.trim() === (group?.name || "") &&
                  editDescription.trim() === (group?.description || "") &&
                  editDefaultVenueId === (group?.default_venue_id || "") &&
                  editMax1h === (group?.max_players_1h || 4) &&
                  editMax2h === (group?.max_players_2h || 6) &&
                  editMax3h === (group?.max_players_3h_plus || 8)
                ) {
                  return;
                }
                updateGroup.mutate();
              }}
              disabled={updateGroup.isPending}
              className="w-full py-2.5 bg-primary text-white rounded-xl font-medium disabled:opacity-50 hover:bg-primary/90 transition-colors flex items-center justify-center gap-2"
            >
              <Save className="w-4 h-4" />
              {updateGroup.isPending ? t("app.loading") : t("app.save")}
            </button>
            {saveMessage && (
              <p className="text-sm text-green-500 text-center">{saveMessage}</p>
            )}
          </div>
        </div>

        {/* Recurring Matches */}
        <div className="bg-surface rounded-xl border border-border p-4 space-y-4">
          <h2 className="text-base font-semibold text-foreground flex items-center gap-2">
            <Calendar className="w-5 h-5 text-primary" />
            {t("recurring.title")}
          </h2>

          {isAdmin ? (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1">
                    {t("recurring.dayOfWeek")}
                  </label>
                  <select
                    value={newRecurring.day_of_week}
                    onChange={(e) =>
                      setNewRecurring((r) => ({
                        ...r,
                        day_of_week: parseInt(e.target.value),
                      }))
                    }
                    className="w-full px-3 py-2 bg-background border border-border rounded-xl text-foreground focus:outline-none focus:ring-2 focus:ring-primary text-sm"
                  >
                    <option value={0}>{t("recurring.sun")}</option>
                    <option value={1}>{t("recurring.mon")}</option>
                    <option value={2}>{t("recurring.tue")}</option>
                    <option value={3}>{t("recurring.wed")}</option>
                    <option value={4}>{t("recurring.thu")}</option>
                    <option value={5}>{t("recurring.fri")}</option>
                    <option value={6}>{t("recurring.sat")}</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1">
                    {t("recurring.time")}
                  </label>
                  <input
                    type="time"
                    value={newRecurring.start_time_template}
                    onChange={(e) =>
                      setNewRecurring((r) => ({
                        ...r,
                        start_time_template: e.target.value,
                      }))
                    }
                    className="w-full px-3 py-2 bg-background border border-border rounded-xl text-foreground focus:outline-none focus:ring-2 focus:ring-primary text-sm"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1">
                    {t("recurring.duration")}
                  </label>
                  <input
                    type="number"
                    min={1}
                    value={newRecurring.duration_hours}
                    onChange={(e) =>
                      setNewRecurring((r) => ({
                        ...r,
                        duration_hours: parseInt(e.target.value) || 1,
                      }))
                    }
                    className="w-full px-3 py-2 bg-background border border-border rounded-xl text-foreground focus:outline-none focus:ring-2 focus:ring-primary text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1">
                    {t("recurring.venue")}
                  </label>
                  <select
                    value={newRecurring.venue_id}
                    onChange={(e) =>
                      setNewRecurring((r) => ({
                        ...r,
                        venue_id: e.target.value,
                      }))
                    }
                    className="w-full px-3 py-2 bg-background border border-border rounded-xl text-foreground focus:outline-none focus:ring-2 focus:ring-primary text-sm"
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
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1">
                    {t("recurring.cost")}
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min={0}
                    value={newRecurring.court_cost || ""}
                    onChange={(e) =>
                      setNewRecurring((r) => ({
                        ...r,
                        court_cost: e.target.value
                          ? parseFloat(e.target.value)
                          : undefined,
                      }))
                    }
                    className="w-full px-3 py-2 bg-background border border-border rounded-xl text-foreground focus:outline-none focus:ring-2 focus:ring-primary text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1">
                    {t("recurring.type")}
                  </label>
                  <select
                    value={newRecurring.recurrence_type}
                    onChange={(e) =>
                      setNewRecurring((r) => ({
                        ...r,
                        recurrence_type: e.target.value as RecurrenceType,
                        recurrence_count:
                          e.target.value === "indefinite"
                            ? undefined
                            : r.recurrence_count,
                      }))
                    }
                    className="w-full px-3 py-2 bg-background border border-border rounded-xl text-foreground focus:outline-none focus:ring-2 focus:ring-primary text-sm"
                  >
                    <option value="indefinite">
                      {t("recurring.indefinite")}
                    </option>
                    <option value="count">{t("recurring.count")}</option>
                  </select>
                </div>
              </div>
              {newRecurring.recurrence_type === "count" && (
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1">
                    {t("recurring.countLabel")}
                  </label>
                  <input
                    type="number"
                    min={1}
                    value={newRecurring.recurrence_count || 1}
                    onChange={(e) =>
                      setNewRecurring((r) => ({
                        ...r,
                        recurrence_count: parseInt(e.target.value) || 1,
                      }))
                    }
                    className="w-full px-3 py-2 bg-background border border-border rounded-xl text-foreground focus:outline-none focus:ring-2 focus:ring-primary text-sm"
                  />
                </div>
              )}
              <button
                onClick={() => createRecurring.mutate()}
                disabled={createRecurring.isPending}
                className="w-full py-2.5 bg-primary text-white rounded-xl font-medium disabled:opacity-50 hover:bg-primary/90 transition-colors flex items-center justify-center gap-2"
              >
                <Calendar className="w-4 h-4" />
                {createRecurring.isPending
                  ? t("app.loading")
                  : t("recurring.create")}
              </button>
              {recurringMessage && (
                <p className="text-sm text-green-500 text-center">
                  {recurringMessage}
                </p>
              )}
            </div>
          ) : null}

          <div className="space-y-2">
            {recurringMatches?.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-2">
                {t("recurring.noTemplates")}
              </p>
            ) : (
              recurringMatches?.map((r) => (
                <div
                  key={r.id}
                  className="flex items-center gap-3 p-3 bg-background rounded-xl"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground">
                      {[
                        t("recurring.sun"),
                        t("recurring.mon"),
                        t("recurring.tue"),
                        t("recurring.wed"),
                        t("recurring.thu"),
                        t("recurring.fri"),
                        t("recurring.sat"),
                      ][r.day_of_week]}{" "}
                      {r.start_time_template?.slice(0, 5)} · {r.duration_hours}h{" "}
                      {r.court_cost ? `· R$ ${Number(r.court_cost).toFixed(2)}` : ""}
                    </p>
                    <p className="text-xs text-muted-foreground truncate">
                      {r.recurrence_type === "indefinite"
                        ? t("recurring.indefinite")
                        : `${r.recurrence_count}x`}{" "}
                      · {venues?.find((v) => v.id === r.venue_id)?.name}
                    </p>
                  </div>
                  {isAdmin && (
                    <button
                      onClick={() =>
                        setShowDeleteRecurringConfirm((prev) =>
                          prev === r.id ? null : r.id
                        )
                      }
                      title={t("recurring.delete")}
                      className="p-2 hover:bg-destructive/10 rounded-lg transition-colors"
                    >
                      <Trash2 className="w-4 h-4 text-red-500" />
                    </button>
                  )}
                  {showDeleteRecurringConfirm === r.id && (
                    <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center">
                      <div className="bg-surface rounded-t-2xl sm:rounded-2xl w-full max-w-md p-6 space-y-4 my-auto sm:my-0">
                        <p className="text-sm text-destructive font-medium">
                          {t("recurring.deleteConfirm")}
                        </p>
                        <div className="flex gap-3">
                          <button
                            onClick={() => deleteRecurring.mutate(r.id)}
                            disabled={deleteRecurring.isPending}
                            className="flex-1 py-3 bg-destructive text-white rounded-xl font-medium disabled:opacity-50 hover:bg-destructive/90 transition-colors"
                          >
                            {deleteRecurring.isPending
                              ? t("app.loading")
                              : t("recurring.deleteMatches")}
                          </button>
                          <button
                            onClick={() => setShowDeleteRecurringConfirm(null)}
                            className="flex-1 py-3 bg-muted text-muted-foreground rounded-xl font-medium hover:bg-muted/80 transition-colors"
                          >
                            {t("app.cancel")}
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>

        {/* Members */}
        <div className="bg-surface rounded-xl border border-border p-4 space-y-4">
          <h2 className="text-base font-semibold text-foreground flex items-center gap-2">
            <Users className="w-5 h-5 text-primary" />
            {t("group.members", "Membros")} ({members?.length || 0})
          </h2>
          <div className="space-y-2">
            {members?.map((member) => (
              <div
                key={member.id}
                className="flex items-center gap-3 p-3 bg-background rounded-xl"
              >
                <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center flex-shrink-0">
                  <Users className="w-5 h-5 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-foreground truncate">
                    {member.profile?.name || member.user_id}
                  </p>
                  <p className="text-xs text-muted-foreground">
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
                      className="p-2 hover:bg-muted/80 rounded-lg transition-colors"
                      title={
                        member.role === "admin"
                          ? t("group.demote", "Rebaixar")
                          : t("group.promote", "Promover")
                      }
                    >
                      <Shield
                        className={`w-4 h-4 ${
                          member.role === "admin"
                            ? "text-muted-foreground"
                            : "text-primary"
                        }`}
                      />
                    </button>
                    <button
                      onClick={() => removeMember.mutate(member.id)}
                      disabled={removeMember.isPending}
                      className="p-2 hover:bg-destructive/10 rounded-lg transition-colors"
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
        <div className="bg-surface rounded-xl border border-red-100 p-4 space-y-3">
          <h3 className="text-sm font-medium text-destructive flex items-center gap-2">
            <AlertTriangle className="w-4 h-4" />
            {t("group.dangerZone", "Zona de perigo")}
          </h3>
          <p className="text-sm text-muted-foreground">
            {t(
              "group.deleteWarning",
              "Desativar o grupo remove-o da lista. Os dados históricos são preservados."
            )}
          </p>
          {!showDeleteConfirm ? (
            <button
              onClick={() => setShowDeleteConfirm(true)}
              className="w-full py-3 border border-destructive/20 text-destructive rounded-xl font-medium hover:bg-destructive/10 transition-colors flex items-center justify-center gap-2"
            >
              <Trash2 className="w-4 h-4" />
              {t("group.deactivate", "Desativar grupo")}
            </button>
          ) : (
            <div className="space-y-3">
              <p className="text-sm text-destructive font-medium">
                {t("group.confirmDeactivate", "Tem certeza? Esta ação não pode ser desfeita.")}
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => softDeleteGroup.mutate()}
                  disabled={softDeleteGroup.isPending}
                  className="flex-1 py-3 bg-destructive text-white rounded-xl font-medium disabled:opacity-50 hover:bg-destructive/90 transition-colors"
                >
                  {softDeleteGroup.isPending
                    ? t("app.loading")
                    : t("group.confirm", "Sim, desativar")}
                </button>
                <button
                  onClick={() => setShowDeleteConfirm(false)}
                  className="flex-1 py-3 bg-muted text-muted-foreground rounded-xl font-medium hover:bg-muted/80 transition-colors"
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
