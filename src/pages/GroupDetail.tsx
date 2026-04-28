import { useState, useMemo } from "react";
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
  UserCheck,
} from "lucide-react";
import type { Group, Venue, Match } from "../types";
import { useClipboard } from "../hooks/useClipboard";
import { generateInviteCode as makeInviteCode } from "../lib/inviteUtils";
import { formatMatchDate, formatMatchTime } from "../lib/dateUtils";
import { getConfirmedCount } from "../lib/matchUtils";

type MatchWithCount = Match & { match_players: { status: string }[] };

type TabType = "my-matches" | "upcoming" | "past";
type ParticipationFilter = "all" | "joined" | "not-joined";
type FullnessFilter = "all" | "available" | "full";

export default function GroupDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();
  const queryClient = useQueryClient();
  const user = useAuthStore((state) => state.user);
  const [activeTab, setActiveTab] = useState<TabType>("upcoming");
  const [participationFilter, setParticipationFilter] =
    useState<ParticipationFilter>("all");
  const [fullnessFilter, setFullnessFilter] = useState<FullnessFilter>("all");
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [showCreateMatchModal, setShowCreateMatchModal] = useState(false);
  const [inviteError, setInviteError] = useState("");
  const { copied: copiedPermanent, copy: copyPermanent } = useClipboard();
  const { copied: copiedTemporary, copy: copyTemporary } = useClipboard();

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
        .select("*, match_players(status)")
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
        .select("*, matches(*, venues(name), match_players(status))")
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
      const code = makeInviteCode();
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

  const isAdmin = useMemo(
    () => members?.some((m) => m.user_id === user?.id && m.role === "admin"),
    [members, user]
  );

  const tabs = useMemo<{ key: TabType; label: string }[]>(
    () => [
      { key: "my-matches", label: t("group.myMatches") },
      { key: "upcoming", label: t("group.upcoming") },
      { key: "past", label: t("group.past") },
    ],
    [t]
  );

  const displayedMatches: MatchWithCount[] = useMemo(() => {
    if (activeTab === "my-matches") {
      return (myMatches?.map((m: { matches: MatchWithCount }) => m.matches) || []);
    }
    return (matches || []).filter((m) => {
      if (activeTab !== "upcoming") return true;
      const count = getConfirmedCount(m);
      const isJoined = myGroupMatchPlayers?.some((p) => p.match_id === m.id);

      if (fullnessFilter === "available" && count >= m.max_players) return false;
      if (fullnessFilter === "full" && count < m.max_players) return false;
      if (participationFilter === "joined" && !isJoined) return false;
      if (participationFilter === "not-joined" && isJoined) return false;

      return true;
    });
  }, [activeTab, myMatches, matches, fullnessFilter, participationFilter, myGroupMatchPlayers]);

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="bg-surface border-b border-border sticky top-0 z-10">
        <div className="flex items-center gap-3 p-4">
          <button
            onClick={() => navigate("/groups")}
            className="p-2 -ml-2 hover:bg-muted rounded-lg transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-muted-foreground" />
          </button>
          <div className="flex-1 min-w-0">
            <h1 className="text-lg font-semibold text-foreground truncate">
              {group?.name}
            </h1>
            <div className="flex items-center gap-1 text-sm text-muted-foreground">
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
              className="p-2 hover:bg-muted rounded-lg transition-colors"
            >
              <Share2 className="w-5 h-5 text-muted-foreground" />
            </button>
            {isAdmin && (
              <button
                onClick={() => navigate(`/groups/${id}/settings`)}
                className="p-2 hover:bg-muted rounded-lg transition-colors"
              >
                <Settings className="w-5 h-5 text-muted-foreground" />
              </button>
            )}
          </div>
        </div>

        {/* Member count */}
        <div className="px-4 pb-3 flex items-center gap-2 text-sm text-muted-foreground">
          <Users className="w-4 h-4" />
          <span>
            {members?.length || 0} {t("group.members")}
          </span>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-surface border-b border-border">
        <div className="flex">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex-1 py-3 text-sm font-medium text-center transition-colors relative ${
                activeTab === tab.key
                  ? "text-primary"
                  : "text-muted-foreground hover:text-muted-foreground"
              }`}
            >
              {tab.label}
              {activeTab === tab.key && (
                <div className="absolute bottom-0 left-4 right-4 h-0.5 bg-primary rounded-full" />
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Upcoming filters */}
      {activeTab === "upcoming" && (
        <div className="bg-surface border-b border-border px-4 py-3 flex gap-3">
          <select
            value={participationFilter}
            onChange={(e) => setParticipationFilter(e.target.value as ParticipationFilter)}
            className="flex-1 px-3 py-2 bg-background border border-border rounded-lg text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
          >
            <option value="all">{t("group.filterAll", "Todos")}</option>
            <option value="joined">{t("group.filterJoined", "Participando")}</option>
            <option value="not-joined">{t("group.filterNotJoined", "Não participando")}</option>
          </select>
          <select
            value={fullnessFilter}
            onChange={(e) => setFullnessFilter(e.target.value as FullnessFilter)}
            className="flex-1 px-3 py-2 bg-background border border-border rounded-lg text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
          >
            <option value="all">{t("group.filterAllFullness", "Todos")}</option>
            <option value="available">{t("group.filterAvailable", "Com vagas")}</option>
            <option value="full">{t("group.filterFull", "Lotados")}</option>
          </select>
        </div>
      )}

      {/* FAB for new match */}
      {activeTab !== "past" && (
        <button
          onClick={() => navigate(`/groups/${id}/matches/create`)}
          className="fixed right-4 bottom-20 z-20 w-14 h-14 bg-primary text-white rounded-full shadow-lg flex items-center justify-center hover:bg-primary/90 transition-colors"
        >
          <Plus className="w-6 h-6" />
        </button>
      )}

      {/* Match list */}
      <div className="p-4 space-y-3">
        {displayedMatches?.map((match) => {
          const myStatus = myGroupMatchPlayers?.find(
            (p) => p.match_id === match.id
          )?.status;
          return (
            <div
              key={match.id}
              onClick={() =>
                navigate(`/matches/${match.id}`, {
                  state: { from: `/groups/${id}` },
                })
              }
              className="bg-surface rounded-xl border border-border p-4 shadow-sm active:scale-[0.98] transition-transform cursor-pointer"
            >
              <div className="flex items-start justify-between">
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Calendar className="w-4 h-4 text-primary" />
                    <span className="font-medium">
                      {formatMatchDate(match.start_time, i18n.language)}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Clock className="w-4 h-4" />
                    <span>
                      {formatMatchTime(match.start_time, i18n.language)} - {formatMatchTime(match.end_time, i18n.language)}
                    </span>
                  </div>
                  {match.court_cost && (
                    <div className="text-sm text-muted-foreground">
                      R$ {match.court_cost.toFixed(2)} / pessoa
                    </div>
                  )}
                  {myStatus && (
                    <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-primary/10 text-primary text-xs font-medium">
                      <UserCheck className="w-3 h-3" />
                      {myStatus === "confirmed"
                        ? t("match.participating", "Participando")
                        : t("match.waitlisted", "Lista de espera")}
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-1">
                  <div
                    className={`px-2.5 py-1 rounded-full text-xs font-medium ${
                      getConfirmedCount(match) >= match.max_players
                        ? "bg-destructive/10 text-destructive"
                        : "bg-green-500/10 text-green-500"
                    }`}
                  >
                    {getConfirmedCount(match)}/{match.max_players}
                  </div>
                  <ChevronRight className="w-4 h-4 text-muted-foreground/70" />
                </div>
              </div>
            </div>
          );
        })}

        {(!displayedMatches || displayedMatches.length === 0) && (
          <div className="text-center py-12 text-muted-foreground/70">
            <Calendar className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p>
              {{
                "my-matches": t("group.noMyMatches"),
                upcoming: t("group.noUpcoming"),
                past: t("group.noPast"),
              }[activeTab]}
            </p>
          </div>
        )}
      </div>

      {/* Invite Modal */}
      {showInviteModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center">
          <div className="bg-surface rounded-t-2xl sm:rounded-2xl w-full max-w-md p-6 space-y-4">
            <h2 className="text-lg font-semibold text-foreground">
              {t("group.invite")}
            </h2>

            {/* Permanent invite */}
            {group?.permanent_invite_code && (
              <div className="space-y-2">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  {t("group.permanentLink", "Link permanente")}
                </p>
                <div className="bg-muted rounded-lg p-3 text-center">
                  <p className="text-lg font-mono font-bold tracking-wider text-foreground">
                    {group.permanent_invite_code}
                  </p>
                </div>
                <button
                  onClick={async () => {
                    const url = `${window.location.origin}/groups/join?perm=${group.permanent_invite_code}`;
                    const ok = await copyPermanent(url);
                    if (!ok) window.prompt(t("group.copyPrompt", "Copie o link:"), url);
                  }}
                  className={`w-full py-2.5 rounded-xl font-medium text-sm transition-colors ${
                    copiedPermanent
                      ? "bg-green-600 text-white"
                      : "bg-primary text-white"
                  }`}
                >
                  {copiedPermanent
                    ? t("group.linkCopied", "Link copiado!")
                    : t("group.copyLink", "Copiar link")}
                </button>
              </div>
            )}

            {/* Temporary invite */}
            <div className="border-t border-border pt-4 space-y-2">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                {t("group.temporaryInvite", "Convite temporário")}
              </p>
              {group?.invite_code &&
              group.invite_expires_at &&
              new Date(group.invite_expires_at) > new Date() ? (
                <>
                  <div className="bg-muted rounded-lg p-4 text-center">
                    <p className="text-2xl font-mono font-bold tracking-wider text-foreground">
                      {group.invite_code}
                    </p>
                    <p className="text-sm text-muted-foreground mt-1">
                      {t("group.expiresAt", "Expira em")}{" "}
                      {new Date(group.invite_expires_at).toLocaleDateString()}
                    </p>
                  </div>
                  <button
                    onClick={async () => {
                      const url = `${window.location.origin}/groups/join?code=${group.invite_code}`;
                      const ok = await copyTemporary(url);
                      if (!ok) window.prompt(t("group.copyPrompt", "Copie o link:"), url);
                    }}
                    className={`w-full py-2.5 rounded-xl font-medium text-sm transition-colors ${
                      copiedTemporary
                        ? "bg-green-600 text-white"
                        : "bg-primary text-white"
                    }`}
                  >
                    {copiedTemporary
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
                  className="w-full py-2.5 bg-primary text-white rounded-xl font-medium text-sm disabled:opacity-50"
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
              className="w-full py-3 text-muted-foreground font-medium"
            >
              {t("app.close")}
            </button>
          </div>
        </div>
      )}

      {/* Create Match Modal - Placeholder */}
      {showCreateMatchModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center">
          <div className="bg-surface rounded-t-2xl sm:rounded-2xl w-full max-w-md p-6 space-y-4">
            <h2 className="text-lg font-semibold text-foreground">
              {t("group.newMatch")}
            </h2>
            <p className="text-muted-foreground text-sm">
              {t("match.createComingSoon", "Criação de partidas em breve...")}
            </p>
            <button
              onClick={() => setShowCreateMatchModal(false)}
              className="w-full py-3 bg-primary text-white rounded-xl font-medium"
            >
              {t("app.close")}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
