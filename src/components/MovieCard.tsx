import { useState } from "react";
import { motion } from "framer-motion";
import { castVote, retractVote } from "../server/votes";
import { removeMovie } from "../server/movies";
import type { Movie } from "../server/sessions";

const STATUS_LABELS: Record<string, string> = {
  in_library: "In Library",
  requested: "Requested",
  nominated_only: "Nominate Only",
};

const STATUS_CLASSES: Record<string, string> = {
  in_library: "badge-library",
  requested: "badge-requested",
  nominated_only: "badge-nominated",
};

type Props = {
  movie: Movie;
  sessionSlug: string;
  voter: { votesRemaining: number; id: string };
  onVoteChange: (result: { votesUsed: number; movie: { id: string; voteCount: number; myVotes: number } }) => void;
  onMovieRemoved?: (movieId: string) => void;
  sessionOpen: boolean;
};

export default function MovieCard({ movie, sessionSlug, voter, onVoteChange, onMovieRemoved, sessionOpen }: Props) {
  const [loading, setLoading] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [localVoteCount, setLocalVoteCount] = useState(movie.voteCount);
  const [localMyVotes, setLocalMyVotes] = useState(movie.myVotes);
  const [imageError, setImageError] = useState(false);

  // Max 1 vote per movie: can only vote if not yet voted for this movie AND have votes remaining
  const canVote = sessionOpen && voter.votesRemaining > 0 && localMyVotes === 0;
  const canUnvote = sessionOpen && localMyVotes > 0;
  const canRemove = sessionOpen && movie.nominatedBy === voter.id;

  // Sync from parent updates
  if (movie.voteCount !== localVoteCount && !loading) setLocalVoteCount(movie.voteCount);
  if (movie.myVotes !== localMyVotes && !loading) setLocalMyVotes(movie.myVotes);

  async function handleVote() {
    if (!canVote || loading) return;
    setLoading(true);
    try {
      setLocalVoteCount((v) => v + 1);
      setLocalMyVotes((v) => v + 1);
      const res = await castVote({ data: { slug: sessionSlug, movieId: movie.id } });
      onVoteChange(res);
    } catch {
      setLocalVoteCount((v) => v - 1);
      setLocalMyVotes((v) => v - 1);
    } finally {
      setLoading(false);
    }
  }

  async function handleUnvote() {
    if (!canUnvote || loading) return;
    setLoading(true);
    try {
      setLocalVoteCount((v) => Math.max(0, v - 1));
      setLocalMyVotes((v) => Math.max(0, v - 1));
      const res = await retractVote({ data: { slug: sessionSlug, movieId: movie.id } });
      onVoteChange(res);
    } catch {
      setLocalVoteCount((v) => v + 1);
      setLocalMyVotes((v) => v + 1);
    } finally {
      setLoading(false);
    }
  }

  async function handleRemove() {
    if (!canRemove || removing) return;
    if (!confirm(`Remove "${movie.title}" from the session?`)) return;
    setRemoving(true);
    try {
      await removeMovie({ data: { slug: sessionSlug, movieId: movie.id } });
      onMovieRemoved?.(movie.id);
    } catch (err: any) {
      alert(err?.message ?? "Failed to remove movie");
    } finally {
      setRemoving(false);
    }
  }

  return (
    <motion.div
      className="movie-card"
      layout
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
    >
      <div className="movie-card__poster-wrap">
        {!imageError && movie.posterUrl ? (
          <img
            src={movie.posterUrl}
            alt={movie.title}
            className="movie-card__poster"
            onError={() => setImageError(true)}
            loading="lazy"
          />
        ) : (
          <div className="movie-card__poster-fallback">
            <span className="movie-card__poster-icon">▶</span>
            <span className="movie-card__poster-title">{movie.title}</span>
          </div>
        )}
        <div className="movie-card__poster-overlay" />
      </div>

      <div className="movie-card__body">
        <div className="movie-card__meta-top">
          <span className={`badge ${STATUS_CLASSES[movie.status] ?? "badge-nominated"}`}>
            {STATUS_LABELS[movie.status] ?? movie.status}
          </span>
        </div>

        <h3 className="movie-card__title">{movie.title}</h3>

        <div className="movie-card__meta">
          {movie.year && <span>{movie.year}</span>}
          {movie.runtimeMinutes && <span>{movie.runtimeMinutes}m</span>}
        </div>

        {movie.synopsis && (
          <p className="movie-card__synopsis">{movie.synopsis}</p>
        )}

        <div className="movie-card__footer">
          <div className="movie-card__vote-display">
            <span className="movie-card__vote-count">{localVoteCount}</span>
            <span className="label-mono">votes</span>
            {localMyVotes > 0 && (
              <span className="movie-card__my-votes label-mono">(yours)</span>
            )}
          </div>

          {sessionOpen && (
            <div className="movie-card__vote-actions">
              {localMyVotes > 0 ? (
                <button
                  className="btn btn-sm movie-card__unvote-btn"
                  onClick={handleUnvote}
                  disabled={loading}
                  title="Remove your vote"
                >
                  ✓ Voted — Undo
                </button>
              ) : (
                <motion.button
                  className="btn btn-sm btn-primary movie-card__vote-btn"
                  onClick={handleVote}
                  disabled={loading || !canVote}
                  whileTap={{ scale: 0.92 }}
                  title={voter.votesRemaining > 0 ? "Cast a vote" : "No votes remaining"}
                >
                  + Vote
                </motion.button>
              )}
              {canRemove && (
                <button
                  className="btn btn-sm movie-card__remove-btn"
                  onClick={handleRemove}
                  disabled={removing}
                  title="Remove your nomination"
                >
                  {removing ? "…" : "Remove"}
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}
