import React from 'react';
import { useParams, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useSession } from '../hooks/useApi';
import LiveResults from '../components/LiveResults';
import './ResultsPage.css';

export default function ResultsPage() {
  const { slug } = useParams();
  const { data, error } = useSession(slug);

  if (error) {
    return (
      <div className="results-page page-centered">
        <h1 className="title-large">Session not found.</h1>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="results-page page-centered">
        <div className="skeleton" style={{ width: 300, height: 60, borderRadius: 0 }} />
      </div>
    );
  }

  const { session, movies } = data;
  const winner = movies.find(m => m.id === session.winnerMovieId);

  return (
    <div className="results-page">
      <header className="results-header">
        <div className="results-header__label label-mono">Movie Night</div>
        <h1 className="results-header__name title-large">{session.name}</h1>
        <span className={`badge ${session.status === 'closed' ? 'badge-requested' : 'badge-library'}`}>
          {session.status === 'closed' ? 'Voting Closed' : 'Live'}
        </span>
      </header>

      {session.status === 'closed' && winner && (
        <motion.div
          className="results-winner"
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.2, type: 'spring', stiffness: 150, damping: 15 }}
        >
          <div className="results-winner__bg" />
          {winner.posterUrl && (
            <img src={winner.posterUrl} alt={winner.title} className="results-winner__poster" />
          )}
          <div className="results-winner__info">
            <span className="label-mono results-winner__label">Tonight's Pick</span>
            <h2 className="results-winner__title title-huge">{winner.title}</h2>
            <div className="results-winner__meta">
              {winner.year && <span className="label-mono">{winner.year}</span>}
              {winner.runtimeMinutes && <span className="label-mono">{winner.runtimeMinutes} min</span>}
            </div>
            {winner.synopsis && (
              <p className="results-winner__synopsis">{winner.synopsis}</p>
            )}
          </div>
        </motion.div>
      )}

      <div className="results-standings">
        <LiveResults
          movies={movies}
          sessionStatus={session.status}
          winnerMovieId={session.winnerMovieId}
        />
      </div>

      <div className="results-footer">
        <Link to={`/vote/${slug}`} className="btn btn-secondary">
          Back to Voting Room
        </Link>
      </div>
    </div>
  );
}
