import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useState, useCallback, useEffect } from "react";
import { motion } from "framer-motion";
import { getSession } from "../../../server/sessions";
import { createVoterInvite, setInviteCodeLabel } from "../../../server/voter-invites";
import MovieCard from "../../../components/MovieCard";
import SearchBar from "../../../components/SearchBar";
import VoteTokens from "../../../components/VoteTokens";
import InviteLink from "../../../components/InviteLink";
import LiveResults from "../../../components/LiveResults";
import type { Movie, SessionData, VoterCode, Invitee } from "../../../server/sessions";
import { copyToClipboard } from "../../../utils/clipboard";

export const Route = createFileRoute("/vote/$slug/")({
  loader: async ({ params }) => {
    try {
      return await getSession({ data: params.slug });
    } catch (err: any) {
      const msg = err?.message ?? "";
      if (msg === "UNAUTHORIZED") return { error: "UNAUTHORIZED" } as const;
      if (msg === "NOT_FOUND") return { error: "NOT_FOUND" } as const;
      return { error: msg } as const;
    }
  },
  component: VotingRoomPage,
});

function VotingRoomPage() {
  const loaderData = Route.useLoaderData();
  const { slug } = Route.useParams();
  const router = useRouter();

  const [view, setView] = useState<"grid" | "results" | "invites">("grid");
  const [optimisticVotesUsed, setOptimisticVotesUsed] = useState<number | null>(null);
  const [optimisticMovies, setOptimisticMovies] = useState<Movie[] | null>(null);

  // Reset optimistic state when loader data refreshes
  useEffect(() => {
    if ("session" in loaderData) {
      setOptimisticVotesUsed(null);
      setOptimisticMovies(null);
    }
  }, [loaderData]);

  // Poll every 15s when session is open
  useEffect(() => {
    if (!("session" in loaderData) || loaderData.session.status !== "open") return;
    const interval = setInterval(() => router.invalidate(), 15000);
    return () => clearInterval(interval);
  }, [loaderData, router]);

  const handleVoteChange = useCallback((result: { votesUsed: number; movie: { id: string; voteCount: number; myVotes: number } }) => {
    setOptimisticVotesUsed(result.votesUsed);
    setOptimisticMovies((prev) => {
      const base = prev ?? ("movies" in loaderData ? loaderData.movies : []);
      return base.map((m) =>
        m.id === result.movie.id
          ? { ...m, voteCount: result.movie.voteCount, myVotes: result.movie.myVotes }
          : m
      );
    });
    router.invalidate();
  }, [loaderData, router]);

  const handleMovieAdded = useCallback(() => {
    router.invalidate();
  }, [router]);

  if ("error" in loaderData) {
    if (loaderData.error === "UNAUTHORIZED") {
      return (
        <div className="page-centered">
          <div style={{ textAlign: "center" }}>
            <h1 className="title-large">No Access</h1>
            <p className="label-mono" style={{ color: "var(--text-muted)", marginTop: "1rem" }}>
              You need an invite link to enter this session.
            </p>
          </div>
        </div>
      );
    }
    return (
      <div className="page-centered">
        <div style={{ textAlign: "center" }}>
          <h1 className="title-large">Error</h1>
          <p className="label-mono" style={{ color: "var(--accent-red)", marginTop: "1rem" }}>
            {loaderData.error}
          </p>
        </div>
      </div>
    );
  }

  const { session, voter, movies: loaderMovies } = loaderData;
  const movies = optimisticMovies ?? loaderMovies;
  const isOpen = session.status === "open";
  const votesUsed = optimisticVotesUsed !== null ? optimisticVotesUsed : voter.votesUsed;
  const votesRemaining = session.votesPerVoter - votesUsed;
  const voterForCards = { ...voter, votesRemaining };

  return (
    <div className="voting-room">
      <header className="voting-header">
        <div className="voting-header__left">
          <div className="voting-header__session-label label-mono">Movie Night</div>
          <h1 className="voting-header__title title-medium">{session.name}</h1>
        </div>
        <div className="voting-header__center">
          <VoteTokens total={session.votesPerVoter} used={votesUsed} />
        </div>
        <div className="voting-header__right">
          <InviteLink
            codesCreated={voter.voterCodes.length}
            totalSlots={voter.inviteSlotsRemaining}
            onOpen={() => setView("invites")}
          />
          {session.status === "closed" && (
            <span className="badge badge-requested">Closed</span>
          )}
        </div>
      </header>

      {session.status === "closed" && session.winnerMovieId && (
        <WinnerBanner movie={movies.find((m) => m.id === session.winnerMovieId)} />
      )}

      {isOpen && (
        <div className="voting-room__search">
          <SearchBar
            sessionSlug={slug}
            allowRequests={session.allowJellyseerrRequests}
            onMovieAdded={handleMovieAdded}
          />
        </div>
      )}

      <div className="voting-room__controls">
        <div className="view-toggle">
          <button
            className={`view-toggle__btn${view === "grid" ? " active" : ""}`}
            onClick={() => setView("grid")}
          >
            <span className="label-mono">Movies</span>
          </button>
          <button
            className={`view-toggle__btn${view === "results" ? " active" : ""}`}
            onClick={() => setView("results")}
          >
            <span className="label-mono">Standings</span>
          </button>
          {voter.inviteSlotsRemaining > 0 && (
            <button
              className={`view-toggle__btn${view === "invites" ? " active" : ""}`}
              onClick={() => setView("invites")}
            >
              <span className="label-mono">Invites</span>
            </button>
          )}
        </div>
        <span className="voting-room__count label-mono">
          {view === "invites"
            ? `${voter.voterCodes.length}/${voter.inviteSlotsRemaining} links`
            : `${movies.length} film${movies.length !== 1 ? "s" : ""}`}
        </span>
      </div>

      <div className="voting-room__content">
        {view === "grid" && (
          <>
            {movies.length === 0 ? (
              <EmptyState isOpen={isOpen} />
            ) : (
              <motion.div
                className="movie-grid"
                layout
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
              >
                {movies.map((movie) => (
                  <MovieCard
                    key={movie.id}
                    movie={movie}
                    sessionSlug={slug}
                    voter={voterForCards}
                    onVoteChange={handleVoteChange}
                    sessionOpen={isOpen}
                  />
                ))}
              </motion.div>
            )}
          </>
        )}

        {view === "results" && (
          <div className="voting-room__results-view">
            <LiveResults
              movies={movies}
              sessionStatus={session.status}
              winnerMovieId={session.winnerMovieId}
            />
          </div>
        )}

        {view === "invites" && (
          <InvitesView
            voter={voter}
            onRefresh={() => router.invalidate()}
          />
        )}
      </div>
    </div>
  );
}

