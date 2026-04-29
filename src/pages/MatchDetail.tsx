import { useState, useEffect, useMemo } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { supabase } from "../lib/supabase";
import { useAuthStore } from "../stores/authStore";
import {
  ArrowLeft,
  Calendar,
  Clock,
  MapPin,
  Users,
  CheckCircle,
  Plus,
  AlertTriangle,
  DollarSign,
  Trash2,
  Pencil,
} from "lucide-react";
import type { Match, Profile, Group, MatchPayment } from "../types";
import { LoadingSpinner } from "../components/LoadingSpinner";
import { formatMatchLongDate, formatMatchTime, toDateInputValue, toTimeInputValue } from "../lib/dateUtils";

interface MatchPlayerWithProfile {
  id: string;
  user_id: string;
  status: string;
  joined_at: string;
  waitlist_position?: number;
  profile: Profile;
}

export default function MatchDetail() {
  const { id: matchId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const { t, i18n } = useTranslation();
  const queryClient = useQueryClient();
  const user = useAuthStore((state) => state.user);
  const [error, setError] = useState("");
  const [selectedNewOwner, setSelectedNewOwner] = useState<string>("");

  // Extend modal states
  const [showExtendModal, setShowExtendModal] = useState(false);
  const [extendDirection, setExtendDirection] = useState<"after" | "before">("after");
  const [extendHours, setExtendHours] = useState(1);
  const [extendJoinMatch, setExtendJoinMatch] = useState(false);

  // Delete modal
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  // Forfeit transfer modal
  const [showForfeitModal, setShowForfeitModal] = useState(false);

  // Edit match modal
  const [showEditModal, setShowEditModal] = useState(false);
  const [editStartDate, setEditStartDate] = useState("");
  const [editStartTime, setEditStartTime] = useState("");
  const [editEndDate, setEditEndDate] = useState("");
  const [editEndTime, setEditEndTime] = useState("");
  const [editMaxPlayers, setEditMaxPlayers] = useState(4);

  // Kick modal
  const [showKickModal, setShowKickModal] = useState(false);
  const [playersToKick, setPlayersToKick] = useState<Set<string>>(new Set());
  const [isKicking, setIsKicking] = useState(false);
  const [hasHydratedEdit, setHasHydratedEdit] = useState(false);

  const { data: match } = useQuery<Match & { group: Group; venue: { name: string } }>({
    queryKey: ["match", matchId],
    queryFn: async () => {
      if (!matchId) throw new Error("No match ID");
      const { data, error } = await supabase
        .from("matches")
        .select("*, group:groups(*), venue:venues(name)")
        .eq("id", matchId)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!matchId,
  });

  const { data: players } = useQuery<MatchPlayerWithProfile[]>({
    queryKey: ["match-players", matchId],
    queryFn: async () => {
      if (!matchId) return [];
      const { data, error } = await supabase
        .from("match_players")
        .select("*, profile:profiles(*)")
        .eq("match_id", matchId)
        .in("status", ["confirmed", "waitlist"]);
      if (error) throw error;
      return (data || []) as MatchPlayerWithProfile[];
    },
    enabled: !!matchId,
  });

  useEffect(() => {
    if (match && !hasHydratedEdit) {
      setEditStartDate(toDateInputValue(match.start_time));
      setEditStartTime(toTimeInputValue(match.start_time));
      setEditEndDate(toDateInputValue(match.end_time));
      setEditEndTime(toTimeInputValue(match.end_time));
      setEditMaxPlayers(match.max_players);
      setHasHydratedEdit(true);
    }
  }, [match, hasHydratedEdit]);

  const { data: payments } = useQuery<MatchPayment[]>({
    queryKey: ["match-payments", matchId],
    queryFn: async () => {
      if (!matchId) return [];
      const { data, error } = await supabase
        .from("match_payments")
        .select("*")
        .eq("match_id", matchId);
      if (error) throw error;
      return (data || []) as MatchPayment[];
    },
    enabled: !!matchId,
  });

  const confirmedPlayers = useMemo(() => players?.filter((p) => p.status === "confirmed") || [], [players]);
  const waitlistedPlayers = useMemo(() => players?.filter((p) => p.status === "waitlist") || [], [players]);
  const isOwner = useMemo(() => match?.created_by === user?.id, [match, user]);
  const isFull = useMemo(() => confirmedPlayers.length >= (match?.max_players || 0), [confirmedPlayers, match]);
  const isPlayer = useMemo(() => players?.some((p) => p.user_id === user?.id && p.status === "confirmed"), [players, user]);
  const isWaitlisted = useMemo(() => players?.some((p) => p.user_id === user?.id && p.status === "waitlist"), [players, user]);
  const paidUserIds = useMemo(() => new Set((payments || []).map((p) => p.user_id)), [payments]);

  const checkInMutation = useMutation({
    mutationFn: async () => {
      if (!matchId || !user) throw new Error("Missing data");
      const { data, error } = await supabase.rpc("check_in_match", {
        p_match_id: matchId,
        p_user_id: user.id,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["match-players", matchId] });
      queryClient.invalidateQueries({ queryKey: ["group-matches", match?.group_id] });
      queryClient.invalidateQueries({ queryKey: ["my-matches"] });
      queryClient.invalidateQueries({ queryKey: ["upcoming-matches"] });
      queryClient.invalidateQueries({ queryKey: ["my-group-matches", match?.group_id] });
      setError("");
    },
    onError: (err: Error) => setError(err.message),
  });

  const forfeitMutation = useMutation({
    mutationFn: async () => {
      if (!matchId || !user) throw new Error("Missing data");
      const { data, error } = await supabase.rpc("forfeit_match", {
        p_match_id: matchId,
        p_user_id: user.id,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["match-players", matchId] });
      queryClient.invalidateQueries({ queryKey: ["group-matches", match?.group_id] });
      queryClient.invalidateQueries({ queryKey: ["match", matchId] });
      queryClient.invalidateQueries({ queryKey: ["my-matches"] });
      queryClient.invalidateQueries({ queryKey: ["upcoming-matches"] });
      queryClient.invalidateQueries({ queryKey: ["my-group-matches", match?.group_id] });
      setShowForfeitModal(false);
      setError("");
    },
    onError: (err: Error) => setError(err.message),
  });

  const transferOwnershipMutation = useMutation({
    mutationFn: async (newOwnerId: string) => {
      if (!matchId) throw new Error("No match ID");
      const { error } = await supabase
        .from("matches")
        .update({ created_by: newOwnerId })
        .eq("id", matchId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["match", matchId] });
      setError("");
    },
    onError: (err: Error) => setError(err.message),
  });

  const extendMutation = useMutation({
    mutationFn: async () => {
      if (!matchId || !match) throw new Error("No match");
      const { data, error } = await supabase.rpc("extend_match", {
        p_match_id: matchId,
        p_hours: extendHours,
        p_direction: extendDirection,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: async () => {
      queryClient.invalidateQueries({ queryKey: ["match", matchId] });
      queryClient.invalidateQueries({ queryKey: ["match-players", matchId] });
      queryClient.invalidateQueries({ queryKey: ["group-matches", match?.group_id] });
      queryClient.invalidateQueries({ queryKey: ["my-matches"] });
      queryClient.invalidateQueries({ queryKey: ["upcoming-matches"] });
      queryClient.invalidateQueries({ queryKey: ["my-group-matches", match?.group_id] });
      if (extendJoinMatch && user && !isPlayer && !isWaitlisted) {
        await supabase.rpc("check_in_match", {
          p_match_id: matchId,
          p_user_id: user.id,
        });
      }
      setShowExtendModal(false);
      setError("");
    },
    onError: (err: Error) => setError(err.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      if (!matchId) throw new Error("No match ID");
      const { error } = await supabase.from("matches").delete().eq("id", matchId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["group-matches", match?.group_id] });
      navigate(`/groups/${match?.group_id}`);
    },
    onError: (err: Error) => setError(err.message),
  });

  const updateMatchMutation = useMutation({
    mutationFn: async () => {
      if (!matchId || !match) throw new Error("No match");
      const start = new Date(`${editStartDate}T${editStartTime}`);
      const end = new Date(`${editEndDate}T${editEndTime}`);
      if (end <= start) throw new Error("End time must be after start time");

      const { error } = await supabase
        .from("matches")
        .update({
          start_time: start.toISOString(),
          end_time: end.toISOString(),
          max_players: editMaxPlayers,
        })
        .eq("id", matchId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["match", matchId] });
      queryClient.invalidateQueries({ queryKey: ["group-matches", match?.group_id] });
      setShowEditModal(false);
      setError("");
    },
    onError: (err: Error) => setError(err.message),
  });

  const togglePaymentMutation = useMutation({
    mutationFn: async ({
      userId,
      isPaid,
      amount,
      pixKey,
    }: {
      userId: string;
      isPaid: boolean;
      amount: number;
      pixKey?: string;
    }) => {
      if (!matchId) throw new Error("No match ID");
      if (isPaid) {
        const { error } = await supabase
          .from("match_payments")
          .delete()
          .eq("match_id", matchId)
          .eq("user_id", userId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("match_payments").insert({
          match_id: matchId,
          user_id: userId,
          amount,
          pix_key_used: pixKey || null,
        });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["match-payments", matchId] });
      setError("");
    },
    onError: (err: Error) => setError(err.message),
  });

  const handleUpdateMatch = () => {
    const newMax = editMaxPlayers;
    const confirmedCount = confirmedPlayers.length;
    if (newMax < confirmedCount) {
      setPlayersToKick(new Set());
      setShowKickModal(true);
    } else {
      updateMatchMutation.mutate();
    }
  };

  const handleKickConfirm = async () => {
    if (!matchId || !match) return;
    setIsKicking(true);
    try {
      const userIdsToKick = Array.from(playersToKick);
      const remainingPlayers = confirmedPlayers.filter(
        (p) => !userIdsToKick.includes(p.user_id)
      );

      if (
        isOwner &&
        userIdsToKick.includes(user?.id || "") &&
        remainingPlayers.length === 0
      ) {
        const { error } = await supabase
          .from("matches")
          .delete()
          .eq("id", matchId);
        if (error) throw error;
        queryClient.invalidateQueries({
          queryKey: ["group-matches", match.group_id],
        });
        navigate(`/groups/${match.group_id}`);
        return;
      }

      const start = new Date(`${editStartDate}T${editStartTime}`);
      const end = new Date(`${editEndDate}T${editEndTime}`);
      if (end <= start) throw new Error("End time must be after start time");

      const ownershipPromise =
        isOwner && userIdsToKick.includes(user?.id || "")
          ? supabase
              .from("matches")
              .update({ created_by: remainingPlayers[0].user_id })
              .eq("id", matchId)
          : Promise.resolve(null);

      const [cancelResult, matchUpdateResult] = await Promise.all([
        supabase
          .from("match_players")
          .update({ status: "cancelled" })
          .eq("match_id", matchId)
          .in("user_id", userIdsToKick),
        supabase
          .from("matches")
          .update({
            start_time: start.toISOString(),
            end_time: end.toISOString(),
            max_players: editMaxPlayers,
          })
          .eq("id", matchId),
      ]);

      const ownershipResult = await ownershipPromise;

      if (cancelResult.error) throw cancelResult.error;
      if (matchUpdateResult.error) throw matchUpdateResult.error;
      if (ownershipResult && (ownershipResult as { error?: Error }).error)
        throw (ownershipResult as { error: Error }).error;

      queryClient.invalidateQueries({ queryKey: ["match", matchId] });
      queryClient.invalidateQueries({ queryKey: ["match-players", matchId] });
      queryClient.invalidateQueries({
        queryKey: ["group-matches", match.group_id],
      });
      setShowKickModal(false);
      setShowEditModal(false);
      setPlayersToKick(new Set());
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setIsKicking(false);
    }
  };

  const handleForfeit = () => {
    if (isOwner && confirmedPlayers.length > 1) {
      setShowForfeitModal(true);
    } else if (isOwner && confirmedPlayers.length <= 1) {
      // Owner is the only player - auto-delete match
      deleteMutation.mutate();
    } else {
      forfeitMutation.mutate();
    }
  };

  const handleTransferAndForfeit = () => {
    if (selectedNewOwner) {
      transferOwnershipMutation.mutate(selectedNewOwner, {
        onSuccess: () => {
          forfeitMutation.mutate();
        },
      });
    }
  };

  if (!match) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <LoadingSpinner size="sm" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="bg-surface border-b border-border">
        <div className="flex items-center gap-3 p-4">
          <button
            onClick={() =>
              navigate(
                (location.state as { from?: string } | null)?.from ||
                  `/groups/${match.group_id}`
              )
            }
            className="p-2 -ml-2 hover:bg-muted rounded-lg"
          >
            <ArrowLeft className="w-5 h-5 text-muted-foreground" />
          </button>
          <div className="flex-1 min-w-0">
            <h1 className="text-lg font-semibold text-foreground truncate">
              {t("match.details", "Detalhes da partida")}
            </h1>
          </div>
          <div className="flex items-center gap-1">
            {isOwner && (
              <>
                <button
                  onClick={() => setShowEditModal(true)}
                  className="p-2 hover:bg-muted rounded-lg"
                >
                  <Pencil className="w-5 h-5 text-muted-foreground" />
                </button>
                <button
                  onClick={() => setShowDeleteModal(true)}
                  className="p-2 hover:bg-destructive/10 rounded-lg"
                >
                  <Trash2 className="w-5 h-5 text-destructive" />
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Match Info */}
      <div className="bg-surface border-b border-border p-4 space-y-3">
        <div className="flex items-center gap-3">
          <Calendar className="w-5 h-5 text-primary" />
          <span className="text-foreground font-medium">
            {formatMatchLongDate(match.start_time, i18n.language)}
          </span>
        </div>
        <div className="flex items-center gap-3">
          <Clock className="w-5 h-5 text-primary" />
          <span className="text-foreground">
            {formatMatchTime(match.start_time, i18n.language)} - {formatMatchTime(match.end_time, i18n.language)}
          </span>
        </div>
        <div className="flex items-center gap-3">
          <MapPin className="w-5 h-5 text-primary" />
          <span className="text-foreground">{match.venue?.name}</span>
        </div>
        {match.court_cost && (
          <div className="flex items-center gap-3">
            <span className="text-primary font-bold">R$</span>
            <span className="text-foreground">
              {match.court_cost.toFixed(2)} {t("match.perPerson", "por pessoa")}
            </span>
          </div>
        )}
      </div>

      {/* Players Section */}
      <div className="p-4 space-y-6">
        {/* Confirmed Players */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-foreground">
              {t("match.players")}
            </h2>
            <span
              className={`text-sm font-medium ${
                isFull ? "text-destructive" : "text-green-600"
              }`}
            >
              {confirmedPlayers.length}/{match.max_players}{" "}
              {confirmedPlayers.length === 1
                ? t("match.spotAvailable")
                : t("match.spotsAvailable")}
            </span>
          </div>

          <div className="space-y-2">
            {confirmedPlayers.map((player) => (
              <div
                key={player.id}
                className="flex items-center gap-3 p-3 bg-surface rounded-xl border border-border"
              >
                <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center">
                  <Users className="w-5 h-5 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-foreground truncate">
                    {player.profile.name || player.profile.id}
                  </p>
                  {player.user_id === match.created_by && (
                    <p className="text-xs text-primary font-medium">
                      {t("match.owner")}
                    </p>
                  )}
                </div>
                {player.user_id === user?.id && (
                  <CheckCircle className="w-5 h-5 text-green-500" />
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Waitlist */}
        {waitlistedPlayers.length > 0 && (
          <div className="space-y-3">
            <h2 className="text-lg font-semibold text-foreground">
              {t("match.waitlist")}
            </h2>
            <div className="space-y-2">
              {[...waitlistedPlayers]
                .sort((a, b) => (a.waitlist_position || 0) - (b.waitlist_position || 0))
                .map((player, index) => (
                  <div
                    key={player.id}
                    className="flex items-center gap-3 p-3 bg-amber-500/10 rounded-xl border border-amber-100"
                  >
                    <div className="w-8 h-8 bg-amber-500/10 rounded-full flex items-center justify-center text-amber-500 font-bold text-sm">
                      {index + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-foreground truncate">
                        {player.profile.name || player.profile.id}
                      </p>
                    </div>
                    {player.user_id === user?.id && (
                      <span className="text-xs text-amber-500 font-medium">
                        {t("match.you", "Você")}
                      </span>
                    )}
                  </div>
                ))}
            </div>
          </div>
        )}

        {/* Payments */}
        {match.court_cost != null && match.court_cost > 0 && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
                <DollarSign className="w-5 h-5 text-primary" />
                {t("match.payments")}
              </h2>
              <span className="text-sm font-medium text-muted-foreground">
                {t("match.totalCollected", "Total arrecadado")}: R${" "}
                {payments
                  ?.reduce((sum, p) => sum + (p.amount || 0), 0)
                  .toFixed(2)}{" "}
                / R${" "}
                {(match.court_cost * confirmedPlayers.length).toFixed(2)}
              </span>
            </div>

            <div className="space-y-2">
              {confirmedPlayers.map((player) => {
                const isPaid = paidUserIds.has(player.user_id);
                const canToggle =
                  isOwner || player.user_id === user?.id;
                return (
                  <div
                    key={player.id}
                    className="flex items-center gap-3 p-3 bg-surface rounded-xl border border-border"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-foreground truncate">
                        {player.profile.name || player.profile.id}
                      </p>
                      {player.profile.pix_key ? (
                        <p className="text-xs text-muted-foreground truncate">
                          {t("match.pixKey")}: {player.profile.pix_key}
                        </p>
                      ) : (
                        <p className="text-xs text-muted-foreground/70 italic">
                          {t("match.pixKey")}: —
                        </p>
                      )}
                    </div>
                    {canToggle && (
                      <button
                        onClick={() =>
                          togglePaymentMutation.mutate({
                            userId: player.user_id,
                            isPaid: !!isPaid,
                            amount: match.court_cost || 0,
                            pixKey: player.profile.pix_key,
                          })
                        }
                        disabled={togglePaymentMutation.isPending}
                        className={`px-3 py-1.5 rounded-lg text-sm font-semibold transition-colors disabled:opacity-50 ${
                          isPaid
                            ? "bg-green-500/10 text-green-500"
                            : "bg-muted text-muted-foreground hover:bg-muted/80"
                        }`}
                      >
                        {isPaid
                          ? t("match.paid")
                          : t("match.markAsPaid")}
                      </button>
                    )}
                    {!canToggle && isPaid && (
                      <span className="text-sm font-semibold text-green-500 bg-green-500/10 px-3 py-1.5 rounded-lg">
                        {t("match.paid")}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="bg-destructive/10 rounded-lg p-3 text-destructive text-sm text-center">
            {error}
          </div>
        )}

        {/* Action Buttons */}
        <div className="space-y-3">
          {!isPlayer && !isWaitlisted && !isFull && (
            <button
              onClick={() => checkInMutation.mutate()}
              disabled={checkInMutation.isPending}
              className="w-full py-3.5 bg-primary text-white rounded-xl font-semibold disabled:opacity-50 hover:bg-primary/90 transition-colors"
            >
              {checkInMutation.isPending
                ? t("app.loading")
                : t("match.checkIn")}
            </button>
          )}

          {!isPlayer && !isWaitlisted && isFull && (
            <button
              onClick={() => checkInMutation.mutate()}
              disabled={checkInMutation.isPending}
              className="w-full py-3.5 bg-amber-500/100 text-white rounded-xl font-semibold disabled:opacity-50 hover:bg-amber-600 transition-colors"
            >
              {checkInMutation.isPending
                ? t("app.loading")
                : t("match.joinWaitlist", "Entrar na lista de espera")}
            </button>
          )}

          {(isPlayer || isWaitlisted) && (
            <button
              onClick={handleForfeit}
              disabled={forfeitMutation.isPending || deleteMutation.isPending}
              className="w-full py-3.5 border-2 border-red-200 text-destructive rounded-xl font-semibold disabled:opacity-50 hover:bg-destructive/10 transition-colors"
            >
              {forfeitMutation.isPending || deleteMutation.isPending
                ? t("app.loading")
                : t("match.forfeit")}
            </button>
          )}

          <button
            onClick={() => setShowExtendModal(true)}
            className="w-full py-3.5 bg-surface border-2 border-primary/20 text-primary rounded-xl font-semibold hover:bg-primary/5 transition-colors flex items-center justify-center gap-2"
          >
            <Plus className="w-5 h-5" />
            {t("match.extend")}
          </button>
        </div>
      </div>

      {/* Extend Match Modal */}
      {showExtendModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center">
          <div className="bg-surface rounded-t-2xl sm:rounded-2xl w-full max-w-md p-6 space-y-4">
            <h2 className="text-lg font-semibold text-foreground">
              {t("match.extend", "Estender partida")}
            </h2>
            {/* Direction */}
            <div className="space-y-2">
              <label className="block text-sm font-medium text-muted-foreground">
                {t("match.extendDirection", "Direção")}
              </label>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { key: "before" as const, label: t("match.extendBefore", "Antes") },
                  { key: "after" as const, label: t("match.extendAfter", "Depois") },
                ].map((d) => (
                  <button
                    key={d.key}
                    onClick={() => setExtendDirection(d.key)}
                    className={`py-3 rounded-xl border-2 font-medium transition-all ${
                      extendDirection === d.key
                        ? "border-primary bg-primary/5 text-primary"
                        : "border-border bg-surface text-muted-foreground hover:border-border"
                    }`}
                  >
                    {d.label}
                  </button>
                ))}
              </div>
            </div>
            {/* Duration */}
            <div className="space-y-2">
              <label className="block text-sm font-medium text-muted-foreground">
                {t("match.duration", "Duração")}
              </label>
              <div className="grid grid-cols-3 gap-3">
                {[1, 2, 3].map((h) => (
                  <button
                    key={h}
                    onClick={() => setExtendHours(h)}
                    className={`py-3 rounded-xl border-2 font-medium transition-all ${
                      extendHours === h
                        ? "border-primary bg-primary/5 text-primary"
                        : "border-border bg-surface text-muted-foreground hover:border-border"
                    }`}
                  >
                    {h}h
                  </button>
                ))}
              </div>
            </div>
            {/* Auto check-in */}
            {!isPlayer && !isWaitlisted && (
              <div className="flex items-center gap-3 p-4 bg-primary/5 rounded-xl">
                <input
                  type="checkbox"
                  id="extendJoinMatch"
                  checked={extendJoinMatch}
                  onChange={(e) => setExtendJoinMatch(e.target.checked)}
                  className="w-5 h-5 text-primary rounded focus:ring-primary"
                />
                <label htmlFor="extendJoinMatch" className="text-sm text-primary-800 cursor-pointer">
                  {t("match.joinAutomatically", "Entrar automaticamente na partida")}
                </label>
              </div>
            )}
            <div className="flex gap-3">
              <button
                onClick={() => setShowExtendModal(false)}
                className="flex-1 py-3 bg-muted text-muted-foreground rounded-xl font-medium"
              >
                {t("app.cancel")}
              </button>
              <button
                onClick={() => extendMutation.mutate()}
                disabled={extendMutation.isPending}
                className="flex-1 py-3 bg-primary text-white rounded-xl font-medium disabled:opacity-50"
              >
                {extendMutation.isPending ? t("app.loading") : t("app.save")}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Forfeit + Transfer Modal */}
      {showForfeitModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center">
          <div className="bg-surface rounded-t-2xl sm:rounded-2xl w-full max-w-md p-6 space-y-4">
            <h2 className="text-lg font-semibold text-foreground">
              {t("match.forfeit", "Desistir da partida")}
            </h2>
            <p className="text-sm text-muted-foreground">
              {t("match.transferBeforeForfeit", "Você é o organizador. Antes de desistir, escolha um novo organizador:")}
            </p>
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {confirmedPlayers
                .filter((p) => p.user_id !== user?.id)
                .map((player) => (
                  <button
                    key={player.id}
                    onClick={() => setSelectedNewOwner(player.user_id)}
                    className={`w-full flex items-center gap-3 p-3 rounded-xl border-2 transition-all ${
                      selectedNewOwner === player.user_id
                        ? "border-primary bg-primary/5"
                        : "border-border hover:border-border"
                    }`}
                  >
                    <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center">
                      <Users className="w-5 h-5 text-primary" />
                    </div>
                    <div className="flex-1 text-left">
                      <p className="font-medium text-foreground">
                        {player.profile.name || player.profile.id}
                      </p>
                    </div>
                    {selectedNewOwner === player.user_id && (
                      <CheckCircle className="w-5 h-5 text-primary" />
                    )}
                  </button>
                ))}
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setShowForfeitModal(false)}
                className="flex-1 py-3 bg-muted text-muted-foreground rounded-xl font-medium"
              >
                {t("app.cancel")}
              </button>
              <button
                onClick={handleTransferAndForfeit}
                disabled={!selectedNewOwner || transferOwnershipMutation.isPending}
                className="flex-1 py-3 bg-destructive text-white rounded-xl font-medium disabled:opacity-50"
              >
                {transferOwnershipMutation.isPending
                  ? t("app.loading")
                  : t("match.forfeit")}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Match Modal */}
      {showEditModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center">
          <div className="bg-surface rounded-t-2xl sm:rounded-2xl w-full max-w-md p-6 space-y-4">
            <h2 className="text-lg font-semibold text-foreground">
              {t("match.editMatch", "Editar Partida")}
            </h2>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="block text-sm font-medium text-muted-foreground">
                    {t("match.date")}
                  </label>
                  <input
                    type="date"
                    value={editStartDate}
                    onChange={(e) => setEditStartDate(e.target.value)}
                    className="w-full px-3 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
                <div className="space-y-1">
                  <label className="block text-sm font-medium text-muted-foreground">
                    {t("match.time")}
                  </label>
                  <input
                    type="time"
                    value={editStartTime}
                    onChange={(e) => setEditStartTime(e.target.value)}
                    className="w-full px-3 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="block text-sm font-medium text-muted-foreground">
                    {t("match.endDate", "End date")}
                  </label>
                  <input
                    type="date"
                    value={editEndDate}
                    onChange={(e) => setEditEndDate(e.target.value)}
                    className="w-full px-3 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
                <div className="space-y-1">
                  <label className="block text-sm font-medium text-muted-foreground">
                    {t("match.endTime", "End time")}
                  </label>
                  <input
                    type="time"
                    value={editEndTime}
                    onChange={(e) => setEditEndTime(e.target.value)}
                    className="w-full px-3 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
              </div>
              <div className="space-y-1">
                <label className="block text-sm font-medium text-muted-foreground">
                  {t("match.maxPlayers", "Máx. jogadores")}
                </label>
                <input
                  type="number"
                  min={2}
                  max={20}
                  value={editMaxPlayers}
                  onChange={(e) => setEditMaxPlayers(parseInt(e.target.value) || 4)}
                  className="w-full px-3 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
            </div>

            {/* Transfer Ownership section inside edit modal */}
            <div className="border-t border-border pt-4 space-y-3">
              <h3 className="text-sm font-medium text-muted-foreground">
                {t("match.transferOwnership", "Transferir partida")}
              </h3>
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {confirmedPlayers
                  .filter((p) => p.user_id !== user?.id)
                  .map((player) => (
                    <button
                      key={player.id}
                      onClick={() => setSelectedNewOwner(player.user_id)}
                      className={`w-full flex items-center gap-3 p-3 rounded-xl border-2 transition-all ${
                        selectedNewOwner === player.user_id
                          ? "border-primary bg-primary/5"
                          : "border-border hover:border-border"
                      }`}
                    >
                      <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center">
                        <Users className="w-5 h-5 text-primary" />
                      </div>
                      <div className="flex-1 text-left">
                        <p className="font-medium text-foreground">
                          {player.profile.name || player.profile.id}
                        </p>
                      </div>
                      {selectedNewOwner === player.user_id && (
                        <CheckCircle className="w-5 h-5 text-primary" />
                      )}
                    </button>
                  ))}
              </div>
              {selectedNewOwner && (
                <button
                  onClick={() => {
                    transferOwnershipMutation.mutate(selectedNewOwner, {
                      onSuccess: () => {
                        setSelectedNewOwner("");
                        setShowEditModal(false);
                      },
                    });
                  }}
                  disabled={transferOwnershipMutation.isPending}
                  className="w-full py-2.5 bg-primary text-white rounded-xl font-medium disabled:opacity-50"
                >
                  {transferOwnershipMutation.isPending
                    ? t("app.loading")
                    : t("app.confirm")}
                </button>
              )}
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowEditModal(false);
                  setSelectedNewOwner("");
                }}
                className="flex-1 py-3 bg-muted text-muted-foreground rounded-xl font-medium"
              >
                {t("app.cancel")}
              </button>
              <button
                onClick={handleUpdateMatch}
                disabled={updateMatchMutation.isPending}
                className="flex-1 py-3 bg-primary text-white rounded-xl font-medium disabled:opacity-50"
              >
                {updateMatchMutation.isPending
                  ? t("app.loading")
                  : t("app.save")}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Kick Players Modal */}
      {showKickModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center">
          <div className="bg-surface rounded-t-2xl sm:rounded-2xl w-full max-w-md p-6 space-y-4">
            <h2 className="text-lg font-semibold text-foreground">
              {t("match.kickPlayers", "Remover Jogadores")}
            </h2>
            <p className="text-sm text-muted-foreground">
              {t("match.kickPrompt", "Select players to remove")} (
              {confirmedPlayers.length - editMaxPlayers})
            </p>
            {isOwner && (
              <p className="text-xs text-amber-500">
                {t(
                  "match.ownerKickTransfer",
                  "Você é o organizador. Se se remover, a organização será transferida para o jogador restante."
                )}
              </p>
            )}
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {confirmedPlayers.map((player) => (
                <label
                  key={player.id}
                  className={`w-full flex items-center gap-3 p-3 rounded-xl border-2 cursor-pointer transition-all ${
                    playersToKick.has(player.user_id)
                      ? "border-red-500 bg-destructive/10"
                      : "border-border hover:border-border"
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={playersToKick.has(player.user_id)}
                    onChange={(e) => {
                      const next = new Set(playersToKick);
                      if (e.target.checked) {
                        next.add(player.user_id);
                      } else {
                        next.delete(player.user_id);
                      }
                      setPlayersToKick(next);
                    }}
                    className="w-5 h-5 text-destructive rounded focus:ring-destructive"
                  />
                  <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center">
                    <Users className="w-5 h-5 text-primary" />
                  </div>
                  <div className="flex-1 text-left">
                    <p className="font-medium text-foreground">
                      {player.profile.name || player.profile.id}
                    </p>
                    {player.user_id === match.created_by && (
                      <p className="text-xs text-primary font-medium">
                        {t("match.owner")}
                      </p>
                    )}
                  </div>
                </label>
              ))}
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setShowKickModal(false)}
                className="flex-1 py-3 bg-muted text-muted-foreground rounded-xl font-medium"
              >
                {t("app.cancel")}
              </button>
              <button
                onClick={handleKickConfirm}
                disabled={
                  isKicking ||
                  playersToKick.size !==
                    confirmedPlayers.length - editMaxPlayers
                }
                className="flex-1 py-3 bg-destructive text-white rounded-xl font-medium disabled:opacity-50"
              >
                {isKicking
                  ? t("app.loading")
                  : t("match.kickConfirm", "Confirmar")}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Match Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center">
          <div className="bg-surface rounded-t-2xl sm:rounded-2xl w-full max-w-md p-6 space-y-4">
            <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-destructive" />
              {t("match.delete", "Excluir partida")}
            </h2>
            <p className="text-sm text-muted-foreground">
              {t("match.deleteConfirm", "Tem certeza? Esta ação não pode ser desfeita.")}
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowDeleteModal(false)}
                className="flex-1 py-3 bg-muted text-muted-foreground rounded-xl font-medium"
              >
                {t("app.cancel")}
              </button>
              <button
                onClick={() => deleteMutation.mutate()}
                disabled={deleteMutation.isPending}
                className="flex-1 py-3 bg-destructive text-white rounded-xl font-medium disabled:opacity-50"
              >
                {deleteMutation.isPending ? t("app.loading") : t("app.delete")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
