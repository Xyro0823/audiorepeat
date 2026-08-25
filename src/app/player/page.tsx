import { registerRoute } from "@/lib/i18n/register/route";
registerRoute("player");
import type { Metadata } from "next";
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
