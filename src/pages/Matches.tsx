import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { Calendar, Users } from "lucide-react";
import { formatMatchDate, formatMatchTime } from "../lib/dateUtils";
import { getConfirmedCount } from "../lib/matchUtils";

export default function Matches() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();

  const { data: myMatches } = useQuery({
    queryKey: ["my-matches"],
    queryFn: async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return [];

      const { data: playerRows } = await supabase
        .from("match_players")
        .select("match_id")
        .eq("user_id", user.id)
        .eq("status", "confirmed");

      const matchIds = (playerRows || []).map((r) => r.match_id);
      if (matchIds.length === 0) return [];

      const { data } = await supabase
        .from("matches")
        .select("*, venues(name), match_players(status)")
        .in("id", matchIds)
        .order("start_time", { ascending: true });

      return data || [];
    },
  });

  return (
    <div className="p-4 space-y-6">
      <h1 className="text-2xl font-bold text-foreground">{t("nav.matches")}</h1>

      <div className="space-y-3">
        {myMatches?.map((match) => {
          const playerCount = getConfirmedCount(match);
          return (
            <div
              key={match.id}
              onClick={() =>
                navigate(`/matches/${match.id}`, {
                  state: { from: "/matches" },
                })
              }
              className="bg-surface rounded-xl border border-border p-4 shadow-sm active:scale-[0.98] transition-transform cursor-pointer"
            >
              <div className="flex items-start justify-between">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-primary" />
                    <span className="font-medium text-foreground">
                      {formatMatchDate(match.start_time, i18n.language)} {formatMatchTime(match.start_time, i18n.language)}
                    </span>
                  </div>
                  <p className="text-sm text-muted-foreground">{match.venues?.name}</p>
                  <span className="inline-block mt-1 px-2 py-0.5 bg-green-100 text-green-700 text-xs rounded-full font-medium">
                    {t("match.statusConfirmed", "Confirmado")}
                  </span>
                </div>
                <div className="flex items-center gap-1 text-sm text-muted-foreground">
                  <Users className="w-4 h-4" />
                  <span>
                    {playerCount}/{match.max_players}
                  </span>
                </div>
              </div>
            </div>
          );
        })}

        {(!myMatches || myMatches.length === 0) && (
          <div className="text-center py-8 text-muted-foreground/70">
            {t("match.noMatches", "Você não está participando de nenhuma partida")}
          </div>
        )}
      </div>
    </div>
  );
}
