import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { Calendar, Users } from "lucide-react";

export default function Matches() {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const { data: myMatches } = useQuery({
    queryKey: ["my-matches"],
    queryFn: async () => {
      const { data } = await supabase
        .from("match_players")
        .select("*, matches(*, venues(name), match_players(count))")
        .eq("status", "confirmed")
        .order("joined_at", { ascending: false });
      return data || [];
    },
  });

  return (
    <div className="p-4 space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">{t("nav.matches")}</h1>

      <div className="space-y-3">
        {myMatches?.map((entry) => {
          const match = entry.matches;
          const playerCount = match.match_players?.[0]?.count || 0;
          return (
            <div
              key={entry.id}
              onClick={() => navigate(`/matches/${match.id}`)}
              className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm active:scale-[0.98] transition-transform cursor-pointer"
            >
              <div className="flex items-start justify-between">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-primary-600" />
                    <span className="font-medium text-gray-900">
                      {new Date(match.start_time).toLocaleDateString(undefined, {
                        weekday: "short",
                        day: "numeric",
                        month: "short",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  </div>
                  <p className="text-sm text-gray-500">{match.venues?.name}</p>
                  <span className="inline-block mt-1 px-2 py-0.5 bg-green-100 text-green-700 text-xs rounded-full font-medium">
                    {t("match.statusConfirmed", "Confirmado")}
                  </span>
                </div>
                <div className="flex items-center gap-1 text-sm text-gray-600">
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
          <div className="text-center py-8 text-gray-400">
            {t("match.noMatches", "Você não está participando de nenhuma partida")}
          </div>
        )}
      </div>
    </div>
  );
}
