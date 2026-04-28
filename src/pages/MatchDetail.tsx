import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
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
  Settings,
  AlertTriangle,
  DollarSign,
} from "lucide-react";
import type { Match, Profile, Group, MatchPayment } from "../types";

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
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const user = useAuthStore((state) => state.user);
  const [error, setError] = useState("");
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [selectedNewOwner, setSelectedNewOwner] = useState<string>("");

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

  const confirmedPlayers = players?.filter((p) => p.status === "confirmed") || [];
  const waitlistedPlayers = players?.filter((p) => p.status === "waitlist") || [];
  const isOwner = match?.created_by === user?.id;
  const isFull = confirmedPlayers.length >= (match?.max_players || 0);
  const isPlayer = players?.some((p) => p.user_id === user?.id && p.status === "confirmed");
  const isWaitlisted = players?.some((p) => p.user_id === user?.id && p.status === "waitlist");

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
      setShowTransferModal(false);
      setError("");
    },
    onError: (err: Error) => setError(err.message),
  });

  const extendMutation = useMutation({
    mutationFn: async () => {
      if (!matchId) throw new Error("No match ID");
      const { data, error } = await supabase.rpc("extend_match", {
        p_match_id: matchId,
        p_hours: 1,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["match", matchId] });
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

  if (!match) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="flex items-center gap-3 p-4">
          <button
            onClick={() => navigate(-1)}
            className="p-2 -ml-2 hover:bg-gray-100 rounded-lg"
          >
            <ArrowLeft className="w-5 h-5 text-gray-600" />
          </button>
          <div className="flex-1 min-w-0">
            <h1 className="text-lg font-semibold text-gray-900 truncate">
              {t("match.details", "Detalhes da partida")}
            </h1>
          </div>
          {isOwner && (
            <button
              onClick={() => setShowTransferModal(true)}
              className="p-2 hover:bg-gray-100 rounded-lg"
            >
              <Settings className="w-5 h-5 text-gray-600" />
            </button>
          )}
        </div>
      </div>

      {/* Match Info */}
      <div className="bg-white border-b border-gray-200 p-4 space-y-3">
        <div className="flex items-center gap-3">
          <Calendar className="w-5 h-5 text-primary-600" />
          <span className="text-gray-900 font-medium">
            {new Date(match.start_time).toLocaleDateString(undefined, {
              weekday: "long",
              day: "numeric",
              month: "long",
              year: "numeric",
            })}
          </span>
        </div>
        <div className="flex items-center gap-3">
          <Clock className="w-5 h-5 text-primary-600" />
          <span className="text-gray-900">
            {new Date(match.start_time).toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
            })}{" "}-{" "}
            {new Date(match.end_time).toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
            })}
          </span>
        </div>
        <div className="flex items-center gap-3">
          <MapPin className="w-5 h-5 text-primary-600" />
          <span className="text-gray-900">{match.venue?.name}</span>
        </div>
        {match.court_cost && (
          <div className="flex items-center gap-3">
            <span className="text-primary-600 font-bold">R$</span>
            <span className="text-gray-900">
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
            <h2 className="text-lg font-semibold text-gray-900">
              {t("match.players")}
            </h2>
            <span
              className={`text-sm font-medium ${
                isFull ? "text-red-600" : "text-green-600"
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
                className="flex items-center gap-3 p-3 bg-white rounded-xl border border-gray-100"
              >
                <div className="w-10 h-10 bg-primary-100 rounded-full flex items-center justify-center">
                  <Users className="w-5 h-5 text-primary-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-gray-900 truncate">
                    {player.profile.name || player.profile.id}
                  </p>
                  {player.user_id === match.created_by && (
                    <p className="text-xs text-primary-600 font-medium">
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
            <h2 className="text-lg font-semibold text-gray-900">
              {t("match.waitlist")}
            </h2>
            <div className="space-y-2">
              {waitlistedPlayers
                .sort((a, b) => (a.waitlist_position || 0) - (b.waitlist_position || 0))
                .map((player, index) => (
                  <div
                    key={player.id}
                    className="flex items-center gap-3 p-3 bg-amber-50 rounded-xl border border-amber-100"
                  >
                    <div className="w-8 h-8 bg-amber-100 rounded-full flex items-center justify-center text-amber-700 font-bold text-sm">
                      {index + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-gray-900 truncate">
                        {player.profile.name || player.profile.id}
                      </p>
                    </div>
                    {player.user_id === user?.id && (
                      <span className="text-xs text-amber-700 font-medium">
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
              <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                <DollarSign className="w-5 h-5 text-primary-600" />
                {t("match.payments")}
              </h2>
              <span className="text-sm font-medium text-gray-700">
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
                const isPaid = payments?.some(
                  (p) => p.user_id === player.user_id
                );
                const canToggle =
                  isOwner || player.user_id === user?.id;
                return (
                  <div
                    key={player.id}
                    className="flex items-center gap-3 p-3 bg-white rounded-xl border border-gray-100"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-gray-900 truncate">
                        {player.profile.name || player.profile.id}
                      </p>
                      {player.profile.pix_key ? (
                        <p className="text-xs text-gray-500 truncate">
                          {t("match.pixKey")}: {player.profile.pix_key}
                        </p>
                      ) : (
                        <p className="text-xs text-gray-400 italic">
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
                            ? "bg-green-100 text-green-700"
                            : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                        }`}
                      >
                        {isPaid
                          ? t("match.paid")
                          : t("match.markAsPaid")}
                      </button>
                    )}
                    {!canToggle && isPaid && (
                      <span className="text-sm font-semibold text-green-700 bg-green-100 px-3 py-1.5 rounded-lg">
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
          <div className="bg-red-50 rounded-lg p-3 text-red-700 text-sm text-center">
            {error}
          </div>
        )}

        {/* Action Buttons */}
        <div className="space-y-3">
          {!isPlayer && !isWaitlisted && !isFull && (
            <button
              onClick={() => checkInMutation.mutate()}
              disabled={checkInMutation.isPending}
              className="w-full py-3.5 bg-primary-600 text-white rounded-xl font-semibold disabled:opacity-50 hover:bg-primary-700 transition-colors"
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
              className="w-full py-3.5 bg-amber-500 text-white rounded-xl font-semibold disabled:opacity-50 hover:bg-amber-600 transition-colors"
            >
              {checkInMutation.isPending
                ? t("app.loading")
                : t("match.joinWaitlist", "Entrar na lista de espera")}
            </button>
          )}

          {(isPlayer || isWaitlisted) && (
            <button
              onClick={() => forfeitMutation.mutate()}
              disabled={forfeitMutation.isPending}
              className="w-full py-3.5 border-2 border-red-200 text-red-600 rounded-xl font-semibold disabled:opacity-50 hover:bg-red-50 transition-colors"
            >
              {forfeitMutation.isPending
                ? t("app.loading")
                : t("match.forfeit")}
            </button>
          )}

          {isOwner && (
            <button
              onClick={() => extendMutation.mutate()}
              disabled={extendMutation.isPending}
              className="w-full py-3.5 bg-white border-2 border-primary-200 text-primary-700 rounded-xl font-semibold disabled:opacity-50 hover:bg-primary-50 transition-colors flex items-center justify-center gap-2"
            >
              <Plus className="w-5 h-5" />
              {extendMutation.isPending
                ? t("app.loading")
                : t("match.extend")}
            </button>
          )}
        </div>

        {/* Ownership Transfer Warning */}
        {isOwner && confirmedPlayers.length > 1 && (
          <div className="bg-amber-50 rounded-xl p-4 border border-amber-100">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-amber-800">
                  {t("match.transferWarning", "Se você desistir, a partida será transferida para:")}
                </p>
                <p className="text-sm text-amber-700 mt-1">
                  {confirmedPlayers.find((p) => p.user_id !== user?.id)?.profile.name ||
                    t("match.earliestJoined", "o próximo jogador a entrar")}
                </p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Transfer Ownership Modal */}
      {showTransferModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center">
          <div className="bg-white rounded-t-2xl sm:rounded-2xl w-full max-w-md p-6 space-y-4">
            <h2 className="text-lg font-semibold text-gray-900">
              {t("match.transferOwnership", "Transferir partida")}
            </h2>
            <p className="text-sm text-gray-500">
              {t("match.selectNewOwner", "Selecione o novo organizador:")}
            </p>
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {confirmedPlayers.map((player) => (
                <button
                  key={player.id}
                  onClick={() => setSelectedNewOwner(player.user_id)}
                  className={`w-full flex items-center gap-3 p-3 rounded-xl border-2 transition-all ${
                    selectedNewOwner === player.user_id
                      ? "border-primary-500 bg-primary-50"
                      : "border-gray-200 hover:border-gray-300"
                  }`}
                >
                  <div className="w-10 h-10 bg-primary-100 rounded-full flex items-center justify-center">
                    <Users className="w-5 h-5 text-primary-600" />
                  </div>
                  <div className="flex-1 text-left">
                    <p className="font-medium text-gray-900">
                      {player.profile.name || player.profile.id}
                    </p>
                  </div>
                  {selectedNewOwner === player.user_id && (
                    <CheckCircle className="w-5 h-5 text-primary-600" />
                  )}
                </button>
              ))}
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setShowTransferModal(false)}
                className="flex-1 py-3 bg-gray-100 text-gray-700 rounded-xl font-medium"
              >
                {t("app.cancel")}
              </button>
              <button
                onClick={() =>
                  selectedNewOwner &&
                  transferOwnershipMutation.mutate(selectedNewOwner)
                }
                disabled={!selectedNewOwner || transferOwnershipMutation.isPending}
                className="flex-1 py-3 bg-primary-600 text-white rounded-xl font-medium disabled:opacity-50"
              >
                {transferOwnershipMutation.isPending
                  ? t("app.loading")
                  : t("app.confirm")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
