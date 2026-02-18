import React, { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { apiPost } from '../hooks/useApi';
import './SearchBar.css';

export default function SearchBar({ sessionSlug, sessionStatus, allowRequests, onMovieAdded }) {
  const [query, setQuery] = useState('');
  const [source, setSource] = useState('jellyfin');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [open, setOpen] = useState(false);
  const [nominatingId, setNominatingId] = useState(null);
  const [requestingId, setRequestingId] = useState(null);
  const debounceRef = useRef(null);
  const inputRef = useRef(null);

  const isOpen = sessionStatus === 'open';

  const search = useCallback(async (q, src) => {
    if (!q || q.length < 2) {
      setResults([]);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const endpoint = src === 'jellyfin' ? `/api/search/jellyfin?q=${encodeURIComponent(q)}` : `/api/search/tmdb?q=${encodeURIComponent(q)}`;
      const res = await fetch(endpoint, { credentials: 'include' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Search failed');
      setResults(data.results || []);
    } catch (err) {
      setError(err.message);
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, []);

  function handleInput(e) {
    const q = e.target.value;
    setQuery(q);
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => search(q, source), 400);
  }

  function handleSourceChange(src) {
    setSource(src);
    if (query.length >= 2) search(query, src);
  }

  async function nominate(movie) {
    setNominatingId(movie.id);
    try {
      const body = {
        title: movie.title,
        year: movie.year,
        runtimeMinutes: movie.runtimeMinutes,
        synopsis: movie.synopsis,
        posterUrl: movie.posterUrl,
        source: movie.source,
        jellyfinId: movie.jellyfinId,
        tmdbId: movie.tmdbId,
        status: movie.status
      };
      const added = await apiPost(`/api/session/${sessionSlug}/movies`, body);
      if (onMovieAdded) onMovieAdded(added);
      setOpen(false);
      setQuery('');
      setResults([]);
    } catch (err) {
      if (err.status === 409) {
        // Already nominated — still close and refresh
        if (onMovieAdded) onMovieAdded(null);
        setOpen(false);
      } else {
        setError(err.message);
      }
    } finally {
      setNominatingId(null);
    }
  }

  async function requestAndNominate(movie) {
    setRequestingId(movie.id);
    try {
      const body = {
        title: movie.title,
        year: movie.year,
        runtimeMinutes: movie.runtimeMinutes,
        synopsis: movie.synopsis,
        posterUrl: movie.posterUrl,
        tmdbId: movie.tmdbId
      };
      const added = await apiPost(`/api/session/${sessionSlug}/request`, body);
      if (onMovieAdded) onMovieAdded(added);
      setOpen(false);
      setQuery('');
      setResults([]);
    } catch (err) {
      if (err.status === 409) {
        if (onMovieAdded) onMovieAdded(null);
        setOpen(false);
      } else {
        setError(err.message);
      }
    } finally {
      setRequestingId(null);
    }
  }

  if (!isOpen) return null;

  return (
    <div className="search-bar">
      <div className="search-bar__controls">
        <div className="search-bar__source-tabs">
          <button
            className={`search-bar__tab ${source === 'jellyfin' ? 'active' : ''}`}
            onClick={() => handleSourceChange('jellyfin')}
          >
            Library
          </button>
          {allowRequests && (
            <button
              className={`search-bar__tab ${source === 'tmdb' ? 'active' : ''}`}
              onClick={() => handleSourceChange('tmdb')}
            >
              Request
            </button>
          )}
        </div>
        <div className="search-bar__input-wrap">
          <span className="search-bar__icon">▷</span>
          <input
            ref={inputRef}
            className="search-bar__input"
            type="text"
            placeholder={source === 'jellyfin' ? 'Search your library...' : 'Search all movies...'}
            value={query}
            onChange={handleInput}
            onFocus={() => setOpen(true)}
          />
          {query && (
            <button
              className="search-bar__clear"
              onClick={() => { setQuery(''); setResults([]); inputRef.current?.focus(); }}
            >
              ×
            </button>
          )}
        </div>
      </div>

      <AnimatePresence>
        {open && (query.length >= 2) && (
          <motion.div
            className="search-results"
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.15 }}
          >
            {loading && (
              <div className="search-results__loading">
                <span className="label-mono">Searching...</span>
              </div>
            )}
            {error && (
              <div className="search-results__error">
                <span className="label-mono text-danger">{error}</span>
              </div>
            )}
            {!loading && results.length === 0 && !error && (
              <div className="search-results__empty">
                <span className="label-mono">No results for "{query}"</span>
              </div>
            )}
            {results.map(movie => (
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
            <button
              className="search-results__close"
              onClick={() => setOpen(false)}
            >
              <span className="label-mono">Close</span>
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function SearchResultItem({ movie, source, allowRequests, onNominate, onRequest, isNominating, isRequesting }) {
  const isLibrary = movie.status === 'in_library';
  const isRequested = movie.status === 'requested';
  const canRequest = source === 'tmdb' && allowRequests && !isLibrary && !isRequested;
  const canNominate = isLibrary || isRequested || !allowRequests;

  return (
    <div className="search-result-item">
      {movie.posterUrl && (
        <img
          src={movie.posterUrl}
          alt={movie.title}
          className="search-result-item__poster"
          loading="lazy"
          onError={(e) => { e.target.style.display = 'none'; }}
        />
      )}
      <div className="search-result-item__info">
        <span className="search-result-item__title">{movie.title}</span>
        <div className="search-result-item__meta">
          {movie.year && <span>{movie.year}</span>}
          {movie.runtimeMinutes && <span>{movie.runtimeMinutes}m</span>}
          <span className={`badge ${movie.status === 'in_library' ? 'badge-library' : movie.status === 'requested' ? 'badge-requested' : 'badge-nominated'}`}>
            {movie.status === 'in_library' ? 'In Library' : movie.status === 'requested' ? 'Requested' : 'Not In Library'}
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
            {isNominating ? '...' : 'Nominate'}
          </button>
        )}
        {canRequest && (
          <button
            className="btn btn-sm btn-orange"
            onClick={onRequest}
            disabled={isRequesting || isNominating}
          >
            {isRequesting ? '...' : 'Request & Nominate'}
          </button>
        )}
      </div>
    </div>
  );
}
