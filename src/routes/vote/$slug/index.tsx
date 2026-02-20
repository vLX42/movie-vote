import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useState, useCallback, useEffect } from "react";
import { motion } from "framer-motion";
import { getSession } from "../../../server/sessions";
import { createVoterInvite } from "../../../server/voter-invites";
import MovieCard from "../../../components/MovieCard";
import SearchBar from "../../../components/SearchBar";
import VoteTokens from "../../../components/VoteTokens";
import InviteLink from "../../../components/InviteLink";
import LiveResults from "../../../components/LiveResults";
import type { Movie, SessionData, Invitee, SessionInvite } from "../../../server/sessions";
import { copyToClipboard } from "../../../utils/clipboard";
import OnboardingGuide from "../../../components/OnboardingGuide";

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

  const handleMovieRemoved = useCallback((movieId: string) => {
    setOptimisticMovies((prev) => {
      const base = prev ?? ("movies" in loaderData ? loaderData.movies : []);
      return base.filter((m) => m.id !== movieId);
    });
    router.invalidate();
  }, [loaderData, router]);

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
            codesCreated={voter.sessionInvites.filter((i) => i.createdByCurrentVoter).length}
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
          <p className="voting-room__search-hint label-mono">
            Search for movies you want the group to watch and nominate them — then vote on the ones you like most.
          </p>
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
          {(voter.sessionInvites.length > 0 || voter.inviteSlotsRemaining > 0) && (
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
            ? `${voter.sessionInvites.length} invite${voter.sessionInvites.length !== 1 ? "s" : ""}`
            : `${movies.length} film${movies.length !== 1 ? "s" : ""}`}
        </span>
      </div>

      {isOpen && <OnboardingGuide votesPerVoter={session.votesPerVoter} />}

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
                    onMovieRemoved={handleMovieRemoved}
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
  const [creating, setCreating] = useState(false);
  const [newLabel, setNewLabel] = useState("");
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  const myInviteCount = voter.sessionInvites.filter((i) => i.createdByCurrentVoter).length;
  const canCreate = voter.inviteSlotsRemaining > 0 && myInviteCount < voter.inviteSlotsRemaining;

  async function handleCopy(url: string, code: string) {
    await copyToClipboard(url);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 2500);
  }

  async function handleCreate() {
    const trimmedLabel = newLabel.trim();
    if (!trimmedLabel || !canCreate || creating) return;
    setCreating(true);
    try {
      await createVoterInvite({ data: { label: trimmedLabel } });
      setNewLabel("");
      onRefresh();
    } catch (err: any) {
      alert(err?.message ?? "Failed to create invite link");
    } finally {
      setCreating(false);
    }
  }

  const statusBadgeClass = (status: string) =>
    status === "unused" ? "badge-library" : status === "used" ? "badge-nominated" : "badge-requested";

  return (
    <div className="invites-view">
      <div>
        <p className="invites-section__title">All Invites</p>

        {voter.sessionInvites.length === 0 && (
          <p className="label-mono" style={{ color: "var(--text-dim)", marginBottom: "0.75rem" }}>
            No invites created yet.
          </p>
        )}

        {voter.sessionInvites.map((invite: SessionInvite, idx: number) => (
          <div key={invite.code ?? `invite-${idx}`} className="invite-code-row">
            <span className="invite-code-row__label">
              {invite.label}
              {invite.createdByCurrentVoter && (
                <span className="label-mono" style={{ color: "var(--accent-teal)", marginLeft: "0.4rem", fontSize: "0.7rem" }}>
                  (yours)
                </span>
              )}
            </span>
            <span className={`badge ${statusBadgeClass(invite.status)}`}>
              {invite.status}
            </span>
            {invite.createdByCurrentVoter && invite.status === "unused" && invite.url && (
              <button
                className="btn btn-sm btn-secondary"
                onClick={() => handleCopy(invite.url!, invite.code!)}
              >
                {copiedCode === invite.code ? (
                  <span className="invite-copied-text">✓ Copied</span>
                ) : (
                  "Copy Link"
                )}
              </button>
            )}
          </div>
        ))}

        {canCreate && (
          <div className="invite-create-row" style={{ marginTop: "1rem" }}>
            <input
              className="invite-create-row__input"
              placeholder="Name for this invite (required)…"
              value={newLabel}
              onChange={(e) => setNewLabel(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && newLabel.trim()) handleCreate(); }}
            />
            <button
              className="btn btn-sm btn-primary"
              onClick={handleCreate}
              disabled={creating || !newLabel.trim()}
            >
              {creating ? "Creating…" : "+ Create Link"}
            </button>
          </div>
        )}

        {!canCreate && voter.inviteSlotsRemaining > 0 && myInviteCount >= voter.inviteSlotsRemaining && (
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
      <h2 className="empty-state__title title-large">
        {isOpen ? "What do you want to watch?" : "No Films Nominated"}
      </h2>
      <p className="empty-state__sub label-mono">
        {isOpen
          ? "Use the search above to find a movie and nominate it. Everyone can nominate, and everyone votes."
          : "Nothing was nominated before voting closed."}
      </p>
    </div>
  );
}
