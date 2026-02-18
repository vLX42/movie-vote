import React, { useState, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useSession } from '../hooks/useApi';
import MovieCard from '../components/MovieCard';
import SearchBar from '../components/SearchBar';
import VoteTokens from '../components/VoteTokens';
import InviteLink from '../components/InviteLink';
import LiveResults from '../components/LiveResults';
import './VotingRoom.css';

export default function VotingRoom() {
  const { slug } = useParams();
  const { data, error, mutate } = useSession(slug);
  const [view, setView] = useState('grid'); // grid | results
  const [votesUsed, setVotesUsed] = useState(null);

  const handleVoteChange = useCallback((res) => {
    if (res) {
      setVotesUsed(res.votesUsed);
    }
    mutate(); // revalidate session data
  }, [mutate]);

  const handleMovieAdded = useCallback(() => {
    mutate();
  }, [mutate]);

  if (error) {
    if (error.status === 401) {
      return (
        <div className="voting-room page-centered">
          <div className="voting-error">
            <h1 className="title-large">No Access</h1>
            <p className="voting-error__msg">You need an invite link to enter this session.</p>
          </div>
        </div>
      );
    }
    return (
      <div className="voting-room page-centered">
        <div className="voting-error">
          <h1 className="title-large">Error</h1>
          <p className="voting-error__msg">{error.message}</p>
        </div>
      </div>
    );
  }

  if (!data) {
    return <VotingRoomSkeleton />;
  }

  const { session, voter, movies } = data;
  const isOpen = session.status === 'open';
  const currentVotesUsed = votesUsed !== null ? votesUsed : voter.votesUsed;
  const currentVotesRemaining = session.votesPerVoter - currentVotesUsed;
  const voterForCards = { ...voter, votesRemaining: currentVotesRemaining };

  return (
    <div className="voting-room">
      {/* Header */}
      <header className="voting-header">
        <div className="voting-header__left">
          <div className="voting-header__session-label label-mono">Movie Night</div>
          <h1 className="voting-header__title title-medium">{session.name}</h1>
        </div>
        <div className="voting-header__center">
          <VoteTokens total={session.votesPerVoter} used={currentVotesUsed} />
        </div>
        <div className="voting-header__right">
          <InviteLink inviteUrl={voter.inviteUrl} slotsRemaining={voter.inviteSlotsRemaining} />
          {session.status === 'closed' && (
            <span className="badge badge-requested">Closed</span>
          )}
        </div>
      </header>

      {/* Winner banner if closed */}
      {session.status === 'closed' && session.winnerMovieId && (
        <WinnerBanner movie={movies.find(m => m.id === session.winnerMovieId)} />
      )}

      {/* Search bar */}
      {isOpen && (
        <div className="voting-room__search">
          <SearchBar
            sessionSlug={slug}
            sessionStatus={session.status}
            allowRequests={session.allowJellyseerrRequests}
            onMovieAdded={handleMovieAdded}
          />
        </div>
      )}

      {/* View toggle */}
      <div className="voting-room__controls">
        <div className="view-toggle">
          <button
            className={`view-toggle__btn ${view === 'grid' ? 'active' : ''}`}
            onClick={() => setView('grid')}
          >
            <span className="label-mono">Movies</span>
          </button>
          <button
            className={`view-toggle__btn ${view === 'results' ? 'active' : ''}`}
            onClick={() => setView('results')}
          >
            <span className="label-mono">Standings</span>
          </button>
        </div>
        <span className="voting-room__count label-mono">
          {movies.length} film{movies.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Main content */}
      <div className="voting-room__content">
        {view === 'grid' && (
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
                {movies.map(movie => (
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

        {view === 'results' && (
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

function WinnerBanner({ movie }) {
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

function EmptyState({ isOpen }) {
  return (
    <div className="empty-state">
      <div className="empty-state__icon">▶▶</div>
      <h2 className="empty-state__title title-large">No Films Yet</h2>
      <p className="empty-state__sub label-mono">
        {isOpen ? 'Search above to nominate the first movie.' : 'Nothing was nominated before voting closed.'}
      </p>
    </div>
  );
}

function VotingRoomSkeleton() {
  return (
    <div className="voting-room">
      <header className="voting-header">
        <div className="skeleton" style={{ width: 200, height: 32, borderRadius: 0 }} />
        <div className="skeleton" style={{ width: 160, height: 32, borderRadius: 0 }} />
        <div className="skeleton" style={{ width: 120, height: 32, borderRadius: 0 }} />
      </header>
      <div className="voting-room__search">
        <div className="skeleton" style={{ height: 46, borderRadius: 0 }} />
      </div>
      <div className="movie-grid" style={{ marginTop: '1.5rem' }}>
        {[1, 2, 3, 4, 5, 6].map(i => (
          <div key={i} className="skeleton" style={{ aspectRatio: '2/3', borderRadius: 0 }} />
        ))}
      </div>
    </div>
  );
}
