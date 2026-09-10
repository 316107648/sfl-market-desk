"use client";

import { useEffect, useState, type ReactNode } from "react";

type User = { id: string; email: string; name: string; plan: "free" | "vip" };

type Props = { children: ReactNode };

export default function AuthGate({ children }: Props) {
  const [user, setUser] = useState<User | null | undefined>(undefined);
  const [mode, setMode] = useState<"login" | "register">("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function loadMe() {
    try {
      const response = await fetch("/api/auth/me", { cache: "no-store" });
      const data = await response.json();
      setUser(data?.user ?? null);
    } catch {
      setUser(null);
    }
  }

  useEffect(() => { void loadMe(); }, []);

  async function submit() {
    setError("");
    setBusy(true);
    try {
      const response = await fetch(`/api/auth/${mode === "login" ? "login" : "register"}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name, email, password }),
      });
      const data = await response.json();
      if (!response.ok || !data?.ok) throw new Error(data?.error || "Não foi possível entrar.");
      setUser(data.user);
      setPassword("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível entrar.");
    } finally {
      setBusy(false);
    }
  }

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" }).catch(() => undefined);
    setUser(null);
  }

  if (user === undefined) {
    return <div className="auth-loading">Carregando sua conta...</div>;
  }

  if (!user) {
    return (
      <main className="auth-page">
        <section className="auth-card">
          <div className="auth-brand">🌻</div>
          <p className="auth-kicker">SUNFLOWER MARKET PRO</p>
          <h1>{mode === "login" ? "Entrar na sua conta" : "Criar conta"}</h1>
          <p className="auth-copy">Seus dados da Land, temporada e análises ficam vinculados à sua conta na nuvem.</p>

          {mode === "register" && (
            <label>Nome<input value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" /></label>
          )}
          <label>E-mail<input type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" /></label>
          <label>Senha<input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete={mode === "login" ? "current-password" : "new-password"} onKeyDown={(e) => { if (e.key === "Enter") void submit(); }} /></label>
          {mode === "register" && <small className="auth-hint">Use pelo menos 8 caracteres.</small>}
          {error && <div className="auth-error">{error}</div>}
          <button className="auth-primary" disabled={busy} onClick={() => void submit()}>{busy ? "Aguarde..." : mode === "login" ? "Entrar" : "Criar conta"}</button>
          <button className="auth-switch" onClick={() => { setMode(mode === "login" ? "register" : "login"); setError(""); }}>
            {mode === "login" ? "Ainda não tenho conta" : "Já tenho uma conta"}
          </button>
          <p className="auth-security">A sessão fica em cookie HttpOnly. A Farm API Key não é salva pela área de login.</p>
        </section>
      </main>
    );
  }

  return (
    <div className="authenticated-app">
      <div className="account-strip">
        <span><strong>{user.name}</strong><small>{user.plan === "vip" ? "VIP" : "FREE"}</small></span>
        <button onClick={() => void logout()}>Sair</button>
      </div>
      {children}
    </div>
  );
}
