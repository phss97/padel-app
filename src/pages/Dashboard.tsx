import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { supabase } from "../lib/supabase";
import { Calendar, Users } from "lucide-react";
import { formatMatchDate, formatMatchTime } from "../lib/dateUtils";

export default function Dashboard() {
  const { t, i18n } = useTranslation();

  const { data: upcomingMatches } = useQuery({
    queryKey: ["upcoming-matches"],
    queryFn: async () => {
      const { data } = await supabase
        .from("matches")
        .select("*, venues(name), match_players(count)")
        .gt("start_time", new Date().toISOString())
        .eq("status", "scheduled")
        .order("start_time", { ascending: true })
        .limit(5);
      return data || [];
    },
  });

  return (
    <div className="p-4 space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-bold text-foreground">{t("nav.dashboard")}</h1>
        <p className="text-muted-foreground">{upcomingMatches?.length} {t("dashboard.upcomingMatches", "partidas agendadas")}</p>
      </div>

      <div className="space-y-3">
        <h2 className="text-lg font-semibold text-foreground">{t("dashboard.upcoming", "Próximas partidas")}</h2>

        {upcomingMatches?.map((match) => (
          <div
            key={match.id}
            className="bg-surface rounded-xl border border-border p-4 shadow-sm"
          >
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-primary" />
                  <span className="font-medium text-foreground">
                    {formatMatchDate(match.start_time, i18n.language)} {formatMatchTime(match.start_time, i18n.language)}
                  </span>
                </div>
                <p className="text-sm text-muted-foreground">{match.venues?.name}</p>
              </div>
              <div className="flex items-center gap-1 text-sm text-muted-foreground">
                <Users className="w-4 h-4" />
                <span>{match.match_players?.[0]?.count || 0}/{match.max_players}</span>
              </div>
            </div>
          </div>
        ))}

        {(!upcomingMatches || upcomingMatches.length === 0) && (
          <div className="text-center py-8 text-muted-foreground/70">
            {t("dashboard.noMatches", "Nenhuma partida agendada ainda")}
          </div>
        )}
      </div>
    </div>
  );
}