function InvitesView({
  voter,
  onRefresh,
}: {
  voter: SessionData["voter"];
  onRefresh: () => void;
}) {
  const [editingCode, setEditingCode] = useState<string | null>(null);
  const [labelDraft, setLabelDraft] = useState("");
  const [savingLabel, setSavingLabel] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newLabel, setNewLabel] = useState("");
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [localCodes, setLocalCodes] = useState<VoterCode[]>(voter.voterCodes);

  // Sync from parent when voter data refreshes
  useEffect(() => {
    setLocalCodes(voter.voterCodes);
  }, [voter.voterCodes]);

  const canCreate = localCodes.length < voter.inviteSlotsRemaining;

  function startEdit(code: VoterCode) {
    setEditingCode(code.code);
    setLabelDraft(code.label ?? "");
  }

  async function saveLabel(code: string) {
    setSavingLabel(true);
    try {
      await setInviteCodeLabel({ data: { code, label: labelDraft } });
      setLocalCodes((prev) =>
        prev.map((c) => (c.code === code ? { ...c, label: labelDraft.trim() || null } : c))
      );
      setEditingCode(null);
    } catch {
      // keep editing on error
    } finally {
      setSavingLabel(false);
    }
  }

  async function handleCopy(url: string, code: string) {
    await copyToClipboard(url);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 2500);
  }

  async function handleCreate() {
    if (!canCreate || creating) return;
    setCreating(true);
    try {
      const res = await createVoterInvite({ data: { label: newLabel.trim() || undefined } });
      setLocalCodes((prev) => [
        ...prev,
        { code: res.code, label: res.label ?? null, status: "unused", url: res.url },
      ]);
      setNewLabel("");
      onRefresh();
    } catch (err: any) {
      alert(err?.message ?? "Failed to create invite link");
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="invites-view">
      <div>
        <p className="invites-section__title">Your Invite Links</p>

        {localCodes.length === 0 && (
          <p className="label-mono" style={{ color: "var(--text-dim)", marginBottom: "0.75rem" }}>
            No invite links created yet.
          </p>
        )}

        {localCodes.map((code) => (
          <div key={code.code} className="invite-code-row">
            {editingCode === code.code ? (
              <>
                <input
                  className="invite-code-row__label-input"
                  value={labelDraft}
                  onChange={(e) => setLabelDraft(e.target.value)}
                  placeholder="Name for this link..."
                  onKeyDown={(e) => {
                    if (e.key === "Enter") saveLabel(code.code);
                    if (e.key === "Escape") setEditingCode(null);
                  }}
                  autoFocus
                />
                <button
                  className="btn btn-sm btn-primary"
                  onClick={() => saveLabel(code.code)}
                  disabled={savingLabel}
                >
                  Save
                </button>
                <button
                  className="btn btn-sm btn-secondary"
                  onClick={() => setEditingCode(null)}
                >
                  ✕
                </button>
              </>
            ) : (
              <>
                <span className={`invite-code-row__label${!code.label ? " invite-code-row__label--empty" : ""}`}>
                  {code.label || code.code}
                </span>
                <span className={`badge ${code.status === "unused" ? "badge-library" : code.status === "used" ? "badge-nominated" : "badge-requested"}`}>
                  {code.status}
                </span>
                {code.status === "unused" && (
                  <button
                    className="btn btn-sm btn-secondary"
                    onClick={() => handleCopy(code.url, code.code)}
                  >
                    {copiedCode === code.code ? (
                      <span className="invite-copied-text">✓ Copied</span>
                    ) : (
                      "Copy Link"
                    )}
                  </button>
                )}
                <button
                  className="btn btn-sm btn-secondary"
                  onClick={() => startEdit(code)}
                  title="Edit name"
                  style={{ fontSize: "0.7rem" }}
                >
                  Edit name
                </button>
              </>
            )}
          </div>
        ))}

        {canCreate && (
          <div className="invite-create-row">
            <input
              className="invite-create-row__input"
              placeholder="Name for this link (optional)..."
              value={newLabel}
              onChange={(e) => setNewLabel(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") handleCreate(); }}
            />
            <button
              className="btn btn-sm btn-primary"
              onClick={handleCreate}
              disabled={creating}
            >
              {creating ? "Creating…" : "+ Create Link"}
            </button>
          </div>
        )}

        {!canCreate && localCodes.length > 0 && (
          <p className="label-mono" style={{ color: "var(--text-dim)", marginTop: "0.5rem", fontSize: "0.75rem" }}>
            All {voter.inviteSlotsRemaining} invite link{voter.inviteSlotsRemaining !== 1 ? "s" : ""} created.
          </p>
        )}
      </div>

      {voter.invitees.length > 0 && (
        <div>
          <p className="invites-section__title">People You've Invited</p>
          {voter.invitees.map((invitee: Invitee) => (
            <div key={invitee.id} className="invitee-row">
              <span className="invitee-row__name">
                {invitee.displayName || <span style={{ color: "var(--text-dim)" }}>Anonymous</span>}
              </span>
              <span className="invitee-row__date">
                joined {new Date(invitee.joinedAt).toLocaleDateString()}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function WinnerBanner({ movie }: { movie: Movie | undefined }) {
  if (!movie) return null;
  return (
    <motion.div
      className="winner-banner"
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
    >
      <span className="winner-banner__label label-mono">Tonight's Pick</span>
      <span className="winner-banner__title title-medium">{movie.title}</span>
      {movie.year && <span className="winner-banner__year label-mono">({movie.year})</span>}
    </motion.div>
  );
}

function EmptyState({ isOpen }: { isOpen: boolean }) {
  return (
    <div className="empty-state">
      <div className="empty-state__icon">▶▶</div>
      <h2 className="empty-state__title title-large">No Films Yet</h2>
      <p className="empty-state__sub label-mono">
        {isOpen
          ? "Search above to nominate the first movie."
          : "Nothing was nominated before voting closed."}
      </p>
    </div>
  );
}
