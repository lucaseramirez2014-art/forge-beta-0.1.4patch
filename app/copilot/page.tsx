"use client";

import { CopilotPanel } from "../../components/CopilotPanel";
import { ForgeNav } from "../../components/ForgeNav";
import { useForge } from "../../components/ForgeProvider";

export default function CopilotPage() {
  const { activeCampaign, activeQuests, player, data } = useForge();
  const completedLessons = activeQuests.filter((lesson) => lesson.status === "completed").map((lesson) => lesson.title);
  return <main className="min-h-screen pb-14"><ForgeNav /><div className="mx-auto max-w-3xl px-5 py-8 sm:px-8 sm:py-12"><p className="text-xs font-semibold uppercase tracking-[.18em] text-teal-300">AI Copilot test</p><h1 className="mt-3 text-3xl font-semibold tracking-tight text-white">Make your next session count.</h1><p className="mt-3 text-slate-400">A small server-backed test surface for FORGE Copilot. Your API key stays on the server.</p><div className="mt-8"><CopilotPanel currentCampaign={activeCampaign.title} currentStage={activeCampaign.stage} completedLessons={completedLessons} xp={player.xp} level={player.level} userGoal={data.onboarding.answers?.goalType} /></div></div></main>;
}
