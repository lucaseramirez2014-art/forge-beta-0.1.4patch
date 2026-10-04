"use client";

import { FormEvent, useState } from "react";

type Props = { currentCampaign: string; currentStage: string; completedLessons: string[]; xp: number; level: number; userGoal?: string };
type Result = { reply: string; recommendedLesson: string | null; reason: string };

export function CopilotPanel(context: Props) {
  const [message, setMessage] = useState("I have 30 minutes today. What should I work on?");
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!message.trim() || loading) return;
    setLoading(true); setError(""); setResult(null);
    try {
      const response = await fetch("/api/ai/copilot", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...context, message: message.trim() }) });
      const body = await response.json() as Result & { error?: string };
      if (!response.ok) throw new Error(body.error || "Copilot could not respond.");
      setResult(body);
    } catch (requestError) { setError(requestError instanceof Error ? requestError.message : "Copilot could not respond."); }
    finally { setLoading(false); }
  }

  return <section className="rounded-2xl border border-teal-400/20 bg-[#101c2a] p-5" aria-labelledby="copilot-title"><div><p className="text-xs font-semibold uppercase tracking-[.16em] text-teal-300">FORGE Copilot · beta</p><h2 id="copilot-title" className="mt-2 text-xl font-semibold text-white">Ask for your next move</h2><p className="mt-1 text-sm text-slate-400">Uses your active campaign and saved lesson progress. It does not change your progress.</p></div><form onSubmit={submit} className="mt-5"><label className="sr-only" htmlFor="copilot-message">Ask FORGE Copilot</label><textarea id="copilot-message" value={message} onChange={(event) => setMessage(event.target.value)} maxLength={1200} rows={3} className="w-full resize-y rounded-xl border border-slate-700 bg-slate-900 px-3 py-2.5 text-sm text-white outline-none focus:border-teal-400" placeholder="Ask what to work on next…" /><button disabled={loading || !message.trim()} className="mt-3 rounded-xl bg-teal-400 px-4 py-2.5 text-sm font-bold text-slate-950 transition hover:bg-teal-300 disabled:cursor-not-allowed disabled:opacity-50">{loading ? "Thinking…" : "Ask Copilot"}</button></form>{error && <p className="mt-4 rounded-xl border border-red-400/25 bg-red-400/10 p-3 text-sm text-red-200" role="alert">{error}</p>}{result && <article className="mt-5 rounded-xl border border-slate-700 bg-slate-900/60 p-4"><p className="text-sm leading-6 text-slate-100">{result.reply}</p>{result.recommendedLesson && <p className="mt-3 text-sm font-semibold text-teal-200">Recommended lesson · {result.recommendedLesson}</p>}<p className="mt-2 text-xs leading-5 text-slate-400">{result.reason}</p></article>}</section>;
}
