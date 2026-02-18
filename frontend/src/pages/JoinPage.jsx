import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import './JoinPage.css';

export default function JoinPage() {
  const { code } = useParams();
  const navigate = useNavigate();
  const [state, setState] = useState('loading'); // loading | success | error
  const [error, setError] = useState(null);
  const [sessionData, setSessionData] = useState(null);
  const [inviteUrl, setInviteUrl] = useState(null);
  const [showInvite, setShowInvite] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    async function claimInvite() {
      try {
        const res = await fetch(`/api/invite/${code}`, { credentials: 'include' });
        const data = await res.json();

        if (!res.ok) {
          setState('error');
          setError(data);
          return;
        }

        setSessionData(data.session);
        setInviteUrl(data.voter.inviteUrl);
        setState('success');

        // Show invite reveal after a short delay for effect
        setTimeout(() => setShowInvite(true), 1200);
      } catch (err) {
        setState('error');
        setError({ error: 'Could not reach the server. Try again.' });
      }
    }

    claimInvite();
  }, [code]);

  function copyInvite() {
    if (!inviteUrl) return;
    navigator.clipboard.writeText(inviteUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  function enterVotingRoom() {
    navigate(`/vote/${sessionData.slug}`);
  }

  if (state === 'loading') {
    return (
      <div className="join-page page-centered">
        <motion.div
          className="join-loading"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
        >
          <div className="join-loading__tape" />
          <p className="join-loading__text label-mono">Validating access...</p>
        </motion.div>
      </div>
    );
  }

  if (state === 'error') {
    const code_type = error?.code;
    return (
      <div className="join-page page-centered">
        <motion.div
          className="join-error"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
        >
          <div className="join-error__icon">⏏</div>
          <h1 className="title-large">
            {code_type === 'ALREADY_USED' && 'Spot Claimed'}
            {code_type === 'REVOKED' && 'Link Revoked'}
            {code_type === 'SESSION_CLOSED' && 'Voting Closed'}
            {code_type === 'INVALID' && 'Invalid Link'}
            {!code_type && 'Access Denied'}
          </h1>
          <p className="join-error__message">
            {code_type === 'ALREADY_USED' && (
              <>This spot was already claimed by someone else.<br />Ask someone on the inside for a fresh invite.</>
            )}
            {code_type === 'REVOKED' && (
              <>This invite link has been revoked by the host.<br />Ask for a new one.</>
            )}
            {code_type === 'SESSION_CLOSED' && (
              <>Voting has wrapped up for <strong>{error.sessionName}</strong>.</>
            )}
            {code_type === 'INVALID' && (
              <>This link doesn't match any active session.</>
            )}
            {!code_type && (error?.error || 'Something went wrong.')}
          </p>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="join-page page-centered">
      <motion.div
        className="join-success"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.5 }}
      >
        <motion.div
          className="join-ticket"
          initial={{ scale: 0.8, rotate: -2, opacity: 0 }}
          animate={{ scale: 1, rotate: -1, opacity: 1 }}
          transition={{ delay: 0.2, type: 'spring', stiffness: 200, damping: 15 }}
        >
          <div className="join-ticket__header">
            <span className="label-mono">Admit One</span>
            <span className="join-ticket__dot" />
            <span className="join-ticket__dot" />
            <span className="join-ticket__dot" />
          </div>
          <h1 className="join-ticket__title title-large">{sessionData.name}</h1>
          <p className="join-ticket__sub label-mono">Movie Night — You're In</p>
          <div className="join-ticket__tear" />
        </motion.div>

        {showInvite && (
          <motion.div
            className="join-invite-reveal"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
          >
            {inviteUrl ? (
              <>
                <p className="label-mono">Your personal invite link</p>
                <div className="join-invite-code">
                  <span className="join-invite-code__stamp">PASS</span>
                  <span className="join-invite-code__url">{inviteUrl}</span>
                </div>
                <button
                  className={`btn btn-secondary join-invite-copy ${copied ? 'copied' : ''}`}
                  onClick={copyInvite}
                >
                  {copied ? 'Copied to Clipboard' : 'Copy Invite Link'}
                </button>
                <p className="join-invite-note label-mono">
                  This link brings in one person. Keep it exclusive.
                </p>
              </>
            ) : (
              <p className="join-invite-note label-mono">
                This session is at capacity — you can vote but cannot invite others.
              </p>
            )}
          </motion.div>
        )}

        <motion.button
          className="btn btn-primary btn-lg join-enter-btn"
          onClick={enterVotingRoom}
          initial={{ opacity: 0 }}
          animate={{ opacity: showInvite ? 1 : 0 }}
          transition={{ delay: 0.2 }}
        >
          Enter Voting Room
        </motion.button>
      </motion.div>
    </div>
  );
}
