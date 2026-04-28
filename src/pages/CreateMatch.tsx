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
} from "lucide-react";
import type { Venue, Group } from "../types";

export default function CreateMatch() {
  const { id: groupId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const user = useAuthStore((state) => state.user);

  const [startDate, setStartDate] = useState("");
  const [startTime, setStartTime] = useState("");
  const [durationHours, setDurationHours] = useState(1);
  const [venueId, setVenueId] = useState("")
  const [courtCost, setCourtCost] = useState("");
  const [joinMatch, setJoinMatch] = useState(true);
  const [error, setError] = useState("");

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

  const createMatch = useMutation({
    mutationFn: async () => {
      if (!groupId || !user) throw new Error("Missing group or user");
      if (!startDate || !startTime) throw new Error("Missing date or time");
      if (!venueId) throw new Error("Select a venue");

      const startDateTime = new Date(`${startDate}T${startTime}`);
      const endDateTime = new Date(
        startDateTime.getTime() + durationHours * 60 * 60 * 1000
      );

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

      // Auto-check-in creator if opted in
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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    createMatch.mutate();
  };

  if (!groupId) return null;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="flex items-center gap-3 p-4">
          <button
            onClick={() => navigate(`/groups/${groupId}`)}
            className="p-2 -ml-2 hover:bg-gray-100 rounded-lg"
          >
            <ArrowLeft className="w-5 h-5 text-gray-600" />
          </button>
          <h1 className="text-lg font-semibold text-gray-900">
            {t("match.create")}
          </h1>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="p-4 space-y-6">
        {/* Venue Selection */}
        <div className="space-y-2">
          <label className="block text-sm font-medium text-gray-700">
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
                    ? "border-primary-500 bg-primary-50"
                    : "border-gray-200 bg-white hover:border-gray-300"
                }`}
              >
                <MapPin className={`w-5 h-5 ${
                  venueId === venue.id ? "text-primary-600" : "text-gray-400"
                }`} />
                <div className="flex-1 text-left">
                  <p className="font-medium text-gray-900">{venue.name}</p>
                  {venue.address && (
                    <p className="text-sm text-gray-500">{venue.address}</p>
                  )}
                </div>
                {venueId === venue.id && (
                  <div className="w-6 h-6 bg-primary-600 rounded-full flex items-center justify-center">
                    <Check className="w-4 h-4 text-white" />
                  </div>
                )}
              </button>
            ))}
            <button
              type="button"
              onClick={() => navigate(`/groups/${groupId}/venues/create`)}
              className="w-full flex items-center gap-2 p-3 border-2 border-dashed border-gray-300 rounded-xl text-gray-600 hover:border-primary-400 hover:text-primary-600 transition-colors"
            >
              <Plus className="w-5 h-5" />
              {t("venue.addNew", "Adicionar nova quadra")}
            </button>
          </div>
        </div>

        {/* Date & Time */}
        <div className="space-y-2">
          <label className="block text-sm font-medium text-gray-700">
            {t("match.date", "Data")}
          </label>
          <div className="relative">
            <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="date"
              required
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              min={new Date().toISOString().split("T")[0]}
              className="w-full pl-10 pr-4 py-3 bg-white border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>
        </div>

        <div className="space-y-2">
          <label className="block text-sm font-medium text-gray-700">
            {t("match.time", "Horário de início")}
          </label>
          <div className="relative">
            <Clock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="time"
              required
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
              className="w-full pl-10 pr-4 py-3 bg-white border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>
        </div>

        {/* Duration */}
        <div className="space-y-2">
          <label className="block text-sm font-medium text-gray-700">
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
                    ? "border-primary-500 bg-primary-50 text-primary-700"
                    : "border-gray-200 bg-white text-gray-600 hover:border-gray-300"
                }`}
              >
                {h}h
                <div className="text-xs font-normal text-gray-500 mt-1">
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
          <label className="block text-sm font-medium text-gray-700">
            {t("match.courtCost")}{" "}
            <span className="font-normal text-gray-400">(
              {t("match.optional", "opcional")})
            </span>
          </label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 font-medium">R$</span>
            <input
              type="number"
              min="0"
              step="0.01"
              value={courtCost}
              onChange={(e) => setCourtCost(e.target.value)}
              placeholder="0,00"
              className="w-full pl-10 pr-4 py-3 bg-white border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>
        </div>

        {/* Join Option */}
        <div className="flex items-center gap-3 p-4 bg-primary-50 rounded-xl">
          <input
            type="checkbox"
            id="joinMatch"
            checked={joinMatch}
            onChange={(e) => setJoinMatch(e.target.checked)}
            className="w-5 h-5 text-primary-600 rounded focus:ring-primary-500"
          />
          <label htmlFor="joinMatch" className="flex items-center gap-2 text-sm text-primary-800 cursor-pointer">
            <Users className="w-4 h-4" />
            {t("match.joinAutomatically", "Entrar automaticamente na partida")}
          </label>
        </div>

        {error && (
          <div className="bg-red-50 rounded-lg p-3 text-red-700 text-sm">
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={createMatch.isPending}
          className="w-full py-3.5 bg-primary-600 text-white rounded-xl font-semibold disabled:opacity-50 hover:bg-primary-700 transition-colors"
        >
          {createMatch.isPending
            ? t("app.loading")
            : t("match.create")}
        </button>
      </form>
    </div>
  );
}

function calculateMaxPlayers(
  start: Date,
  end: Date,
  group: Group
): number {
  const hours = (end.getTime() - start.getTime()) / (1000 * 3600);
  if (hours < 2) return group.max_players_1h;
  if (hours < 3) return group.max_players_2h;
  return group.max_players_3h_plus;
}
