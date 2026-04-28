import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { supabase } from "../lib/supabase";
import { Calendar, Users } from "lucide-react";

export default function Dashboard() {
  const { t } = useTranslation();

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
        <h1 className="text-2xl font-bold text-gray-900">{t("nav.dashboard")}</h1>
        <p className="text-gray-500">{upcomingMatches?.length} {t("dashboard.upcomingMatches", "partidas agendadas")}</p>
      </div>

      <div className="space-y-3">
        <h2 className="text-lg font-semibold text-gray-800">{t("dashboard.upcoming", "Próximas partidas")}</h2>

        {upcomingMatches?.map((match) => (
          <div
            key={match.id}
            className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm"
          >
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-primary-600" />
                  <span className="font-medium text-gray-900">
                    {new Date(match.start_time).toLocaleDateString(
                      "pt-BR",
                      {
                        weekday: "short",
                        day: "numeric",
                        month: "short",
                        hour: "2-digit",
                        minute: "2-digit",
                      }
                    )}
                  </span>
                </div>
                <p className="text-sm text-gray-500">{match.venues?.name}</p>
              </div>
              <div className="flex items-center gap-1 text-sm text-gray-600">
                <Users className="w-4 h-4" />
                <span>{match.match_players?.[0]?.count || 0}/{match.max_players}</span>
              </div>
            </div>
          </div>
        ))}

        {(!upcomingMatches || upcomingMatches.length === 0) && (
          <div className="text-center py-8 text-gray-400">
            {t("dashboard.noMatches", "Nenhuma partida agendada ainda")}
          </div>
        )}
      </div>
    </div>
  );
}
