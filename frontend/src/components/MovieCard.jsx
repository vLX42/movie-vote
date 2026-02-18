import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { apiPost, apiDelete } from '../hooks/useApi';
import './MovieCard.css';

const STATUS_LABELS = {
  in_library: 'In Library',
  requested: 'Requested',
  nominated_only: 'Nominate Only'
};

const STATUS_CLASSES = {
  in_library: 'badge-library',
  requested: 'badge-requested',
  nominated_only: 'badge-nominated'
};

export default function MovieCard({ movie, sessionSlug, voter, onVoteChange, sessionOpen }) {
  const [loading, setLoading] = useState(false);
  const [localVoteCount, setLocalVoteCount] = useState(movie.voteCount);
  const [localMyVotes, setLocalMyVotes] = useState(movie.myVotes);
  const [imageError, setImageError] = useState(false);

  const canVote = sessionOpen && voter && voter.votesRemaining > 0;
  const canUnvote = sessionOpen && localMyVotes > 0;

  async function handleVote() {
    if (!canVote || loading) return;
    setLoading(true);
    try {
      const res = await apiPost(`/api/session/${sessionSlug}/vote`, { movieId: movie.id });
      setLocalVoteCount(v => v + 1);
      setLocalMyVotes(v => v + 1);
      if (onVoteChange) onVoteChange(res);
    } catch (err) {
      // swallow — could show toast
    } finally {
      setLoading(false);
    }
  }

  async function handleUnvote() {
    if (!canUnvote || loading) return;
    setLoading(true);
    try {
      const res = await apiDelete(`/api/session/${sessionSlug}/vote`, { movieId: movie.id });
      setLocalVoteCount(v => Math.max(0, v - 1));
      setLocalMyVotes(v => Math.max(0, v - 1));
      if (onVoteChange) onVoteChange(res);
    } catch (err) {
      // swallow
    } finally {
      setLoading(false);
    }
  }

  // Sync from parent updates
  React.useEffect(() => {
    setLocalVoteCount(movie.voteCount);
    setLocalMyVotes(movie.myVotes);
  }, [movie.voteCount, movie.myVotes]);

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
          <span className={`badge ${STATUS_CLASSES[movie.status] || 'badge-nominated'}`}>
            {STATUS_LABELS[movie.status] || movie.status}
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
              <span className="movie-card__my-votes label-mono">
                ({localMyVotes} mine)
              </span>
            )}
          </div>

          {sessionOpen && (
            <div className="movie-card__vote-actions">
              {localMyVotes > 0 && (
                <button
                  className="btn btn-sm movie-card__unvote-btn"
                  onClick={handleUnvote}
                  disabled={loading || !canUnvote}
                  title="Remove one vote"
                >
                  −
                </button>
              )}
              <motion.button
                className="btn btn-sm btn-primary movie-card__vote-btn"
                onClick={handleVote}
                disabled={loading || !canVote}
                whileTap={{ scale: 0.92 }}
                title={canVote ? 'Cast a vote' : 'No votes remaining'}
              >
                {localMyVotes > 0 ? `+1 (${localMyVotes})` : '+ Vote'}
              </motion.button>
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}
