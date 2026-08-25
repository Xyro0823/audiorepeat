import type { Metadata } from "next";
import "@/lib/i18n/register/player";
import "@/lib/i18n/register/challenge";
import "@/lib/i18n/register/stats";
import PlayerView from "@/components/player/PlayerView";

export const metadata: Metadata = {
  title: "Player",
};

export default async function PlayerPage({
  searchParams,
}: {
  searchParams: Promise<{ id?: string }>;
}) {
  const { id } = await searchParams;
  return <PlayerView setId={id ?? null} />;
}
