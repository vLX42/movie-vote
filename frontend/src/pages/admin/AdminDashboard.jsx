import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import useSWR from 'swr';
import { useAdminSecret } from '../../hooks/useAdminSecret';
import { adminFetcher, adminPost } from '../../hooks/useApi';
import './Admin.css';

export default function AdminDashboard() {
  const { secret, setSecret } = useAdminSecret();
  const [tempSecret, setTempSecret] = useState(secret);

  const { data, error, mutate } = useSWR(
    secret ? '/api/admin/sessions' : null,
    adminFetcher(secret)
  );

  function handleLogin(e) {
    e.preventDefault();
    setSecret(tempSecret);
  }

  if (!secret) {
    return (
      <div className="admin-page page-centered">
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
                onChange={e => setTempSecret(e.target.value)}
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
        <AdminNav secret={secret} />
        <div className="admin-content">
          <div className="panel">
            <p className="text-danger label-mono">
              {error.status === 403
                ? 'Invalid admin secret. Check your settings.'
                : 'Failed to load sessions.'}
            </p>
            <button className="btn btn-secondary btn-sm mt-2" onClick={() => setSecret('')}>
              Re-enter Secret
            </button>
          </div>
        </div>
      </div>
    );
  }

  const sessions = data?.sessions || [];

  return (
    <div className="admin-page">
      <AdminNav secret={secret} />
      <div className="admin-content">
        <div className="admin-section-header">
          <h2 className="title-medium">Sessions</h2>
          <Link to="/admin/sessions/new" className="btn btn-primary">
            + New Session
          </Link>
        </div>

        {sessions.length === 0 && (
          <div className="panel" style={{ textAlign: 'center', padding: '3rem' }}>
            <p className="label-mono text-muted">No sessions yet.</p>
            <Link to="/admin/sessions/new" className="btn btn-primary mt-2">
              Create First Session
            </Link>
          </div>
        )}

        <div className="session-list">
          {sessions.map(session => (
            <SessionCard key={session.id} session={session} secret={secret} onMutate={mutate} />
          ))}
        </div>
      </div>
    </div>
  );
}

function SessionCard({ session, secret, onMutate }) {
  const statusClass = {
    open: 'badge-library',
    closed: 'badge-requested',
    archived: 'badge-nominated'
  }[session.status] || 'badge-nominated';

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
          <span className="session-stat__value">{session.voter_count || 0}</span>
          <span className="label-mono">voters</span>
        </div>
        <div className="session-stat">
          <span className="session-stat__value">{session.movie_count || 0}</span>
          <span className="label-mono">films</span>
        </div>
        <div className="session-stat">
          <span className="session-stat__value">{session.total_votes || 0}</span>
          <span className="label-mono">votes cast</span>
        </div>
        <div className="session-stat">
          <span className="session-stat__value">{session.votes_per_voter}</span>
          <span className="label-mono">votes/voter</span>
        </div>
      </div>

      <div className="session-card__footer">
        <span className="label-mono text-dim">
          Created {new Date(session.created_at).toLocaleDateString()}
        </span>
        <Link to={`/admin/sessions/${session.id}`} className="btn btn-secondary btn-sm">
          Manage →
        </Link>
      </div>
    </div>
  );
}

function AdminNav({ secret }) {
  const { clearSecret } = useAdminSecret();
  return (
    <nav className="admin-nav">
      <Link to="/admin" className="admin-nav__brand">
        <span className="label-mono">Movie Night</span>
        <span className="admin-nav__sep">·</span>
        <span className="label-mono text-muted">Admin</span>
      </Link>
      <button className="btn btn-secondary btn-sm" onClick={clearSecret}>
        Sign Out
      </button>
    </nav>
  );
}
