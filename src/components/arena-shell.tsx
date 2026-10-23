"use client";

import { FormEvent, useMemo, useState } from "react";
import "@/styles/arena.css";

type Challenge = {
  author: string;
  label: "Open" | "Upheld" | "Rejected";
  text: string;
};

type Step = {
  id: number;
  text: string;
  challenges: Challenge[];
};

const initialSteps: Step[] = [
  { id: 1, text: "Since abc = 1, we may write c = 1/(ab).", challenges: [] },
  { id: 2, text: "Therefore a + b + c is always greater than 1/a + 1/b + 1/c.", challenges: [{ author: "Nadia", label: "Open", text: "The condition alone does not fix the direction of this inequality." }] },
  { id: 3, text: "This proves the original claim for all positive a, b and c.", challenges: [] },
];

const leaders = [
  ["Nadia S.", 14, "NS"],
  ["You", 9, "YO"],
  ["Leo M.", 7, "LM"],
  ["Mina K.", 5, "MK"],
];

export function ArenaShell() {
  const [steps, setSteps] = useState(initialSteps);
  const [selectedStep, setSelectedStep] = useState<number | null>(2);
  const [showForm, setShowForm] = useState(false);
  const [notice, setNotice] = useState("Nadia challenged step 2 · just now");
  const selected = useMemo(() => steps.find((step) => step.id === selectedStep), [steps, selectedStep]);

  function submitChallenge(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedStep) return;
    const form = new FormData(event.currentTarget);
    const claim = String(form.get("claim") || "").trim();
    if (!claim) return;
    setSteps((current) => current.map((step) => step.id === selectedStep
      ? { ...step, challenges: [...step.challenges, { author: "You", label: "Open", text: claim }] }
      : step));
    setNotice(`Your challenge to step ${selectedStep} is now visible to the room`);
    setShowForm(false);
    event.currentTarget.reset();
  }

  return (
    <main className="arena">
      <header className="topbar">
        <a className="brand" href="#top" aria-label="AI Challenge Arena home"><span className="brand-mark">A</span> AI Challenge Arena</a>
        <div className="room-code"><span>Room code</span><strong>F8K2QX</strong><button aria-label="Copy room code">⧉</button></div>
        <div className="profile"><span className="avatar avatar-you">YO</span><span>You</span><span className="chevron">⌄</span></div>
      </header>

      <section className="room-header" id="top">
        <div>
          <p className="eyebrow">A-level Mathematics · inequalities</p>
          <h1>Proof Lab <span className="live"><i /> Live</span></h1>
          <p className="room-copy">Spot weak reasoning. Make your case. Help the room decide.</p>
        </div>
        <button className="primary" onClick={() => setNotice("New case editor will open when the platform route is connected.")}>+ Submit a case</button>
      </section>

      <div className="notice" role="status"><span className="pulse" />{notice}</div>

      <div className="workspace">
        <section className="case-panel" aria-label="Active AI answer case">
          <div className="case-topline"><span className="case-number">CASE 04</span><span className="status-chip">Open for challenge</span><button className="more" aria-label="More case actions">•••</button></div>
          <div className="question-block">
            <span className="question-label">QUESTION</span>
            <p>If <em>a</em><em>b</em><em>c</em> = 1, prove that <em>a</em> + <em>b</em> + <em>c</em> &gt; 1/<em>a</em> + 1/<em>b</em> + 1/<em>c</em>.</p>
          </div>
          <div className="source-row"><span className="spark">✦</span> Answer pasted from <strong>Gemini</strong><span className="source-dot">·</span><span>submitted by Leo M.</span></div>

          <div className="answer-title"><div><span className="answer-kicker">AI RESPONSE</span><h2>Proposed proof</h2></div><span className="step-count">3 steps</span></div>
          <div className="steps">
            {steps.map((step) => (
              <article className={`step ${selectedStep === step.id ? "selected" : ""}`} key={step.id}>
                <button className="step-select" onClick={() => { setSelectedStep(step.id); setShowForm(false); }} aria-label={`Select step ${step.id}`}>
                  <span>{step.id}</span>
                </button>
                <div className="step-content">
                  <p>{step.text}</p>
                  {step.challenges.length > 0 && <div className="challenge-summary"><span className="alert-dot">!</span><strong>{step.challenges.length} challenge{step.challenges.length > 1 ? "s" : ""}</strong><span>{step.challenges[0].text}</span></div>}
                </div>
                <button className="challenge-link" onClick={() => { setSelectedStep(step.id); setShowForm(true); }}>Challenge</button>
              </article>
            ))}
          </div>
        </section>

        <aside className="side-panel">
          <section className="leader-card">
            <div className="card-heading"><div><span className="eyebrow">THIS ROOM</span><h2>Leaderboard</h2></div><button className="view-all">View all</button></div>
            <ol className="leaders">
              {leaders.map(([name, points, initials], index) => <li key={name}><span className="rank">{index + 1}</span><span className={`avatar avatar-${index}`}>{initials}</span><strong>{name}</strong><span className="points">{points} <small>pts</small></span></li>)}
            </ol>
            <p className="points-note">Points come from host-settled verdicts only.</p>
          </section>

          <section className="how-card"><span className="help-icon">?</span><div><strong>Make a strong challenge</strong><p>Name the exact error, then add a correction or verification.</p></div><button aria-label="Dismiss advice">×</button></section>
        </aside>
      </div>

      {selected && <section className="action-dock" aria-label="Selected solution step"><div><span className="dock-label">STEP {selected.id} SELECTED</span><strong>{selected.challenges.length} open challenge{selected.challenges.length === 1 ? "" : "s"}</strong></div><div><button className="text-button" onClick={() => setNotice(`You are defending step ${selected.id}.`)}>Defend this step</button><button className="primary" onClick={() => setShowForm(true)}>Challenge this step</button></div></section>}

      {showForm && selected && <div className="overlay" role="presentation"><section className="challenge-modal" role="dialog" aria-modal="true" aria-labelledby="challenge-title"><button className="close" onClick={() => setShowForm(false)} aria-label="Close">×</button><span className="eyebrow">CHALLENGE STEP {selected.id}</span><h2 id="challenge-title">What is wrong here?</h2><p className="quoted-step">“{selected.text}”</p><form onSubmit={submitChallenge}><label htmlFor="claim">Specific error claim</label><textarea id="claim" name="claim" minLength={10} placeholder="Explain the exact reasoning error…" required /><div className="form-row"><label><span>Correction <em>optional</em></span><input name="correction" placeholder="What should it say instead?" /></label><label><span>Verification <em>optional</em></span><input name="verification" placeholder="Counterexample or calculation" /></label></div><div className="form-actions"><button type="button" className="text-button" onClick={() => setShowForm(false)}>Cancel</button><button className="primary" type="submit">Post challenge</button></div></form></section></div>}
    </main>
  );
}
