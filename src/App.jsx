import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "./supabase";

export default function App() {
  const [session, setSession] = useState(null);

  // auth
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  // data
  const [profiles, setProfiles] = useState([]);
  const [tasks, setTasks] = useState([]);

  // form
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [assigneeEmail, setAssigneeEmail] = useState("");

  const userId = session?.user?.id ?? null;
  const myEmail = session?.user?.email ?? "";

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_event, sess) => setSession(sess));
    return () => sub.subscription.unsubscribe();
  }, []);

  async function signUp() {
    const e = email.trim().toLowerCase();
    if (!e || !password) return alert("Anna email ja salasana.");
    const { error } = await supabase.auth.signUp({ email: e, password });
    if (error) return alert(error.message);
    alert("Käyttäjä luotu. Jos email-confirm on pois päältä, olet heti sisällä. Muuten kirjaudu sisään Sign in -napilla.");
  }

  async function signIn() {
    const e = email.trim().toLowerCase();
    if (!e || !password) return alert("Anna email ja salasana.");
    const { error } = await supabase.auth.signInWithPassword({ email: e, password });
    if (error) return alert(error.message);
  }

  async function signOut() {
    await supabase.auth.signOut();
    setTasks([]);
    setProfiles([]);
  }

  // ensure own profile exists
  useEffect(() => {
    if (!userId) return;
    (async () => {
      await supabase.from("profiles").upsert({ id: userId, email: myEmail }, { onConflict: "id" });
    })();
  }, [userId, myEmail]);

  async function refresh() {
    if (!userId) return;

    const p = await supabase.from("profiles").select("id,email").order("created_at", { ascending: false }).limit(200);
    if (p.error) alert(p.error.message);
    else setProfiles(p.data ?? []);

    const t = await supabase
      .from("tasks")
      .select("id,title,description,user_id,assigned_to,status,created_at,updated_at")
      .order("updated_at", { ascending: false });

    if (t.error) alert(t.error.message);
    else setTasks(t.data ?? []);
  }

  useEffect(() => {
    if (!userId) return;
    refresh();
  }, [userId]);

  const inbox = useMemo(() => tasks.filter((t) => t.assigned_to === userId), [tasks, userId]);
  const outbox = useMemo(() => tasks.filter((t) => t.user_id === userId), [tasks, userId]);

  async function createAndAssign() {
    if (!userId) return;

    const cleanTitle = title.trim();
    if (!cleanTitle) return alert("Anna otsikko.");

    let assignedTo = null;
    const cleanAssignee = assigneeEmail.trim().toLowerCase();

    if (cleanAssignee) {
      const match = profiles.find((p) => (p.email || "").toLowerCase() === cleanAssignee);
      if (!match) return alert("Vastaanottajan pitää kirjautua kerran sisään (jotta se näkyy käyttäjälistassa).");
      assignedTo = match.id;
    }

    const { data, error } = await supabase
      .from("tasks")
      .insert({
        title: cleanTitle,
        description: description.trim() || null,
        user_id: userId,
        assigned_to: assignedTo,
        status: "open",
      })
      .select()
      .single();

    if (error) return alert(error.message);

    setTasks((prev) => [data, ...prev]);
    setTitle("");
    setDescription("");
    setAssigneeEmail("");
  }

  async function setStatus(taskId, status) {
    const { data, error } = await supabase.from("tasks").update({ status }).eq("id", taskId).select().single();
    if (error) return alert(error.message);
    setTasks((prev) => prev.map((t) => (t.id === taskId ? data : t)));
  }

  if (!session) {
    return (
      <div style={page}>
        <h2>Kirjaudu</h2>

        <label>Sähköposti</label>
        <input style={inp} value={email} onChange={(e) => setEmail(e.target.value)} placeholder="nimi@domain.com" />

        <label>Salasana</label>
        <input
          style={inp}
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="väh. 6 merkkiä"
        />

        <div style={{ display: "flex", gap: 10 }}>
          <button style={btn} onClick={signIn}>Sign in</button>
          <button style={{ ...btn, background: "#eee", color: "#111" }} onClick={signUp}>Sign up</button>
        </div>

        <p style={{ marginTop: 10, opacity: 0.7, fontSize: 13 }}>
          Jos kirjautuminen ei onnistu heti sign upin jälkeen, käy Supabasessa ottamassa “Confirm email” pois (demoa varten).
        </p>
      </div>
    );
  }

  return (
    <div style={page}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center" }}>
        <div>
          <h2 style={{ margin: 0 }}>Tehtävät</h2>
          <div style={{ opacity: 0.7, fontSize: 13 }}>Kirjautunut: {myEmail}</div>
        </div>
        <button style={{ ...btn, background: "#eee", color: "#111", width: 120 }} onClick={signOut}>Ulos</button>
      </div>

      <div style={card}>
        <h3 style={{ marginTop: 0 }}>Luo tehtävä ja osoita toiselle</h3>

        <label>Otsikko</label>
        <input style={inp} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Esim. Tarkasta työmaa" />

        <label>Kuvaus (valinnainen)</label>
        <textarea style={{ ...inp, height: 80 }} value={description} onChange={(e) => setDescription(e.target.value)} />

        <label>Vastaanottajan sähköposti (valinnainen)</label>
        <input
          style={inp}
          value={assigneeEmail}
          onChange={(e) => setAssigneeEmail(e.target.value)}
          placeholder="kaveri@domain.com"
        />

        <button style={btn} onClick={createAndAssign}>Luo ja lähetä</button>

        <div style={{ marginTop: 10, fontSize: 13, opacity: 0.7 }}>
          Tunnetut käyttäjät: {profiles.map((p) => p.email).filter(Boolean).join(", ") || "—"}
        </div>

        <button style={{ ...btn, marginTop: 10, background: "#eee", color: "#111" }} onClick={refresh}>
          Päivitä lista
        </button>
      </div>

      <div style={grid}>
        <div style={card}>
          <h3 style={{ marginTop: 0 }}>Inbox (minulle osoitetut)</h3>
          {inbox.length === 0 ? (
            <div style={muted}>Ei vielä tehtäviä.</div>
          ) : (
            inbox.map((t) => <TaskRow key={t.id} t={t} onDone={() => setStatus(t.id, "done")} />)
          )}
        </div>

        <div style={card}>
          <h3 style={{ marginTop: 0 }}>Outbox (minun luomat)</h3>
          {outbox.length === 0 ? (
            <div style={muted}>Ei vielä tehtäviä.</div>
          ) : (
            outbox.map((t) => <TaskRow key={t.id} t={t} onDone={() => setStatus(t.id, "done")} />)
          )}
        </div>
      </div>
    </div>
  );
}

