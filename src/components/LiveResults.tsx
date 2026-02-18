import { motion, AnimatePresence } from "framer-motion";
import type { Movie } from "../server/sessions";

type Props = {
  movies: Movie[];
  sessionStatus: string;
  winnerMovieId: string | null;
};

export default function LiveResults({ movies, sessionStatus, winnerMovieId }: Props) {
  const sorted = [...movies].sort((a, b) => b.voteCount - a.voteCount);
  const maxVotes = sorted.length > 0 ? sorted[0].voteCount || 1 : 1;

  return (
    <div className="live-results">
      <div className="live-results__header">
        <h2 className="panel-title">
          {sessionStatus === "closed" ? "Final Results" : "Live Standings"}
        </h2>
        {sessionStatus === "open" && (
          <span className="live-results__pulse" title="Updates every 15s" />
        )}
      </div>

      {sorted.length === 0 && (
        <div className="live-results__empty">
          <span className="label-mono">No movies yet. Nominate something!</span>
        </div>
      )}

      <div className="live-results__list">
        <AnimatePresence initial={false}>
          {sorted.map((movie, index) => {
            const isWinner = movie.id === winnerMovieId;
            const pct = maxVotes > 0 ? (movie.voteCount / maxVotes) * 100 : 0;

            return (
              <motion.div
                key={movie.id}
                className={`live-results__item${isWinner ? " live-results__item--winner" : ""}`}
                layout
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.2 }}
              >
                <span className="live-results__rank">
                  {index === 0 && movie.voteCount > 0 ? "▶" : `${index + 1}`}
                </span>
                <div className="live-results__movie-info">
                  <span className="live-results__title">{movie.title}</span>
                  {movie.year && (
                    <span className="live-results__year label-mono">{movie.year}</span>
                  )}
                </div>
                <div className="live-results__bar-wrap">
                  <motion.div
                    className="live-results__bar"
                    initial={{ width: 0 }}
                    animate={{ width: `${pct}%` }}
                    transition={{ duration: 0.4, ease: "easeOut" }}
                  />
                </div>
                <span className="live-results__count">{movie.voteCount}</span>
                {isWinner && (
                  <span className="live-results__winner-badge label-mono">WINNER</span>
                )}
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </div>
  );
}
