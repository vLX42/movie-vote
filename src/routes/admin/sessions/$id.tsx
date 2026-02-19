import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useEffect, useCallback } from "react";
import { copyToClipboard } from "../../../utils/clipboard";
import {
  adminGetSession,
  adminGetTree,
  adminCloseSession,
  adminGenerateCodes,
  adminRevokeCode,
  adminRemoveVoter,
  adminAdjustInviteSlots,
} from "../../../server/admin";

export const Route = createFileRoute("/admin/sessions/$id")({
  component: SessionManagerPage,
});

function getAdminSecret() {
  if (typeof window === "undefined") return "";
  return localStorage.getItem("movienightapp_admin_secret") ?? "";
}

function CopyButton({ text, label = "Copy Link" }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  async function handleCopy() {
    await copyToClipboard(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }
  return (
    <button className={`btn btn-secondary btn-sm${copied ? " btn-copied" : ""}`} onClick={handleCopy}>
      {copied ? "✓ Copied!" : label}
    </button>
  );
}

function SessionManagerPage() {
  const { id } = Route.useParams();
  const secret = getAdminSecret();
  const [data, setData] = useState<any>(null);
  const [treeData, setTreeData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState("overview");
  const [newCodes, setNewCodes] = useState<{ code: string; url: string }[]>([]);
  const [codeError, setCodeError] = useState<string | null>(null);
  const [editingSlots, setEditingSlots] = useState<{ voterId: string; value: string } | null>(null);

  if (!secret) {
    return (
      <div className="page-centered">
        <p className="label-mono">
          <Link to="/admin">Login to admin</Link>
        </p>
      </div>
    );
  }

  const loadData = useCallback(async () => {
    try {
      const result = await adminGetSession({ data: { secret, id } });
      setData(result);
    } catch (err: any) {
      setError(err?.message ?? "Failed to load session");
    }
  }, [id, secret]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    if (activeTab !== "tree" || !secret) return;
    adminGetTree({ data: { secret, id } })
      .then(setTreeData)
      .catch(console.error);
  }, [activeTab, id, secret]);

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
    if (!confirm("Close voting and declare the winner?")) return;
    try {
      await adminCloseSession({ data: { secret, id } });
      loadData();
    } catch (err: any) {
      alert(err?.message);
    }
  }

  async function generateMoreCodes(count: number) {
    setCodeError(null);
    try {
      const res = await adminGenerateCodes({ data: { secret, sessionId: id, count } });
      setNewCodes(res.codes);
      setActiveTab("codes");
      loadData();
    } catch (err: any) {
      setCodeError(err?.message ?? "Failed to generate code");
    }
  }

  async function revokeCode(code: string) {
    if (!confirm(`Revoke invite code ${code}?`)) return;
    try {
      await adminRevokeCode({ data: { secret, code } });
      setNewCodes((prev) => prev.filter((c) => c.code !== code));
      loadData();
    } catch (err: any) {
      alert(err?.message);
    }
  }

  async function removeVoter(voterId: string, name: string) {
    if (!confirm(`Remove voter ${name}? Their votes will remain.`)) return;
    try {
      await adminRemoveVoter({ data: { secret, voterId } });
      loadData();
    } catch (err: any) {
      alert(err?.message);
    }
  }

  async function saveSlots(voterId: string, value: string) {
    const n = parseInt(value, 10);
    if (isNaN(n) || n < 0) return;
    try {
      await adminAdjustInviteSlots({ data: { secret, voterId, inviteSlotsRemaining: n } });
      setEditingSlots(null);
      loadData();
    } catch (err: any) {
      alert(err?.message);
    }
  }

  const winnerMovie = session.winnerMovieId ? movies.find((m: any) => m.id === session.winnerMovieId) : null;
  const origin = typeof window !== "undefined" ? window.location.origin : "";

  return (
    <div className="admin-page">
      <AdminHeader sessionName={session.name} />
      <div className="admin-content">
        <div className="session-overview">
          <div className="session-overview__info">
            <h2 className="title-medium">{session.name}</h2>
            <span className="label-mono text-muted">/vote/{session.slug}</span>
            <span className={`badge ${session.status === "open" ? "badge-library" : "badge-requested"}`}>
              {session.status}
            </span>
          </div>

          <div className="session-overview__stats">
            <Stat value={voters.length} label="Voters" />
            <Stat value={movies.length} label="Films" />
            <Stat value={codes.filter((c: any) => c.status === "unused").length} label="Open Codes" />
            <Stat value={session.votesPerVoter} label="Votes/Voter" />
          </div>

          <div className="session-overview__actions">
            {session.status === "open" && (
              <button className="btn btn-danger" onClick={closeSession}>
                Close Voting
              </button>
            )}
            <button
              className="btn btn-secondary btn-sm"
              onClick={() => generateMoreCodes(1)}
            >
              + Invite Code
            </button>
            <Link
              to="/vote/$slug"
              params={{ slug: session.slug }}
              className="btn btn-secondary btn-sm"
              target="_blank"
            >
              Open Room ↗
            </Link>
          </div>

          {codeError && (
            <p className="label-mono text-danger" style={{ marginTop: "0.5rem" }}>
              {codeError}
            </p>
          )}
        </div>

        {winnerMovie && (
          <div className="panel" style={{ borderColor: "var(--accent-yellow)", marginBottom: "1rem" }}>
            <span className="label-mono text-yellow">Winner: </span>
            <strong className="title-medium"> {winnerMovie.title}</strong>
            {winnerMovie.year && <span className="label-mono text-muted"> ({winnerMovie.year})</span>}
          </div>
        )}

        <div className="admin-tabs">
          {["overview", "movies", "voters", "codes", "tree"].map((tab) => (
            <button
              key={tab}
              className={`admin-tab${activeTab === tab ? " active" : ""}`}
              onClick={() => setActiveTab(tab)}
            >
              <span className="label-mono">{tab}</span>
            </button>
          ))}
        </div>

        {activeTab === "overview" && (
          <div className="panel">
            <h3 className="panel-title">Top Films</h3>
            <div className="admin-movie-list">
              {movies.slice(0, 10).map((movie: any, i: number) => (
                <div key={movie.id} className="admin-movie-row">
                  <span className="label-mono text-dim">{i + 1}</span>
                  <span className="admin-movie-row__title">{movie.title}</span>
                  {movie.year && <span className="label-mono text-dim">{movie.year}</span>}
                  <span className={`badge ${movie.status === "in_library" ? "badge-library" : movie.status === "requested" ? "badge-requested" : "badge-nominated"}`}>
                    {movie.status}
                  </span>
                  <span className="admin-movie-row__votes">
                    <span style={{ fontFamily: "var(--font-title)", fontSize: "1.2rem", color: "var(--accent-teal)" }}>
                      {movie.voteCount}
                    </span>
                    <span className="label-mono"> votes</span>
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === "movies" && (
          <div className="panel">
            <h3 className="panel-title">All Films ({movies.length})</h3>
            <div className="admin-movie-list">
              {movies.map((movie: any) => (
                <div key={movie.id} className="admin-movie-row">
                  <span className="admin-movie-row__title">{movie.title}</span>
                  {movie.year && <span className="label-mono text-dim">{movie.year}</span>}
                  <span className="label-mono text-dim">{movie.source}</span>
                  <span className={`badge ${movie.status === "in_library" ? "badge-library" : movie.status === "requested" ? "badge-requested" : "badge-nominated"}`}>
                    {movie.status}
                  </span>
                  <span style={{ fontFamily: "var(--font-title)", fontSize: "1.2rem", color: "var(--accent-teal)", marginLeft: "auto" }}>
                    {movie.voteCount}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === "voters" && (
          <div className="panel">
            <h3 className="panel-title">Voters ({voters.length})</h3>
            <div className="admin-voter-list">
              {voters.map((voter: any) => (
                <div key={voter.id} className="admin-voter-row">
                  <div className="admin-voter-row__info">
                    <span className="admin-voter-row__name">
                      {voter.displayName || <span className="text-dim">Anonymous</span>}
                    </span>
                    <span className="label-mono text-dim">
                      depth {voter.inviteDepth} · joined {new Date(voter.joinedAt).toLocaleDateString()}
                    </span>
                    {voter.fingerprint && (
                      <span
                        className="label-mono text-dim"
                        title={`Device fingerprint: ${voter.fingerprint}`}
                        style={{ fontSize: "0.72rem", letterSpacing: "0.04em" }}
                      >
                        device: {voter.fingerprint}
                      </span>
                    )}
                  </div>
                  <div className="admin-voter-row__stats">
                    <span className="label-mono">{voter.voteCount} votes cast</span>
                    {editingSlots?.voterId === voter.id ? (
                      <span style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
                        <input
                          type="number"
                          min={0}
                          className="slots-input"
                          value={editingSlots.value}
                          onChange={(e) => setEditingSlots({ voterId: voter.id, value: e.target.value })}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") saveSlots(voter.id, editingSlots.value);
                            if (e.key === "Escape") setEditingSlots(null);
                          }}
                          autoFocus
                          style={{ width: "4rem", padding: "0.2rem 0.4rem", background: "var(--bg-surface)", border: "1px solid var(--border)", borderRadius: 4, color: "inherit", fontFamily: "var(--font-mono)", fontSize: "0.85rem" }}
                        />
                        <span className="label-mono text-dim">slots</span>
                        <button className="btn btn-secondary btn-sm" onClick={() => saveSlots(voter.id, editingSlots.value)}>Save</button>
                        <button className="btn btn-secondary btn-sm" onClick={() => setEditingSlots(null)}>✕</button>
                      </span>
                    ) : (
                      <button
                        className="label-mono text-dim"
                        style={{ background: "none", border: "none", cursor: "pointer", textDecoration: "underline dotted" }}
                        onClick={() => setEditingSlots({ voterId: voter.id, value: String(voter.inviteSlotsRemaining) })}
                      >
                        {voter.inviteSlotsRemaining} invite slots
                      </button>
                    )}
                  </div>
                  <div className="admin-voter-row__actions">
                    <button
                      className="btn btn-danger btn-sm"
                      onClick={() => removeVoter(voter.id, voter.displayName || voter.id.slice(0, 8))}
                    >
                      Remove
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === "codes" && (
          <div className="panel">
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1rem" }}>
              <h3 className="panel-title" style={{ margin: 0 }}>Invite Codes ({codes.length})</h3>
              <button className="btn btn-secondary btn-sm" onClick={() => generateMoreCodes(1)}>
                + Generate Code
              </button>
            </div>

            {newCodes.length > 0 && (
              <div style={{ marginBottom: "1.25rem", padding: "0.75rem 1rem", background: "color-mix(in srgb, var(--accent-teal) 10%, transparent)", border: "1px solid var(--accent-teal)", borderRadius: 6 }}>
                <p className="label-mono" style={{ marginBottom: "0.5rem", color: "var(--accent-teal)" }}>
                  ✓ New {newCodes.length === 1 ? "code" : "codes"} ready — share {newCodes.length === 1 ? "this link" : "these links"}:
                </p>
                {newCodes.map((c) => (
                  <div key={c.code} style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginTop: "0.4rem", flexWrap: "wrap" }}>
                    <code className="label-mono" style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {c.url}
                    </code>
                    <CopyButton text={c.url} />
                  </div>
                ))}
              </div>
            )}

            <div className="admin-code-list">
              {codes.map((code: any) => {
                const isNew = newCodes.some((nc) => nc.code === code.code);
                const joinUrl = `${origin}/join/${code.code}`;
                return (
                  <div
                    key={code.code}
                    className="admin-code-row"
                    style={isNew ? { outline: "1px solid var(--accent-teal)", borderRadius: 4 } : undefined}
                  >
                    <code className="admin-code-row__code">{code.code}</code>
                    <span className={`badge ${code.status === "unused" ? "badge-library" : code.status === "used" ? "badge-nominated" : "badge-requested"}`}>
                      {code.status}
                    </span>
                    <span className="label-mono text-dim">
                      {code.createdByVoterId ? "guest" : "root"}
                    </span>
                    <span style={{ flex: 1 }} />
                    {code.status === "unused" && (
                      <>
                        <CopyButton text={joinUrl} />
                        <button className="btn btn-danger btn-sm" onClick={() => revokeCode(code.code)}>
                          Revoke
                        </button>
                      </>
                    )}
                    {code.status === "used" && (
                      <span className="label-mono text-dim">
                        used {code.usedAt ? new Date(code.usedAt).toLocaleDateString() : ""}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {activeTab === "tree" && (
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

function InviteTree({ data }: { data: any }) {
  return (
    <div className="invite-tree">
      <div className="invite-tree__root">
        <span className="invite-tree__node invite-tree__node--admin label-mono">Admin</span>
        <div className="invite-tree__children">
          {data.rootCodes.map((code: any) => (
            <div key={code.code} className="invite-tree__branch">
              <div className="invite-tree__connector" />
              <span className={`invite-tree__node invite-tree__node--code label-mono ${code.status}`}>
                {code.code} [{code.status}]
              </span>
              {code.usedByVoterId && (
                <div className="invite-tree__children">
                  {data.tree
                    .filter((v: any) => v.inviteDepth === 0)
                    .map((voter: any) => (
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

function VoterNode({ voter }: { voter: any }) {
  const [expanded, setExpanded] = useState(true);
  return (
    <div className="invite-tree__branch">
      <div className="invite-tree__connector" />
      <div className="invite-tree__voter-wrap">
        <button
          className="invite-tree__node invite-tree__node--voter"
          onClick={() => setExpanded((e) => !e)}
        >
          <span>{voter.displayName}</span>
          <span className="label-mono text-dim"> · {voter.voteCount} votes</span>
          {voter.fingerprint && (
            <span
              className="label-mono text-dim"
              title={`Device fingerprint: ${voter.fingerprint}`}
              style={{ fontSize: "0.7rem", opacity: 0.7 }}
            >
              {" "}[{voter.fingerprint}]
            </span>
          )}
          {voter.children.length > 0 && (
            <span className="label-mono text-dim"> [{voter.children.length} invited]</span>
          )}
        </button>
        {expanded && voter.children.length > 0 && (
          <div className="invite-tree__children">
            {voter.children.map((child: any) => (
              <VoterNode key={child.id} voter={child} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function Stat({ value, label }: { value: number; label: string }) {
  return (
    <div className="session-stat">
      <span className="session-stat__value">{value}</span>
      <span className="label-mono">{label}</span>
    </div>
  );
}

function AdminHeader({ sessionName }: { sessionName?: string }) {
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
