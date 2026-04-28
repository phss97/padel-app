import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { supabase } from "../lib/supabase";
import { useAuthStore } from "../stores/authStore";
import { ArrowLeft, MapPin, Building2, Home } from "lucide-react";

export default function CreateVenue() {
  const { id: groupId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const user = useAuthStore((state) => state.user);

  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [venueType, setVenueType] = useState<"public" | "private">("public");
  const [error, setError] = useState("");

  const createVenue = useMutation({
    mutationFn: async () => {
      if (!groupId || !user) throw new Error("Missing group or user");
      if (!name.trim()) throw new Error("Venue name is required");

      const { data, error: venueError } = await supabase
        .from("venues")
        .insert({
          group_id: groupId,
          name: name.trim(),
          address: address.trim() || null,
          type: venueType,
          created_by: user.id,
        })
        .select()
        .single();

      if (venueError) throw venueError;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["group-venues", groupId] });
      navigate(`/groups/${groupId}/matches/create`);
    },
    onError: (err: Error) => {
      setError(err.message);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    createVenue.mutate();
  };

  if (!groupId) return null;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="flex items-center gap-3 p-4">
          <button
            onClick={() => navigate(-1)}
            className="p-2 -ml-2 hover:bg-gray-100 rounded-lg"
          >
            <ArrowLeft className="w-5 h-5 text-gray-600" />
          </button>
          <h1 className="text-lg font-semibold text-gray-900">
            {t("venue.create", "Nova quadra")}
          </h1>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="p-4 space-y-6">
        {/* Name */}
        <div className="space-y-2">
          <label className="block text-sm font-medium text-gray-700">
            {t("venue.name", "Nome da quadra")}
          </label>
          <div className="relative">
            <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              required
              placeholder={t("venue.namePlaceholder", "Ex: Quadra 1")}
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full pl-10 pr-4 py-3 bg-white border border-gray-200 rounded-xl text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>
        </div>

        {/* Address */}
        <div className="space-y-2">
          <label className="block text-sm font-medium text-gray-700">
            {t("venue.address", "Endereço")}{" "}
            <span className="font-normal text-gray-400">
              ({t("match.optional", "opcional")})
            </span>
          </label>
          <div className="relative">
            <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder={t("venue.addressPlaceholder", "Ex: Rua das Palmeiras, 123")}
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              className="w-full pl-10 pr-4 py-3 bg-white border border-gray-200 rounded-xl text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>
        </div>

        {/* Type */}
        <div className="space-y-2">
          <label className="block text-sm font-medium text-gray-700">
            {t("venue.type", "Tipo")}
          </label>
          <div className="grid grid-cols-2 gap-3">
            {(
              [
                { key: "public" as const, label: t("venue.public", "Pública") },
                { key: "private" as const, label: t("venue.private", "Privada") },
              ] as { key: "public" | "private"; label: string }[]
            ).map((type) => (
              <button
                key={type.key}
                type="button"
                onClick={() => setVenueType(type.key)}
                className={`flex items-center justify-center gap-2 py-3 rounded-xl border-2 font-medium transition-all ${
                  venueType === type.key
                    ? "border-primary-500 bg-primary-50 text-primary-700"
                    : "border-gray-200 bg-white text-gray-600 hover:border-gray-300"
                }`}
              >
                <Home className="w-4 h-4" />
                {type.label}
              </button>
            ))}
          </div>
        </div>

        {error && (
          <div className="bg-red-50 rounded-lg p-3 text-red-700 text-sm">
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={createVenue.isPending}
          className="w-full py-3.5 bg-primary-600 text-white rounded-xl font-semibold disabled:opacity-50 hover:bg-primary-700 transition-colors"
        >
          {createVenue.isPending
            ? t("app.loading")
            : t("venue.create", "Criar quadra")}
        </button>
      </form>
    </div>
  );
}
