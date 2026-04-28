import type { Group } from "../types";

export function calculateMaxPlayers(
  startTime: string | Date,
  endTime: string | Date,
  group: Group
): number {
  const start = new Date(startTime);
  const end = new Date(endTime);
  const hours = (end.getTime() - start.getTime()) / (1000 * 3600);

  if (hours < 2) return group.max_players_1h;
  if (hours < 3) return group.max_players_2h;
  return group.max_players_3h_plus;
}

export function getDurationLabel(
  hours: number,
  t: (key: string) => string
): string {
  if (hours < 2) return t("match.duration1h");
  if (hours < 3) return t("match.duration2h");
  return t("match.duration3h");
}

export function getConfirmedCount(
  match: { match_players?: { status: string }[] }
): number {
  return match.match_players?.filter((p) => p.status === "confirmed").length || 0;
}
