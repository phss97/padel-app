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
      const { data } = await supabase
        .from("match_players")
        .select("*, matches(*, venues(name), match_players(status))")
        .eq("status", "confirmed");
      return (data || []).sort(
        (a, b) =>
          new Date(a.matches.start_time).getTime() -
          new Date(b.matches.start_time).getTime(),
      );
    },
  });

  return (
    <div className="p-4 space-y-6">
      <h1 className="text-2xl font-bold text-foreground">{t("nav.matches")}</h1>

      <div className="space-y-3">
        {myMatches?.map((entry) => {
          const match = entry.matches;
          const playerCount = getConfirmedCount(match);
          return (
            <div
              key={entry.id}
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
