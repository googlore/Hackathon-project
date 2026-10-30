"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { useRoomRealtime } from "@/lib/use-room-realtime";
import type { ArenaCase, Challenge, GuestSession, RoomState, RoomSummary, SolutionStep } from "@/types/platform";
import "@/styles/arena.css";

type StoredSession = Pick<GuestSession, "access_token" | "refresh_token" | "expires_in" | "user">;
type Modal = "case" | "challenge" | "defence" | null;

const sessionKey = "ai-challenge-arena.session";

function messageFrom(response: Response, fallback: string) {
  return response.json().then((body) => body?.error?.message ?? fallback).catch(() => fallback);
}

export function ArenaApp() {
  const [session, setSession] = useState<StoredSession | null>(null);
  const [roomId, setRoomId] = useState<string | null>(null);
  const [snapshot, setSnapshot] = useState<RoomState | null>(null);
  const [selectedStepId, setSelectedStepId] = useState<string | null>(null);
  const [selectedChallengeId, setSelectedChallengeId] = useState<string | null>(null);
  const [modal, setModal] = useState<Modal>(null);
  const [notice, setNotice] = useState("Creating your private guest session…");
  const [busy, setBusy] = useState(false);
  const live = useRoomRealtime(roomId, session?.access_token ?? null);
  const room = live.room ?? snapshot;
  const currentCase = room?.cases.find((item) => item.status === "open") ?? room?.cases[0] ?? null;
  const steps = useMemo(() => currentCase?.steps ?? [], [currentCase]);
  const selectedStep = useMemo(() => steps.find((item) => item.id === selectedStepId) ?? steps[0] ?? null, [steps, selectedStepId]);
  const selectedChallenge = useMemo(() => selectedStep?.challenges.find((item) => item.id === selectedChallengeId) ?? selectedStep?.challenges[0] ?? null, [selectedStep, selectedChallengeId]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const saved = window.localStorage.getItem(sessionKey);
      if (saved) {
        try {
          setSession(JSON.parse(saved) as StoredSession);
          setNotice("Guest session restored. Create a room or join with a code.");
          return;
        } catch { window.localStorage.removeItem(sessionKey); }
      }
      void (async () => {
        try {
          const response = await fetch("/api/auth/guest", { method: "POST", cache: "no-store" });
          if (!response.ok) throw new Error(await messageFrom(response, "Could not start a guest session."));
          const created = await response.json() as GuestSession;
          window.localStorage.setItem(sessionKey, JSON.stringify(created));
          setSession(created);
          setNotice("Guest session ready. Create a room or join with a code.");
        } catch (error) { setNotice(error instanceof Error ? error.message : "Could not start a guest session."); }
      })();
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    const errorMessage = live.error;
    if (!errorMessage) return;
    const timer = window.setTimeout(() => setNotice(errorMessage), 0);
    return () => window.clearTimeout(timer);
  }, [live.error]);

  async function api(path: string, init: RequestInit = {}) {
    if (!session) throw new Error("Your guest session is still starting.");
    const response = await fetch(path, {
      ...init,
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}`, ...init.headers },
      cache: "no-store",
    });
    if (!response.ok) throw new Error(await messageFrom(response, "The room could not be updated."));
    return response;
  }

  async function loadRoom(id: string) {
    const response = await api(`/api/rooms/${encodeURIComponent(id)}`);
    const payload = await response.json() as { room: RoomState };
    setSnapshot(payload.room);
    setRoomId(id);
    setNotice(`You are in ${payload.room.name}. ${payload.room.role === "host" ? "You can settle challenges." : "Pick a step to challenge."}`);
  }

  async function createRoom(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    try {
      const form = new FormData(event.currentTarget);
      const response = await api("/api/rooms", { method: "POST", body: JSON.stringify({
        name: form.get("name"), displayName: form.get("displayName"), subject: form.get("subject"), topic: form.get("topic"),
      }) });
      const payload = await response.json() as { room: RoomSummary };
      await loadRoom(payload.room.id);
    } catch (error) { setNotice(error instanceof Error ? error.message : "Could not create the room."); }
    finally { setBusy(false); }
  }

  async function joinRoom(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    try {
      const form = new FormData(event.currentTarget);
      const response = await api("/api/rooms/join", { method: "POST", body: JSON.stringify({ code: form.get("code"), displayName: form.get("displayName") }) });
      const payload = await response.json() as { room: RoomSummary };
      await loadRoom(payload.room.id);
    } catch (error) { setNotice(error instanceof Error ? error.message : "Could not join the room."); }
    finally { setBusy(false); }
  }

  async function submitCase(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!roomId) return;
    setBusy(true);
    try {
      const form = new FormData(event.currentTarget);
      const rawAnswer = String(form.get("answer") ?? "").trim();
      const steps = rawAnswer.split(/\n\s*\n/).map((content) => content.trim()).filter(Boolean).map((content) => ({ content }));
      if (!steps.length) throw new Error("Add at least one answer step, separated by a blank line.");
      await api(`/api/rooms/${roomId}/cases`, { method: "POST", body: JSON.stringify({ prompt: form.get("prompt"), source: form.get("source"), steps }) });
      setModal(null); setNotice("Case published. The room can now challenge individual steps.");
    } catch (error) { setNotice(error instanceof Error ? error.message : "Could not publish the case."); }
    finally { setBusy(false); }
  }

  async function submitChallenge(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedStep) return;
    setBusy(true);
    try {
      const form = new FormData(event.currentTarget);
      const correction = String(form.get("correction") ?? "").trim();
      const verification = String(form.get("verification") ?? "").trim();
      if (!correction && !verification) throw new Error("Add a correction or verification.");
      await api(`/api/steps/${selectedStep.id}/challenges`, { method: "POST", body: JSON.stringify({ claim: form.get("claim"), correction, verification }) });
      setModal(null); setNotice("Challenge posted. The host will settle it after review.");
    } catch (error) { setNotice(error instanceof Error ? error.message : "Could not post the challenge."); }
    finally { setBusy(false); }
  }

  async function submitDefence(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedChallenge) return;
    setBusy(true);
    try {
      const form = new FormData(event.currentTarget);
      await api(`/api/challenges/${selectedChallenge.id}/defences`, { method: "POST", body: JSON.stringify({ body: form.get("body") }) });
      setModal(null); setNotice("Defence posted for the host to consider.");
    } catch (error) { setNotice(error instanceof Error ? error.message : "Could not post the defence."); }
    finally { setBusy(false); }
  }

  async function settle(verdict: "upheld" | "rejected") {
    if (!selectedChallenge) return;
    setBusy(true);
    try {
      await api(`/api/challenges/${selectedChallenge.id}/verdict`, { method: "POST", body: JSON.stringify({ verdict }) });
      setNotice(`Challenge ${verdict}. The leaderboard will update for everyone.`);
    } catch (error) { setNotice(error instanceof Error ? error.message : "Could not settle the challenge."); }
    finally { setBusy(false); }
  }

  if (!room) return <Lobby busy={busy || !session} notice={notice} onCreate={createRoom} onJoin={joinRoom} />;

  return <><Arena room={room} currentCase={currentCase} selectedStep={selectedStep} selectedChallenge={selectedChallenge} busy={busy} notice={notice}
    onSelectStep={(step) => { setSelectedStepId(step.id); setSelectedChallengeId(step.challenges[0]?.id ?? null); }} onChallenge={() => setModal("challenge")}
    onCase={() => setModal("case")} onDefence={() => setModal("defence")} onSettle={settle} />
    {modal === "case" && <CaseModal busy={busy} onClose={() => setModal(null)} onSubmit={submitCase} />}
    {modal === "challenge" && selectedStep && <ChallengeModal step={selectedStep} busy={busy} onClose={() => setModal(null)} onSubmit={submitChallenge} />}
    {modal === "defence" && selectedChallenge && <DefenceModal challenge={selectedChallenge} busy={busy} onClose={() => setModal(null)} onSubmit={submitDefence} />}
  </>;
}

function Lobby({ busy, notice, onCreate, onJoin }: { busy: boolean; notice: string; onCreate: (event: FormEvent<HTMLFormElement>) => void; onJoin: (event: FormEvent<HTMLFormElement>) => void }) {
  return <main className="arena lobby"><header className="topbar"><span className="brand"><span className="brand-mark">A</span> AI Challenge Arena</span></header><section className="lobby-hero"><p className="eyebrow">A-level reasoning arena</p><h1>Challenge an answer.<br />Defend your reasoning.</h1><p>{notice}</p></section><section className="lobby-grid"><form className="setup-card" onSubmit={onCreate}><span className="eyebrow">START A ROOM</span><h2>Host a challenge</h2><label>Room name<input name="name" defaultValue="Proof Lab" required maxLength={80} /></label><label>Your display name<input name="displayName" placeholder="Teacher" required maxLength={40} /></label><label>Subject<input name="subject" defaultValue="Mathematics" maxLength={80} /></label><label>Topic<input name="topic" defaultValue="Inequalities" maxLength={120} /></label><button className="primary" disabled={busy}>{busy ? "Starting…" : "Create private room"}</button></form><form className="setup-card" onSubmit={onJoin}><span className="eyebrow">HAVE A CODE?</span><h2>Join a room</h2><label>Six-character room code<input className="code-input" name="code" placeholder="F8K2QX" required minLength={6} maxLength={6} /></label><label>Your display name<input name="displayName" placeholder="Nadia" required maxLength={40} /></label><button className="primary secondary" disabled={busy}>{busy ? "Joining…" : "Join challenge"}</button></form></section></main>;
}

function Arena({ room, currentCase, selectedStep, selectedChallenge, busy, notice, onSelectStep, onChallenge, onCase, onDefence, onSettle }: { room: RoomState; currentCase: ArenaCase | null; selectedStep: SolutionStep | null; selectedChallenge: Challenge | null; busy: boolean; notice: string; onSelectStep: (step: SolutionStep) => void; onChallenge: () => void; onCase: () => void; onDefence: () => void; onSettle: (verdict: "upheld" | "rejected") => void }) {
  return <main className="arena"><header className="topbar"><span className="brand"><span className="brand-mark">A</span> AI Challenge Arena</span><div className="room-code"><span>Room code</span><strong>{room.code}</strong></div><div className="profile"><span className="avatar avatar-you">{room.role === "host" ? "HO" : "YO"}</span><span>{room.role === "host" ? "Host" : "Participant"}</span></div></header><section className="room-header"><div><p className="eyebrow">{room.subject ?? "Classroom challenge"} · {room.topic ?? "reasoning"}</p><h1>{room.name} <span className="live"><i /> Live</span></h1><p className="room-copy">Challenge an exact step. The host makes the final verdict.</p></div><button className="primary" onClick={onCase}>+ Submit a case</button></section><div className="notice" role="status"><span className="pulse" />{notice}</div><div className="workspace"><section className="case-panel">{!currentCase ? <div className="empty-case"><span className="eyebrow">THE ROOM IS READY</span><h2>No case yet</h2><p>Paste an AI response, split it into steps, then invite the room to challenge it.</p><button className="primary" onClick={onCase}>Submit the first case</button></div> : <CaseView arenaCase={currentCase} selectedStep={selectedStep} selectedChallenge={selectedChallenge} host={room.role === "host"} busy={busy} onSelectStep={onSelectStep} onChallenge={onChallenge} onDefence={onDefence} onSettle={onSettle} />}</section><Leaderboard room={room} /></div></main>;
}

function CaseView({ arenaCase, selectedStep, selectedChallenge, host, busy, onSelectStep, onChallenge, onDefence, onSettle }: { arenaCase: ArenaCase; selectedStep: SolutionStep | null; selectedChallenge: Challenge | null; host: boolean; busy: boolean; onSelectStep: (step: SolutionStep) => void; onChallenge: () => void; onDefence: () => void; onSettle: (verdict: "upheld" | "rejected") => void }) {
  return <><div className="case-topline"><span className="case-number">LIVE CASE</span><span className="status-chip">{arenaCase.status}</span></div><div className="question-block"><span className="question-label">QUESTION</span><p>{arenaCase.prompt}</p></div><div className="source-row"><span className="spark">✦</span> Answer pasted from <strong>{arenaCase.source ?? "an AI service"}</strong><span className="source-dot">·</span><span>submitted by {arenaCase.authorName}</span></div><div className="answer-title"><div><span className="answer-kicker">AI RESPONSE</span><h2>Proposed reasoning</h2></div><span className="step-count">{arenaCase.steps.length} steps</span></div><div className="steps">{arenaCase.steps.map((step) => <article className={`step ${selectedStep?.id === step.id ? "selected" : ""}`} key={step.id}><button className="step-select" onClick={() => onSelectStep(step)}><span>{step.position}</span></button><div className="step-content"><p>{step.content}</p>{step.challenges.map((challenge) => <button className="challenge-summary" key={challenge.id} onClick={() => onSelectStep(step)}><span className="alert-dot">!</span><strong>{challenge.status}</strong><span>{challenge.claim}</span></button>)}</div><button className="challenge-link" onClick={() => { onSelectStep(step); onChallenge(); }}>Challenge</button></article>)}</div>{selectedChallenge && <section className="review-panel"><span className="eyebrow">SELECTED CHALLENGE · {selectedChallenge.status}</span><p><strong>{selectedChallenge.authorName}:</strong> {selectedChallenge.claim}</p>{selectedChallenge.correction && <p><b>Correction:</b> {selectedChallenge.correction}</p>}{selectedChallenge.verification && <p><b>Verification:</b> {selectedChallenge.verification}</p>}{selectedChallenge.defences.map((item) => <p key={item.id} className="defence"><b>{item.authorName} defended:</b> {item.body}</p>)}<div className="review-actions"><button className="text-button" onClick={onDefence}>Defend</button>{host && selectedChallenge.status === "open" && <><button className="reject" disabled={busy} onClick={() => onSettle("rejected")}>Reject</button><button className="primary" disabled={busy} onClick={() => onSettle("upheld")}>Uphold</button></>}</div></section>}</>;
}

function Leaderboard({ room }: { room: RoomState }) { return <aside className="side-panel"><section className="leader-card"><div className="card-heading"><div><span className="eyebrow">THIS ROOM</span><h2>Leaderboard</h2></div></div><ol className="leaders">{room.leaderboard.map((entry, index) => <li key={entry.userId}><span className="rank">{index + 1}</span><span className={`avatar avatar-${index}`}>{entry.displayName.slice(0, 2).toUpperCase()}</span><strong>{entry.displayName}</strong><span className="points">{entry.points} <small>pts</small></span></li>)}</ol>{room.leaderboard.length === 0 && <p className="points-note">Points appear after the host settles a challenge.</p>}</section><section className="how-card"><span className="help-icon">?</span><div><strong>Make a strong challenge</strong><p>Name the exact error, then add a correction or verification.</p></div></section></aside>; }

function Overlay({ children, onClose }: { children: React.ReactNode; onClose: () => void }) { return <div className="overlay"><section className="challenge-modal" role="dialog" aria-modal="true"><button className="close" onClick={onClose} aria-label="Close">×</button>{children}</section></div>; }
function CaseModal({ busy, onClose, onSubmit }: { busy: boolean; onClose: () => void; onSubmit: (event: FormEvent<HTMLFormElement>) => void }) { return <Overlay onClose={onClose}><span className="eyebrow">NEW CASE</span><h2>Paste an AI response</h2><form onSubmit={onSubmit}><label>Question<textarea name="prompt" required minLength={1} maxLength={4000} placeholder="What did you ask the AI?" /></label><label>AI source <input name="source" maxLength={120} placeholder="Gemini, ChatGPT, or another service" /></label><label>Answer steps <textarea name="answer" required placeholder="Paste the answer here. Separate each step with a blank line." /></label><div className="form-actions"><button type="button" className="text-button" onClick={onClose}>Cancel</button><button className="primary" disabled={busy}>Publish case</button></div></form></Overlay>; }
function ChallengeModal({ step, busy, onClose, onSubmit }: { step: SolutionStep; busy: boolean; onClose: () => void; onSubmit: (event: FormEvent<HTMLFormElement>) => void }) { return <Overlay onClose={onClose}><span className="eyebrow">CHALLENGE STEP {step.position}</span><h2>What is wrong here?</h2><p className="quoted-step">“{step.content}”</p><form onSubmit={onSubmit}><label>Specific error claim<textarea name="claim" required minLength={10} maxLength={2000} placeholder="Explain the exact reasoning error…" /></label><div className="form-row"><label>Correction <input name="correction" maxLength={2000} placeholder="What should it say instead?" /></label><label>Verification <input name="verification" maxLength={2000} placeholder="Counterexample or calculation" /></label></div><div className="form-actions"><button type="button" className="text-button" onClick={onClose}>Cancel</button><button className="primary" disabled={busy}>Post challenge</button></div></form></Overlay>; }
function DefenceModal({ challenge, busy, onClose, onSubmit }: { challenge: Challenge; busy: boolean; onClose: () => void; onSubmit: (event: FormEvent<HTMLFormElement>) => void }) { return <Overlay onClose={onClose}><span className="eyebrow">DEFEND THE ANSWER</span><h2>Respond to the challenge</h2><p className="quoted-step">“{challenge.claim}”</p><form onSubmit={onSubmit}><label>Your defence<textarea name="body" required minLength={1} maxLength={2000} placeholder="Explain why the original step or claim still holds…" /></label><div className="form-actions"><button type="button" className="text-button" onClick={onClose}>Cancel</button><button className="primary" disabled={busy}>Post defence</button></div></form></Overlay>; }