function TaskRow({ t, onDone }) {
  return (
    <div style={{ border: "1px solid #eee", borderRadius: 12, padding: 12, marginBottom: 10 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
        <strong>{t.title}</strong>
        <span style={{ opacity: 0.7 }}>{t.status}</span>
      </div>
      {t.description ? <div style={{ marginTop: 6, opacity: 0.8 }}>{t.description}</div> : null}
      <div style={{ marginTop: 10 }}>
        {t.status !== "done" ? (
          <button style={smallBtn} onClick={onDone}>Merkitse valmiiksi</button>
        ) : (
          <span style={{ opacity: 0.7 }}>Valmis ✅</span>
        )}
      </div>
    </div>
  );
}

const page = { fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, Arial", padding: 20, maxWidth: 900, margin: "0 auto" };
const grid = { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginTop: 14 };
const card = { border: "1px solid #eee", borderRadius: 16, padding: 14, background: "#fff" };
const inp = { width: "100%", padding: 10, borderRadius: 12, border: "1px solid #ddd", marginTop: 6, marginBottom: 10 };
const btn = { width: "100%", padding: 12, borderRadius: 12, border: "none", background: "#111", color: "white", cursor: "pointer" };
const smallBtn = { padding: "8px 10px", borderRadius: 10, border: "1px solid #ddd", background: "#fff", cursor: "pointer" };
const muted = { opacity: 0.7 };