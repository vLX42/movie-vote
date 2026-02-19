import { useState, useRef, useCallback, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { searchJellyfin, searchTmdb, recentlyAddedJellyfin } from "../server/search";
import { nominateMovie, requestMovie } from "../server/movies";

type SearchResult = {
  id: string;
  title: string;
  year: number | null;
  runtimeMinutes: number | null;
  synopsis: string | null;
  posterUrl: string | null;
  source: string;
  jellyfinId: string | null;
  tmdbId: string | null;
  status: string;
};

type Props = {
  sessionSlug: string;
  allowRequests: boolean;
  onMovieAdded: () => void;
};

export default function SearchBar({ sessionSlug, allowRequests, onMovieAdded }: Props) {
  const [query, setQuery] = useState("");
  const [source, setSource] = useState("jellyfin");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [nominatingId, setNominatingId] = useState<string | null>(null);
  const [requestingId, setRequestingId] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const search = useCallback(async (q: string, src: string) => {
    if (!q || q.length < 2) {
      setResults([]);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const fn = src === "jellyfin" ? searchJellyfin : searchTmdb;
      const data = await fn({ data: q });
      setResults(data.results as SearchResult[]);
    } catch (err: any) {
      setError(err?.message ?? "Search failed");
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadRecent = useCallback(async () => {
    setLoading(true);
    setError(null);
    setResults([]);
    try {
      const data = await recentlyAddedJellyfin();
      setResults(data.results as SearchResult[]);
    } catch (err: any) {
      setError(err?.message ?? "Failed to load recent movies");
    } finally {
      setLoading(false);
    }
  }, []);

  // Auto-load when switching to Recent tab
  useEffect(() => {
    if (source === "recent") {
      setOpen(true);
      loadRecent();
    }
  }, [source, loadRecent]);

  function handleInput(e: React.ChangeEvent<HTMLInputElement>) {
    const q = e.target.value;
    setQuery(q);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => search(q, source), 400);
  }

  function handleSourceChange(src: string) {
    setSource(src);
    if (src !== "recent" && query.length >= 2) search(query, src);
  }

  async function nominate(movie: SearchResult) {
    setNominatingId(movie.id);
    try {
      await nominateMovie({
        data: {
          slug: sessionSlug,
          title: movie.title,
          year: movie.year,
          runtimeMinutes: movie.runtimeMinutes,
          synopsis: movie.synopsis,
          posterUrl: movie.posterUrl,
          source: movie.source,
          jellyfinId: movie.jellyfinId,
          tmdbId: movie.tmdbId,
          status: movie.status,
        },
      });
      onMovieAdded();
      setOpen(false);
      setQuery("");
      setResults([]);
    } catch (err: any) {
      if (err?.message?.includes("DUPLICATE")) {
        onMovieAdded();
        setOpen(false);
      } else {
        setError(err?.message ?? "Failed to nominate");
      }
    } finally {
      setNominatingId(null);
    }
  }

  async function requestAndNominate(movie: SearchResult) {
    if (!movie.tmdbId) return;
    setRequestingId(movie.id);
    try {
      await requestMovie({
        data: {
          slug: sessionSlug,
          title: movie.title,
          year: movie.year,
          runtimeMinutes: movie.runtimeMinutes,
          synopsis: movie.synopsis,
          posterUrl: movie.posterUrl,
          tmdbId: movie.tmdbId,
        },
      });
      onMovieAdded();
      setOpen(false);
      setQuery("");
      setResults([]);
    } catch (err: any) {
      if (err?.message?.includes("DUPLICATE")) {
        onMovieAdded();
        setOpen(false);
      } else {
        setError(err?.message ?? "Failed to request");
      }
    } finally {
      setRequestingId(null);
    }
  }

  return (
    <div className="search-bar">
      <div className="search-bar__controls">
        <div className="search-bar__source-tabs">
          <button
            className={`search-bar__tab${source === "jellyfin" ? " active" : ""}`}
            onClick={() => handleSourceChange("jellyfin")}
          >
            Library
          </button>
          {allowRequests && (
            <button
              className={`search-bar__tab${source === "tmdb" ? " active" : ""}`}
              onClick={() => handleSourceChange("tmdb")}
            >
              Request
            </button>
          )}
          <button
            className={`search-bar__tab${source === "recent" ? " active" : ""}`}
            onClick={() => handleSourceChange("recent")}
          >
            Recent
          </button>
        </div>
        {source !== "recent" && (
          <div className="search-bar__input-wrap">
            <span className="search-bar__icon">▷</span>
            <input
              ref={inputRef}
              className="search-bar__input"
              type="text"
              placeholder={source === "jellyfin" ? "Search your library..." : "Search all movies..."}
              value={query}
              onChange={handleInput}
              onFocus={() => setOpen(true)}
            />
            {query && (
              <button
                className="search-bar__clear"
                onClick={() => {
                  setQuery("");
                  setResults([]);
                  inputRef.current?.focus();
                }}
              >
                ×
              </button>
            )}
          </div>
        )}
      </div>

      <AnimatePresence>
        {open && (source === "recent" || query.length >= 2) && (
          <motion.div
            className="search-results"
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.15 }}
          >
            {loading && (
              <div className="search-results__loading">
                <span className="label-mono">{source === "recent" ? "Loading recent..." : "Searching..."}</span>
              </div>
            )}
            {error && (
              <div className="search-results__error">
                <span className="label-mono text-danger">{error}</span>
              </div>
            )}
            {!loading && results.length === 0 && !error && (
              <div className="search-results__empty">
                <span className="label-mono">
                  {source === "recent" ? "No recently added movies found." : `No results for "${query}"`}
                </span>
              </div>
            )}
            {results.map((movie) => (
              <SearchResultItem
                key={movie.id}
                movie={movie}
                source={source}
                allowRequests={allowRequests}
                onNominate={() => nominate(movie)}
                onRequest={() => requestAndNominate(movie)}
                isNominating={nominatingId === movie.id}
                isRequesting={requestingId === movie.id}
              />
            ))}
            <button className="search-results__close" onClick={() => { setOpen(false); if (source === "recent") setSource("jellyfin"); }}>
              <span className="label-mono">Close</span>
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function SearchResultItem({
  movie,
  source,
  allowRequests,
  onNominate,
  onRequest,
  isNominating,
  isRequesting,
}: {
  movie: SearchResult;
  source: string;
  allowRequests: boolean;
  onNominate: () => void;
  onRequest: () => void;
  isNominating: boolean;
  isRequesting: boolean;
}) {
  const isLibrary = movie.status === "in_library";
  const isRequested = movie.status === "requested";
  const canRequest = source === "tmdb" && allowRequests && !isLibrary && !isRequested;
  const canNominate = isLibrary || isRequested || !allowRequests;

  return (
    <div className="search-result-item">
      {movie.posterUrl && (
        <img
          src={movie.posterUrl}
          alt={movie.title}
          className="search-result-item__poster"
          loading="lazy"
          onError={(e) => {
            (e.target as HTMLImageElement).style.display = "none";
          }}
        />
      )}
      <div className="search-result-item__info">
        <span className="search-result-item__title">{movie.title}</span>
        <div className="search-result-item__meta">
          {movie.year && <span>{movie.year}</span>}
          {movie.runtimeMinutes && <span>{movie.runtimeMinutes}m</span>}
          <span className={`badge ${isLibrary ? "badge-library" : isRequested ? "badge-requested" : "badge-nominated"}`}>
            {isLibrary ? "In Library" : isRequested ? "Requested" : "Not In Library"}
          </span>
        </div>
      </div>
      <div className="search-result-item__actions">
        {(canNominate || isLibrary || isRequested) && (
          <button
            className="btn btn-sm btn-primary"
            onClick={onNominate}
            disabled={isNominating || isRequesting}
          >
            {isNominating ? "..." : "Nominate"}
          </button>
        )}
        {canRequest && (
          <button
            className="btn btn-sm btn-orange"
            onClick={onRequest}
            disabled={isRequesting || isNominating}
          >
            {isRequesting ? "..." : "Request & Nominate"}
          </button>
        )}
      </div>
    </div>
  );
}
