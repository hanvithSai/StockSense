import type { Metadata } from "next";
import { LandingPage } from "@/components/landing/landing-page";
import { getCurrentUser } from "@/server/auth/session";
import { getLandingStats } from "@/server/services/landing";

export const metadata: Metadata = {
  title: "StockSense · Real-time inventory management",
};

export default async function Home() {
  // The landing page stays available even if the database is unreachable.
  const [user, stats] = await Promise.all([getCurrentUser().catch(() => null), getLandingStats().catch(() => null)]);
  return <LandingPage signedIn={Boolean(user)} stats={stats} demo={process.env.NEXT_PUBLIC_DEMO_MODE === "true"} />;
}
