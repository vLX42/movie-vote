import React, { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import useSWR from 'swr';
import { motion, AnimatePresence } from 'framer-motion';
import { useAdminSecret } from '../../hooks/useAdminSecret';
import { adminFetcher, adminPost, adminPatch, adminDelete } from '../../hooks/useApi';
import './Admin.css';

export default function SessionManager() {
  const { id } = useParams();
  const { secret } = useAdminSecret();
  const [activeTab, setActiveTab] = useState('overview');

  const { data, error, mutate } = useSWR(
    secret ? `/api/admin/sessions/${id}` : null,
    adminFetcher(secret)
  );

  const { data: treeData } = useSWR(
    secret && activeTab === 'tree' ? `/api/admin/sessions/${id}/tree` : null,
    adminFetcher(secret)
  );

  if (!secret) {
    return (
      <div className="admin-page page-centered">
        <p className="label-mono"><Link to="/admin">Login to admin</Link></p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="admin-page">
        <AdminHeader />
        <div className="admin-content">
          <p className="label-mono text-danger">Failed to load session.</p>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="admin-page">
        <AdminHeader />
        <div className="admin-content">
          <div className="skeleton" style={{ height: 200 }} />
        </div>
      </div>
    );
  }

  const { session, movies, voters, codes } = data;

  async function closeSession() {
    if (!confirm('Close voting and declare the winner?')) return;
    try {
      await adminPost(`/api/admin/sessions/${id}/close`, {}, secret);
      mutate();
    } catch (err) {
      alert(err.message);
    }
  }

  async function generateMoreCodes(count) {
    try {
      const res = await adminPost(`/api/admin/sessions/${id}/invite-codes`, { count }, secret);
      alert(`Generated ${res.codes.length} new code(s):\n${res.codes.map(c => c.url).join('\n')}`);
      mutate();
    } catch (err) {
      alert(err.message);
    }
  }

  async function revokeCode(code) {
    if (!confirm(`Revoke invite code ${code}?`)) return;
    try {
      await adminPost(`/api/admin/invite-codes/${code}/revoke`, {}, secret);
      mutate();
    } catch (err) {
      alert(err.message);
    }
  }

  async function removeVoter(voterId, name) {
    if (!confirm(`Remove voter ${name}? Their votes will remain.`)) return;
    try {
      await adminDelete(`/api/admin/voters/${voterId}`, secret);
      mutate();
    } catch (err) {
      alert(err.message);
    }
  }

  async function adjustSlots(voterId, current) {
    const newSlots = prompt(`Current slots: ${current}\nNew invite slots:`, current);
    if (newSlots === null) return;
    try {
      await adminPatch(`/api/admin/voters/${voterId}/invites`, { inviteSlotsRemaining: parseInt(newSlots) }, secret);
      mutate();
    } catch (err) {
      alert(err.message);
    }
  }

  const winnerMovie = session.winner_movie_id ? movies.find(m => m.id === session.winner_movie_id) : null;

  return (
    <div className="admin-page">
      <AdminHeader sessionName={session.name} />
      <div className="admin-content">
        {/* Session overview */}
        <div className="session-overview">
          <div className="session-overview__info">
            <h2 className="title-medium">{session.name}</h2>
            <span className="label-mono text-muted">/vote/{session.slug}</span>
            <span className={`badge ${session.status === 'open' ? 'badge-library' : 'badge-requested'}`}>
              {session.status}
            </span>
          </div>

          <div className="session-overview__stats">
            <Stat value={voters.length} label="Voters" />
            <Stat value={movies.length} label="Films" />
            <Stat value={codes.filter(c => c.status === 'unused').length} label="Open Codes" />
            <Stat value={session.votes_per_voter} label="Votes/Voter" />
          </div>

          <div className="session-overview__actions">
            {session.status === 'open' && (
              <button className="btn btn-danger" onClick={closeSession}>
                Close Voting
              </button>
            )}
            <button className="btn btn-secondary btn-sm" onClick={() => generateMoreCodes(1)}>
              + Invite Code
            </button>
            <Link to={`/vote/${session.slug}`} className="btn btn-secondary btn-sm" target="_blank">
              Open Room ↗
            </Link>
          </div>
        </div>

        {winnerMovie && (
          <div className="panel" style={{ borderColor: 'var(--accent-yellow)', marginBottom: '1rem' }}>
            <span className="label-mono text-yellow">Winner: </span>
            <strong className="title-medium"> {winnerMovie.title}</strong>
            {winnerMovie.year && <span className="label-mono text-muted"> ({winnerMovie.year})</span>}
          </div>
        )}

        {/* Tabs */}
        <div className="admin-tabs">
          {['overview', 'movies', 'voters', 'codes', 'tree'].map(tab => (
            <button
              key={tab}
              className={`admin-tab ${activeTab === tab ? 'active' : ''}`}
              onClick={() => setActiveTab(tab)}
            >
              <span className="label-mono">{tab}</span>
            </button>
          ))}
        </div>

        {/* Tab content */}
        {activeTab === 'overview' && (
          <div className="panel">
            <h3 className="panel-title">Top Films</h3>
            <div className="admin-movie-list">
              {movies.slice(0, 10).map((movie, i) => (
                <div key={movie.id} className="admin-movie-row">
                  <span className="label-mono text-dim">{i + 1}</span>
                  <span className="admin-movie-row__title">{movie.title}</span>
                  {movie.year && <span className="label-mono text-dim">{movie.year}</span>}
                  <span className={`badge ${movie.status === 'in_library' ? 'badge-library' : movie.status === 'requested' ? 'badge-requested' : 'badge-nominated'}`}>
                    {movie.status}
                  </span>
                  <span className="admin-movie-row__votes">
                    <span style={{ fontFamily: 'var(--font-title)', fontSize: '1.2rem', color: 'var(--accent-teal)' }}>
                      {movie.vote_count}
                    </span>
                    <span className="label-mono"> votes</span>
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'movies' && (
          <div className="panel">
            <h3 className="panel-title">All Films ({movies.length})</h3>
            <div className="admin-movie-list">
              {movies.map(movie => (
                <div key={movie.id} className="admin-movie-row">
                  <span className="admin-movie-row__title">{movie.title}</span>
                  {movie.year && <span className="label-mono text-dim">{movie.year}</span>}
                  <span className="label-mono text-dim">{movie.source}</span>
                  <span className={`badge ${movie.status === 'in_library' ? 'badge-library' : movie.status === 'requested' ? 'badge-requested' : 'badge-nominated'}`}>
                    {movie.status}
                  </span>
                  <span style={{ fontFamily: 'var(--font-title)', fontSize: '1.2rem', color: 'var(--accent-teal)', marginLeft: 'auto' }}>
                    {movie.vote_count}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'voters' && (
          <div className="panel">
            <h3 className="panel-title">Voters ({voters.length})</h3>
            <div className="admin-voter-list">
              {voters.map(voter => (
                <div key={voter.id} className="admin-voter-row">
                  <div className="admin-voter-row__info">
                    <span className="admin-voter-row__name">
                      {voter.display_name || <span className="text-dim">Anonymous</span>}
                    </span>
                    <span className="label-mono text-dim">
                      depth {voter.invite_depth} · joined {new Date(voter.joined_at).toLocaleDateString()}
                    </span>
                  </div>
                  <div className="admin-voter-row__stats">
                    <span className="label-mono">{voter.vote_count} votes cast</span>
                    <span className="label-mono text-dim">{voter.invite_slots_remaining} invite slots</span>
                  </div>
                  <div className="admin-voter-row__actions">
                    <button
                      className="btn btn-secondary btn-sm"
                      onClick={() => adjustSlots(voter.id, voter.invite_slots_remaining)}
                    >
                      Adjust Slots
                    </button>
                    <button
                      className="btn btn-danger btn-sm"
                      onClick={() => removeVoter(voter.id, voter.display_name || voter.id.slice(0, 8))}
                    >
                      Remove
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'codes' && (
          <div className="panel">
            <h3 className="panel-title">Invite Codes ({codes.length})</h3>
            <div className="admin-code-list">
              {codes.map(code => (
                <div key={code.code} className="admin-code-row">
                  <code className="admin-code-row__code">{code.code}</code>
                  <span className={`badge ${code.status === 'unused' ? 'badge-library' : code.status === 'used' ? 'badge-nominated' : 'badge-requested'}`}>
                    {code.status}
                  </span>
                  <span className="label-mono text-dim">
                    {code.created_by_voter_id ? 'guest code' : 'root code'}
                  </span>
                  {code.status === 'unused' && (
                    <button
                      className="btn btn-danger btn-sm"
                      onClick={() => revokeCode(code.code)}
                    >
                      Revoke
                    </button>
                  )}
                  {code.status === 'used' && (
                    <span className="label-mono text-dim">
                      used {code.used_at ? new Date(code.used_at).toLocaleDateString() : ''}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'tree' && (
          <div className="panel">
            <h3 className="panel-title">Invite Tree</h3>
            {!treeData ? (
              <div className="skeleton" style={{ height: 200 }} />
            ) : (
              <InviteTree data={treeData} />
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function InviteTree({ data }) {
  const { rootCodes, tree } = data;

  return (
    <div className="invite-tree">
      <div className="invite-tree__root">
        <span className="invite-tree__node invite-tree__node--admin label-mono">Admin</span>
        <div className="invite-tree__children">
          {rootCodes.map(code => (
            <div key={code.code} className="invite-tree__branch">
              <div className="invite-tree__connector" />
              <span className={`invite-tree__node invite-tree__node--code label-mono ${code.status}`}>
                {code.code} [{code.status}]
              </span>
              {code.usedByVoterId && (
                <div className="invite-tree__children">
                  {tree
                    .filter(v => v.inviteDepth === 0)
                    .map(voter => (
                      <VoterNode key={voter.id} voter={voter} />
                    ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function VoterNode({ voter }) {
  const [expanded, setExpanded] = useState(true);
  return (
    <div className="invite-tree__branch">
      <div className="invite-tree__connector" />
      <div className="invite-tree__voter-wrap">
        <button
          className="invite-tree__node invite-tree__node--voter"
          onClick={() => setExpanded(e => !e)}
        >
          <span>{voter.displayName}</span>
          <span className="label-mono text-dim"> · {voter.voteCount} votes</span>
          {voter.children.length > 0 && (
            <span className="label-mono text-dim"> [{voter.children.length} invited]</span>
          )}
        </button>
        {expanded && voter.children.length > 0 && (
          <div className="invite-tree__children">
            {voter.children.map(child => (
              <VoterNode key={child.id} voter={child} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function Stat({ value, label }) {
  return (
    <div className="session-stat">
      <span className="session-stat__value">{value}</span>
      <span className="label-mono">{label}</span>
    </div>
  );
}

function AdminHeader({ sessionName }) {
  return (
    <nav className="admin-nav">
      <Link to="/admin" className="admin-nav__brand">
        <span className="label-mono">Movie Night</span>
        <span className="admin-nav__sep">·</span>
        <span className="label-mono text-muted">Admin</span>
        {sessionName && (
          <>
            <span className="admin-nav__sep">·</span>
            <span className="label-mono">{sessionName}</span>
          </>
        )}
      </Link>
    </nav>
  );
}
