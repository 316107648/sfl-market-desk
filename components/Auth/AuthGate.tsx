"use client";

import { useEffect, useState, type ReactNode } from "react";

type User = { id: string; email: string; name: string; plan: "free" | "vip" };

type Props = { children: ReactNode };

export default function AuthGate({ children }: Props) {
  const [user, setUser] = useState<User | null | undefined>(undefined);
  const [mode, setMode] = useState<"login" | "register" | "forgot" | "reset">("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [resetToken, setResetToken] = useState("");
  const [success, setSuccess] = useState("");

  async function loadMe() {
    try {
      const response = await fetch("/api/auth/me", { cache: "no-store" });
      const data = await response.json();
      setUser(data?.user ?? null);
    } catch {
      setUser(null);
    }
  }

  useEffect(() => {
    const token = new URLSearchParams(window.location.search).get("reset_token") ?? "";
    if (token) {
      setResetToken(token);
      setMode("reset");
    }
    void loadMe();
  }, []);

  async function requestPasswordReset() {
    setError("");
    setSuccess("");
    setBusy(true);
    try {
      const response = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await response.json();
      if (!response.ok || !data?.ok) throw new Error(data?.error || "Não foi possível enviar o e-mail.");
      setSuccess("Se este e-mail estiver cadastrado, você receberá um link para redefinir a senha.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível enviar o e-mail.");
    } finally {
      setBusy(false);
    }
  }

  async function resetPassword() {
    setError("");
    setSuccess("");
    setBusy(true);
    try {
      const response = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ token: resetToken, password }),
      });
      const data = await response.json();
      if (!response.ok || !data?.ok) throw new Error(data?.error || "Não foi possível redefinir a senha.");
      setSuccess("Senha alterada com sucesso. Agora você já pode entrar.");
      setPassword("");
      window.history.replaceState({}, "", window.location.pathname);
      setMode("login");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível redefinir a senha.");
    } finally {
      setBusy(false);
    }
  }

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
          <h1>{mode === "login" ? "Entrar na sua conta" : mode === "register" ? "Criar conta" : mode === "forgot" ? "Recuperar senha" : "Criar nova senha"}</h1>
          <p className="auth-copy">Seus dados da Land, temporada e análises ficam vinculados à sua conta na nuvem.</p>

          {mode === "register" && (
            <label>Nome<input value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" /></label>
          )}
          {mode !== "reset" && <label>E-mail<input type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" /></label>}
          {(mode === "login" || mode === "register" || mode === "reset") && (
            <label>Senha<input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete={mode === "login" ? "current-password" : "new-password"} onKeyDown={(e) => { if (e.key === "Enter") { if (mode === "reset") void resetPassword(); else void submit(); } }} /></label>
          )}
          {(mode === "register" || mode === "reset") && <small className="auth-hint">Use pelo menos 8 caracteres.</small>}
          {error && <div className="auth-error">{error}</div>}
          {success && <div className="farm-message">{success}</div>}
          {mode === "forgot" ? (
            <button className="auth-primary" disabled={busy} onClick={() => void requestPasswordReset()}>{busy ? "Aguarde..." : "Enviar link de recuperação"}</button>
          ) : mode === "reset" ? (
            <button className="auth-primary" disabled={busy} onClick={() => void resetPassword()}>{busy ? "Aguarde..." : "Salvar nova senha"}</button>
          ) : (
            <button className="auth-primary" disabled={busy} onClick={() => void submit()}>{busy ? "Aguarde..." : mode === "login" ? "Entrar" : "Criar conta"}</button>
          )}
          {mode === "login" && <button className="auth-switch" onClick={() => { setMode("forgot"); setError(""); setSuccess(""); }}>Esqueci minha senha</button>}
          <button className="auth-switch" onClick={() => { setMode(mode === "login" ? "register" : "login"); setError(""); setSuccess(""); }}>
            {mode === "login" ? "Ainda não tenho conta" : "Voltar para entrar"}
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
