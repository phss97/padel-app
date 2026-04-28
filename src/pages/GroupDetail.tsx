import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { supabase } from "../lib/supabase";
import { useAuthStore } from "../stores/authStore";
import {
  ArrowLeft,
  Users,
  MapPin,
  Settings,
  Share2,
  Plus,
  Calendar,
  Clock,
  ChevronRight,
} from "lucide-react";
import type { Group, Venue, Match } from "../types";

type MatchWithCount = Match & { match_players: { count: number }[] };

type TabType = "my-matches" | "upcoming" | "past";
type UpcomingFilter = "all" | "available" | "full" | "not-joined";

export default function GroupDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const user = useAuthStore((state) => state.user);
  const [activeTab, setActiveTab] = useState<TabType>("upcoming");
  const [upcomingFilter, setUpcomingFilter] = useState<UpcomingFilter>("all");
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [showCreateMatchModal, setShowCreateMatchModal] = useState(false);
  const [copied, setCopied] = useState(false);
  const [inviteError, setInviteError] = useState("");

  const { data: group } = useQuery<Group>({
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

  const { data: members } = useQuery({
    queryKey: ["group-members", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("group_members")
        .select("*, profiles(*)")
        .eq("group_id", id);
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  const { data: matches } = useQuery<MatchWithCount[]>({
    queryKey: ["group-matches", id, activeTab],
    queryFn: async () => {
      let query = supabase
        .from("matches")
        .select("*, match_players(count)")
        .eq("group_id", id);

      const now = new Date().toISOString();

      if (activeTab === "upcoming") {
        query = query.gte("start_time", now).eq("status", "scheduled");
      } else if (activeTab === "past") {
        query = query.lt("start_time", now);
      }

      const { data, error } = await query.order("start_time", {
        ascending: activeTab === "upcoming",
      });

      if (error) throw error;
      return (data || []) as MatchWithCount[];
    },
    enabled: !!id,
  });

  const { data: myMatches } = useQuery({
    queryKey: ["my-group-matches", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("match_players")
        .select("*, matches(*, venues(name), match_players(count))")
        .eq("user_id", (await supabase.auth.getUser()).data.user?.id)
        .eq("matches.group_id", id)
        .eq("status", "confirmed");
      if (error) throw error;
      return data;
    },
    enabled: !!id && activeTab === "my-matches",
  });

  const { data: myGroupMatchPlayers } = useQuery({
    queryKey: ["my-group-match-players", id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from("match_players")
        .select("match_id, status")
        .eq("user_id", user.id)
        .in(
          "match_id",
          (matches || []).map((m) => m.id)
        );
      if (error) throw error;
      return (data || []) as { match_id: string; status: string }[];
    },
    enabled: !!id && !!matches && matches.length > 0 && activeTab === "upcoming",
  });

  const generateInviteCode = useMutation({
    mutationFn: async () => {
      if (!id) throw new Error("No group ID");
      const code = Math.random().toString(36).substring(2, 10).toUpperCase();
      const { data, error } = await supabase
        .from("groups")
        .update({
          invite_code: code,
          invite_expires_at: new Date(
            Date.now() + 7 * 24 * 60 * 60 * 1000
          ).toISOString(),
        })
        .eq("id", id)
        .select();
      if (error) throw error;
      if (!data || data.length === 0) {
        throw new Error("Update failed — check permissions");
      }
      return code;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["group", id] });
      setInviteError("");
    },
    onError: (err: Error) => {
      setInviteError(err.message);
    },
  });

  const isAdmin = members?.some(
    (m) => m.user_id === user?.id && m.role === "admin"
  );

  const tabs: { key: TabType; label: string }[] = [
    { key: "my-matches", label: t("group.myMatches") },
    { key: "upcoming", label: t("group.upcoming") },
    { key: "past", label: t("group.past") },
  ];

  const getConfirmedCount = (m: MatchWithCount) =>
    m.match_players?.[0]?.count || 0;

  const isUserInMatch = (matchId: string) =>
    myGroupMatchPlayers?.some((p) => p.match_id === matchId);

  const displayedMatches: MatchWithCount[] =
    activeTab === "my-matches"
      ? (myMatches?.map((m: { matches: MatchWithCount }) => m.matches) || [])
      : (matches || []).filter((m) => {
          if (activeTab !== "upcoming") return true;
          const count = getConfirmedCount(m);
          if (upcomingFilter === "available") return count < m.max_players;
          if (upcomingFilter === "full") return count >= m.max_players;
          if (upcomingFilter === "not-joined") return !isUserInMatch(m.id);
          return true;
        });

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="flex items-center gap-3 p-4">
          <button
            onClick={() => navigate("/groups")}
            className="p-2 -ml-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-gray-600" />
          </button>
          <div className="flex-1 min-w-0">
            <h1 className="text-lg font-semibold text-gray-900 truncate">
              {group?.name}
            </h1>
            <div className="flex items-center gap-1 text-sm text-gray-500">
              <MapPin className="w-3.5 h-3.5" />
              <span className="truncate">
                {venues?.find((v) => v.id === group?.default_venue_id)?.name ||
                  t("group.noDefaultVenue")}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setShowInviteModal(true)}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <Share2 className="w-5 h-5 text-gray-600" />
            </button>
            {isAdmin && (
              <button
                onClick={() => navigate(`/groups/${id}/settings`)}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <Settings className="w-5 h-5 text-gray-600" />
              </button>
            )}
          </div>
        </div>

        {/* Member count */}
        <div className="px-4 pb-3 flex items-center gap-2 text-sm text-gray-500">
          <Users className="w-4 h-4" />
          <span>
            {members?.length || 0} {t("group.members")}
          </span>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white border-b border-gray-200">
        <div className="flex">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex-1 py-3 text-sm font-medium text-center transition-colors relative ${
                activeTab === tab.key
                  ? "text-primary-600"
                  : "text-gray-500 hover:text-gray-700"
              }`}
            >
              {tab.label}
              {activeTab === tab.key && (
                <div className="absolute bottom-0 left-4 right-4 h-0.5 bg-primary-600 rounded-full" />
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Upcoming filters */}
      {activeTab === "upcoming" && (
        <div className="bg-white border-b border-gray-200 px-4 py-2 flex gap-2 overflow-x-auto">
          {[
            { key: "all" as UpcomingFilter, label: t("group.filterAll", "Todos") },
            {
              key: "available" as UpcomingFilter,
              label: t("group.filterAvailable", "Com vagas"),
            },
            { key: "full" as UpcomingFilter, label: t("group.filterFull", "Lotados") },
            {
              key: "not-joined" as UpcomingFilter,
              label: t("group.filterNotJoined", "Não entrados"),
            },
          ].map((f) => (
            <button
              key={f.key}
              onClick={() => setUpcomingFilter(f.key)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${
                upcomingFilter === f.key
                  ? "bg-primary-600 text-white"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      )}

      {/* FAB for new match */}
      {activeTab !== "past" && (
        <button
          onClick={() => navigate(`/groups/${id}/matches/create`)}
          className="fixed right-4 bottom-20 z-20 w-14 h-14 bg-primary-600 text-white rounded-full shadow-lg flex items-center justify-center hover:bg-primary-700 transition-colors"
        >
          <Plus className="w-6 h-6" />
        </button>
      )}

      {/* Match list */}
      <div className="p-4 space-y-3">
        {displayedMatches?.map((match) => (
          <div
            key={match.id}
            onClick={() =>
              navigate(`/matches/${match.id}`, {
                state: { from: `/groups/${id}` },
              })
            }
            className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm active:scale-[0.98] transition-transform cursor-pointer"
          >
            <div className="flex items-start justify-between">
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <Calendar className="w-4 h-4 text-primary-600" />
                  <span className="font-medium">
                    {new Date(match.start_time).toLocaleDateString(
                      undefined,
                      {
                        weekday: "short",
                        day: "numeric",
                        month: "short",
                      }
                    )}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-sm text-gray-500">
                  <Clock className="w-4 h-4" />
                  <span>
                    {new Date(match.start_time).toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}{" "}
                    -
                    {new Date(match.end_time).toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                </div>
                {match.court_cost && (
                  <div className="text-sm text-gray-500">
                    R$ {match.court_cost.toFixed(2)} / pessoa
                  </div>
                )}
              </div>
              <div className="flex items-center gap-1">
                <div
                  className={`px-2.5 py-1 rounded-full text-xs font-medium ${
                    (match.match_players?.[0]?.count || 0) >= match.max_players
                      ? "bg-red-100 text-red-700"
                      : "bg-green-100 text-green-700"
                  }`}
                >
                  {match.match_players?.[0]?.count || 0}/{match.max_players}
                </div>
                <ChevronRight className="w-4 h-4 text-gray-400" />
              </div>
            </div>
          </div>
        ))}

        {(!displayedMatches || displayedMatches.length === 0) && (
          <div className="text-center py-12 text-gray-400">
            <Calendar className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p>
              {activeTab === "my-matches"
                ? t("group.noMyMatches")
                : activeTab === "upcoming"
                ? t("group.noUpcoming")
                : t("group.noPast")}
            </p>
          </div>
        )}
      </div>

      {/* Invite Modal */}
      {showInviteModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center">
          <div className="bg-white rounded-t-2xl sm:rounded-2xl w-full max-w-md p-6 space-y-4">
            <h2 className="text-lg font-semibold text-gray-900">
              {t("group.invite")}
            </h2>

            {/* Permanent invite */}
            {group?.permanent_invite_code && (
              <div className="space-y-2">
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                  {t("group.permanentLink", "Link permanente")}
                </p>
                <div className="bg-gray-100 rounded-lg p-3 text-center">
                  <p className="text-lg font-mono font-bold tracking-wider text-gray-900">
                    {group.permanent_invite_code}
                  </p>
                </div>
                <button
                  onClick={async () => {
                    const url = `${window.location.origin}/groups/join?perm=${group.permanent_invite_code}`;
                    try {
                      await navigator.clipboard.writeText(url);
                      setCopied(true);
                      setTimeout(() => setCopied(false), 2000);
                    } catch {
                      window.prompt(t("group.copyPrompt", "Copie o link:"), url);
                    }
                  }}
                  className={`w-full py-2.5 rounded-xl font-medium text-sm transition-colors ${
                    copied
                      ? "bg-green-600 text-white"
                      : "bg-gray-800 text-white"
                  }`}
                >
                  {copied
                    ? t("group.linkCopied", "Link copiado!")
                    : t("group.copyLink", "Copiar link")}
                </button>
              </div>
            )}

            {/* Temporary invite */}
            <div className="border-t border-gray-100 pt-4 space-y-2">
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                {t("group.temporaryInvite", "Convite temporário")}
              </p>
              {group?.invite_code &&
              group.invite_expires_at &&
              new Date(group.invite_expires_at) > new Date() ? (
                <>
                  <div className="bg-gray-100 rounded-lg p-4 text-center">
                    <p className="text-2xl font-mono font-bold tracking-wider text-gray-900">
                      {group.invite_code}
                    </p>
                    <p className="text-sm text-gray-500 mt-1">
                      {t("group.expiresAt", "Expira em")}{" "}
                      {new Date(group.invite_expires_at).toLocaleDateString()}
                    </p>
                  </div>
                  <button
                    onClick={async () => {
                      const url = `${window.location.origin}/groups/join?code=${group.invite_code}`;
                      try {
                        await navigator.clipboard.writeText(url);
                        setCopied(true);
                        setTimeout(() => setCopied(false), 2000);
                      } catch {
                        window.prompt(t("group.copyPrompt", "Copie o link:"), url);
                      }
                    }}
                    className={`w-full py-2.5 rounded-xl font-medium text-sm transition-colors ${
                      copied
                        ? "bg-green-600 text-white"
                        : "bg-primary-600 text-white"
                    }`}
                  >
                    {copied
                      ? t("group.linkCopied", "Link copiado!")
                      : t("group.copyLink", "Copiar link")}
                  </button>
                </>
              ) : (
                <button
                  onClick={() => {
                    setInviteError("");
                    generateInviteCode.mutate();
                  }}
                  disabled={generateInviteCode.isPending}
                  className="w-full py-2.5 bg-primary-600 text-white rounded-xl font-medium text-sm disabled:opacity-50"
                >
                  {generateInviteCode.isPending
                    ? t("app.loading")
                    : t("group.generateCode", "Gerar código de convite")}
                </button>
              )}
            </div>

            {inviteError && (
              <p className="text-sm text-red-600 text-center">{inviteError}</p>
            )}

            <button
              onClick={() => {
                setShowInviteModal(false);
                setInviteError("");
              }}
              className="w-full py-3 text-gray-600 font-medium"
            >
              {t("app.close")}
            </button>
          </div>
        </div>
      )}

      {/* Create Match Modal - Placeholder */}
      {showCreateMatchModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center">
          <div className="bg-white rounded-t-2xl sm:rounded-2xl w-full max-w-md p-6 space-y-4">
            <h2 className="text-lg font-semibold text-gray-900">
              {t("group.newMatch")}
            </h2>
            <p className="text-gray-500 text-sm">
              {t("match.createComingSoon", "Criação de partidas em breve...")}
            </p>
            <button
              onClick={() => setShowCreateMatchModal(false)}
              className="w-full py-3 bg-primary-600 text-white rounded-xl font-medium"
            >
              {t("app.close")}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
