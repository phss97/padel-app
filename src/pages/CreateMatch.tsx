import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { supabase } from "../lib/supabase";
import { useAuthStore } from "../stores/authStore";
import {
  ArrowLeft,
  Plus,
  Calendar,
  Clock,
  MapPin,
  Check,
  Users,
  AlertTriangle,
} from "lucide-react";
import { calculateMaxPlayers } from "../lib/matchUtils";
import { formatMatchDate, formatMatchTime } from "../lib/dateUtils";
import type { Venue, Group, Match } from "../types";

export default function CreateMatch() {
  const { id: groupId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();
  const queryClient = useQueryClient();
  const user = useAuthStore((state) => state.user);

  const [startDate, setStartDate] = useState("");
  const [startTime, setStartTime] = useState("");
  const [durationHours, setDurationHours] = useState(1);
  const [venueId, setVenueId] = useState("")
  const [courtCost, setCourtCost] = useState("");
  const [joinMatch, setJoinMatch] = useState(true);
  const [error, setError] = useState("");
  const [showMergeModal, setShowMergeModal] = useState(false);
  const [pendingMatch, setPendingMatch] = useState<{ startDateTime: Date; endDateTime: Date } | null>(null);
  const [adjacentMatch, setAdjacentMatch] = useState<Match | null>(null);

  const { data: venues } = useQuery<Venue[]>({
    queryKey: ["group-venues", groupId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("venues")
        .select("*")
        .eq("group_id", groupId);
      if (error) throw error;
      return data || [];
    },
    enabled: !!groupId,
  });

  const { data: group } = useQuery<Group>({
    queryKey: ["group", groupId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("groups")
        .select("*")
        .eq("id", groupId)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!groupId,
  });

  useEffect(() => {
    if (group?.default_venue_id) {
      setVenueId(group.default_venue_id);
    }
  }, [group]);

  const checkAdjacent = async (startDateTime: Date, endDateTime: Date) => {
    if (!venueId) return null;
    const dayStart = new Date(startDateTime);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(dayStart);
    dayEnd.setDate(dayEnd.getDate() + 1);

    const { data, error: qError } = await supabase
      .from("matches")
      .select("*")
      .eq("venue_id", venueId)
      .eq("status", "scheduled")
      .gte("start_time", dayStart.toISOString())
      .lt("start_time", dayEnd.toISOString())
      .limit(10);

    if (qError || !data || data.length === 0) return null;

    const sStart = startDateTime.getTime();
    const sEnd = endDateTime.getTime();
    return (
      (data as Match[]).find((m) => {
        const mStart = new Date(m.start_time).getTime();
        const mEnd = new Date(m.end_time).getTime();
        return mEnd === sStart || mStart === sEnd;
      }) || null
    );
  };

  const createMatch = useMutation({
    mutationFn: async ({ startDateTime, endDateTime }: { startDateTime: Date; endDateTime: Date }) => {
      if (!groupId || !user) throw new Error("Missing group or user");
      if (!venueId) throw new Error("Select a venue");

      const maxPlayers = calculateMaxPlayers(
        startDateTime,
        endDateTime,
        group!
      );

      const { data: match, error: matchError } = await supabase
        .from("matches")
        .insert({
          group_id: groupId,
          venue_id: venueId,
          start_time: startDateTime.toISOString(),
          end_time: endDateTime.toISOString(),
          max_players: maxPlayers,
          court_cost: courtCost ? parseFloat(courtCost) : null,
          created_by: user.id,
        })
        .select()
        .single();

      if (matchError) throw matchError;

      if (joinMatch && match) {
        await supabase.rpc("check_in_match", {
          p_match_id: match.id,
          p_user_id: user.id,
        });
      }

      return match;
    },
    onSuccess: (match) => {
      queryClient.invalidateQueries({ queryKey: ["group-matches", groupId] });
      navigate(`/matches/${match.id}`);
    },
    onError: (err: Error) => {
      setError(err.message);
    },
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!groupId || !user) return;
    if (!startDate || !startTime) {
      setError(t("match.missingDateTime", "Informe data e horário"));
      return;
    }
    if (!venueId) {
      setError(t("match.missingVenue", "Selecione uma quadra"));
      return;
    }

    const startDateTime = new Date(`${startDate}T${startTime}`);
    const endDateTime = new Date(
      startDateTime.getTime() + durationHours * 60 * 60 * 1000
    );

    const adjacent = await checkAdjacent(startDateTime, endDateTime);
    if (adjacent) {
      setPendingMatch({ startDateTime, endDateTime });
      setAdjacentMatch(adjacent);
      setShowMergeModal(true);
      return;
    }

    createMatch.mutate({ startDateTime, endDateTime });
  };

  const handleConfirmMerge = () => {
    if (!pendingMatch) return;
    createMatch.mutate(pendingMatch);
    setShowMergeModal(false);
  };

  if (!groupId) return null;

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="bg-surface border-b border-border sticky top-0 z-10">
        <div className="flex items-center gap-3 p-4">
          <button
            onClick={() => navigate(`/groups/${groupId}`)}
            className="p-2 -ml-2 hover:bg-muted rounded-lg"
          >
            <ArrowLeft className="w-5 h-5 text-muted-foreground" />
          </button>
          <h1 className="text-lg font-semibold text-foreground">
            {t("match.create")}
          </h1>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="p-4 space-y-6">
        {/* Venue Selection */}
        <div className="space-y-2">
          <label className="block text-sm font-medium text-muted-foreground">
            {t("group.venues")}
          </label>
          <div className="space-y-2">
            {venues?.map((venue) => (
              <button
                key={venue.id}
                type="button"
                onClick={() => setVenueId(venue.id)}
                className={`w-full flex items-center gap-3 p-3 rounded-xl border-2 transition-all ${
                  venueId === venue.id
                    ? "border-primary bg-primary/5"
                    : "border-border bg-surface hover:border-border"
                }`}
              >
                <MapPin className={`w-5 h-5 ${
                  venueId === venue.id ? "text-primary" : "text-muted-foreground"
                }`} />
                <div className="flex-1 text-left">
                  <p className="font-medium text-foreground">{venue.name}</p>
                  {venue.address && (
                    <p className="text-sm text-muted-foreground">{venue.address}</p>
                  )}
                </div>
                {venueId === venue.id && (
                  <div className="w-6 h-6 bg-primary rounded-full flex items-center justify-center">
                    <Check className="w-4 h-4 text-white" />
                  </div>
                )}
              </button>
            ))}
            <button
              type="button"
              onClick={() => navigate(`/groups/${groupId}/venues/create`)}
              className="w-full flex items-center gap-2 p-3 border-2 border-dashed border-border rounded-xl text-muted-foreground hover:border-primary hover:text-primary transition-colors"
            >
              <Plus className="w-5 h-5" />
              {t("venue.addNew", "Adicionar nova quadra")}
            </button>
          </div>
        </div>

        {/* Date & Time */}
        <div className="space-y-2">
          <label className="block text-sm font-medium text-muted-foreground">
            {t("match.date", "Data")}
          </label>
          <div className="relative">
            <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
            <input
              type="date"
              required
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              min={new Date().toISOString().split("T")[0]}
              className="w-full pl-10 pr-4 py-3 bg-surface border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
        </div>

        <div className="space-y-2">
          <label className="block text-sm font-medium text-muted-foreground">
            {t("match.time", "Horário de início")}
          </label>
          <div className="relative">
            <Clock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
            <input
              type="time"
              required
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
              className="w-full pl-10 pr-4 py-3 bg-surface border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary"
            />
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
                type="button"
                onClick={() => setDurationHours(h)}
                className={`py-3 rounded-xl border-2 font-medium transition-all ${
                  durationHours === h
                    ? "border-primary bg-primary/5 text-primary"
                    : "border-border bg-surface text-muted-foreground hover:border-border"
                }`}
              >
                {h}h
                <div className="text-xs font-normal text-muted-foreground mt-1">
                  {(h === 1
                    ? group?.max_players_1h
                    : h === 2
                    ? group?.max_players_2h
                    : group?.max_players_3h_plus) || h * 4}{" "}
                  {t("match.players", "jogadores")}
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Court Cost */}
        <div className="space-y-2">
          <label className="block text-sm font-medium text-muted-foreground">
            {t("match.courtCost")}{" "}
            <span className="font-normal text-muted-foreground">(
              {t("match.optional", "opcional")})
            </span>
          </label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground font-medium">R$</span>
            <input
              type="number"
              min="0"
              step="0.01"
              value={courtCost}
              onChange={(e) => setCourtCost(e.target.value)}
              placeholder="0,00"
              className="w-full pl-10 pr-4 py-3 bg-surface border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
        </div>

        {/* Join Option */}
        <div className="flex items-center gap-3 p-4 bg-primary/5 rounded-xl">
          <input
            type="checkbox"
            id="joinMatch"
            checked={joinMatch}
            onChange={(e) => setJoinMatch(e.target.checked)}
            className="w-5 h-5 text-primary rounded focus:ring-primary"
          />
          <label htmlFor="joinMatch" className="flex items-center gap-2 text-sm text-primary cursor-pointer">
            <Users className="w-4 h-4" />
            {t("match.joinAutomatically", "Entrar automaticamente na partida")}
          </label>
        </div>

        {error && (
          <div className="bg-destructive/10 rounded-lg p-3 text-destructive text-sm">
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={createMatch.isPending}
          className="w-full py-3.5 bg-primary text-white rounded-xl font-semibold disabled:opacity-50 hover:bg-primary/90 transition-colors"
        >
          {createMatch.isPending
            ? t("app.loading")
            : t("match.create")}
        </button>
      </form>

      {/* Merge Confirmation Modal */}
      {showMergeModal && adjacentMatch && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center">
          <div className="bg-surface rounded-t-2xl sm:rounded-2xl w-full max-w-md p-6 space-y-4">
            <div className="flex items-center gap-3 text-amber-500">
              <AlertTriangle className="w-6 h-6" />
              <h2 className="text-lg font-semibold text-foreground">
                {t("match.mergeTitle", "Partida adjacente encontrada")}
              </h2>
            </div>
            <p className="text-muted-foreground text-sm">
              {t("match.mergeDescription", "Já existe uma partida no mesmo horário que será mesclada com esta.")}
            </p>
            <div className="bg-muted rounded-xl p-4 space-y-2 text-sm">
              <p className="text-muted-foreground">{t("match.existingMatch", "Partida existente:")}</p>
              <p className="font-medium text-foreground">
                {formatMatchDate(adjacentMatch.start_time, i18n.language)} ·{" "}
                {formatMatchTime(adjacentMatch.start_time, i18n.language)} -{" "}
                {formatMatchTime(adjacentMatch.end_time, i18n.language)}
              </p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowMergeModal(false);
                  setPendingMatch(null);
                  setAdjacentMatch(null);
                }}
                className="flex-1 py-3 bg-muted text-foreground rounded-xl font-medium hover:bg-muted/80 transition-colors"
              >
                {t("app.cancel")}
              </button>
              <button
                onClick={handleConfirmMerge}
                disabled={createMatch.isPending}
                className="flex-1 py-3 bg-primary text-white rounded-xl font-medium disabled:opacity-50 hover:bg-primary/90 transition-colors"
              >
                {createMatch.isPending ? t("app.loading") : t("match.mergeConfirm", "Mesclar e criar")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
