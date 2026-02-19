import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useEffect, useCallback } from "react";
import { adminListSessions, adminDeleteSession } from "../../server/admin";

export const Route = createFileRoute("/admin/")({
  component: AdminDashboard,
});

function useAdminSecret() {
  const [secret, setSecretState] = useState(() => {
    if (typeof window === "undefined") return "";
    return localStorage.getItem("movienightapp_admin_secret") ?? "";
  });

  function setSecret(s: string) {
    if (typeof window !== "undefined") {
      if (s) localStorage.setItem("movienightapp_admin_secret", s);
      else localStorage.removeItem("movienightapp_admin_secret");
    }
    setSecretState(s);
  }

  return { secret, setSecret };
}

function AdminDashboard() {
  const { secret, setSecret } = useAdminSecret();
  const [tempSecret, setTempSecret] = useState(secret);
  const [sessions, setSessions] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const loadSessions = useCallback(async () => {
    if (!secret) return;
    setLoading(true);
    setError(null);
    try {
      const data = await adminListSessions({ data: secret });
      setSessions(data.sessions);
    } catch (err: any) {
      setError(err?.message ?? "Failed to load sessions");
    } finally {
      setLoading(false);
    }
  }, [secret]);

  useEffect(() => {
    loadSessions();
  }, [loadSessions]);

  function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setSecret(tempSecret);
  }

  if (!secret) {
    return (
      <div className="page-centered">
        <div className="admin-login">
          <h1 className="title-large">Admin Access</h1>
          <form className="admin-login__form" onSubmit={handleLogin}>
            <div className="form-group">
              <label className="form-label">Admin Secret</label>
              <input
                type="password"
                className="form-input"
                placeholder="Enter admin secret..."
                value={tempSecret}
                onChange={(e) => setTempSecret(e.target.value)}
                autoFocus
              />
            </div>
            <button type="submit" className="btn btn-primary btn-full mt-2">
              Enter
            </button>
          </form>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="admin-page">
        <AdminNav onSignOut={() => setSecret("")} />
        <div className="admin-content">
          <div className="panel">
            <p className="text-danger label-mono">
              {error.includes("UNAUTHORIZED")
                ? "Invalid admin secret. Check your settings."
                : "Failed to load sessions."}
            </p>
            <button className="btn btn-secondary btn-sm mt-2" onClick={() => setSecret("")}>
              Re-enter Secret
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="admin-page">
      <AdminNav onSignOut={() => setSecret("")} />
      <div className="admin-content">
        <div className="admin-section-header">
          <h2 className="title-medium">Sessions</h2>
          <Link to="/admin/sessions/new" className="btn btn-primary">
            + New Session
          </Link>
        </div>

        {loading && (
          <div className="skeleton" style={{ height: 100 }} />
        )}

        {!loading && sessions.length === 0 && (
          <div className="panel" style={{ textAlign: "center", padding: "3rem" }}>
            <p className="label-mono text-muted">No sessions yet.</p>
            <Link to="/admin/sessions/new" className="btn btn-primary mt-2">
              Create First Session
            </Link>
          </div>
        )}

        <div className="session-list">
          {sessions.map((session) => (
            <SessionCard key={session.id} session={session} secret={secret} onDeleted={loadSessions} />
          ))}
        </div>
      </div>
    </div>
  );
}

function SessionCard({ session, secret, onDeleted }: { session: any; secret: string; onDeleted: () => void }) {
  const [deleting, setDeleting] = useState(false);
  const statusClass =
    session.status === "open" ? "badge-library" : session.status === "closed" ? "badge-requested" : "badge-nominated";

  async function handleDelete() {
    if (!confirm(`Delete session "${session.name}"? This cannot be undone and will remove all voters, movies, and votes.`)) return;
    setDeleting(true);
    try {
      await adminDeleteSession({ data: { secret, id: session.id } });
      onDeleted();
    } catch (err: any) {
      alert(err?.message ?? "Failed to delete session");
      setDeleting(false);
    }
  }

  return (
    <div className="session-card">
      <div className="session-card__header">
        <div>
          <h3 className="session-card__name title-medium">{session.name}</h3>
          <span className="label-mono text-muted">/vote/{session.slug}</span>
        </div>
        <span className={`badge ${statusClass}`}>{session.status}</span>
      </div>

      <div className="session-card__stats">
        <div className="session-stat">
          <span className="session-stat__value">{session.voterCount ?? 0}</span>
          <span className="label-mono">voters</span>
        </div>
        <div className="session-stat">
          <span className="session-stat__value">{session.movieCount ?? 0}</span>
          <span className="label-mono">films</span>
        </div>
        <div className="session-stat">
          <span className="session-stat__value">{session.totalVotes ?? 0}</span>
          <span className="label-mono">votes cast</span>
        </div>
        <div className="session-stat">
          <span className="session-stat__value">{session.votesPerVoter}</span>
          <span className="label-mono">votes/voter</span>
        </div>
      </div>

      <div className="session-card__footer">
        <span className="label-mono text-dim">
          Created {new Date(session.createdAt).toLocaleDateString()}
        </span>
        <div style={{ display: "flex", gap: "0.5rem" }}>
          <button
            className="btn btn-danger btn-sm"
            onClick={handleDelete}
            disabled={deleting}
          >
            {deleting ? "Deleting…" : "Delete"}
          </button>
          <Link to="/admin/sessions/$id" params={{ id: session.id }} className="btn btn-secondary btn-sm">
            Manage →
          </Link>
        </div>
      </div>
    </div>
  );
}

function AdminNav({ onSignOut }: { onSignOut: () => void }) {
  return (
    <nav className="admin-nav">
      <Link to="/admin" className="admin-nav__brand">
        <span className="label-mono">Movie Night</span>
        <span className="admin-nav__sep">·</span>
        <span className="label-mono text-muted">Admin</span>
      </Link>
      <button className="btn btn-secondary btn-sm" onClick={onSignOut}>
        Sign Out
      </button>
    </nav>
  );
}
