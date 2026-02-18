import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useState, useCallback, useEffect } from "react";
import { motion } from "framer-motion";
import { getSession } from "../../../server/sessions";
import MovieCard from "../../../components/MovieCard";
import SearchBar from "../../../components/SearchBar";
import VoteTokens from "../../../components/VoteTokens";
import InviteLink from "../../../components/InviteLink";
import LiveResults from "../../../components/LiveResults";
import type { Movie } from "../../../server/sessions";

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

  const [view, setView] = useState<"grid" | "results">("grid");
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
          <InviteLink inviteUrl={voter.inviteUrl} slotsRemaining={voter.inviteSlotsRemaining} />
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
        </div>
        <span className="voting-room__count label-mono">
          {movies.length} film{movies.length !== 1 ? "s" : ""}
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
      </div>
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
