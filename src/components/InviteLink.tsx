import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { copyToClipboard } from "../utils/clipboard";

type Props = {
  inviteUrl: string | null;
  slotsRemaining: number;
};

export default function InviteLink({ inviteUrl, slotsRemaining }: Props) {
  const [copied, setCopied] = useState(false);
  const [expanded, setExpanded] = useState(false);

  function copy() {
    if (!inviteUrl) return;
    copyToClipboard(inviteUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    });
  }

  if (!inviteUrl) {
    return (
      <div className="invite-link invite-link--empty">
        <span className="label-mono">Invite full — voting only</span>
      </div>
    );
  }

  return (
    <div className="invite-link">
      <button
        className="invite-link__toggle"
        onClick={() => setExpanded((e) => !e)}
        title="Your invite link"
      >
        <span className="invite-link__icon">⬡</span>
        <span className="label-mono">Your Invite</span>
        <span className="invite-link__slot-count label-mono">{slotsRemaining} left</span>
      </button>

      <AnimatePresence>
        {expanded && (
          <motion.div
            className="invite-link__drawer"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            <div className="invite-link__content">
              <p className="label-mono invite-link__headline">Your Personal Invite Link</p>
              <div className="invite-link__code-box">
                <span className="invite-link__stamp">PASS</span>
                <span className="invite-link__url">{inviteUrl}</span>
              </div>
              <button
                className={`btn btn-secondary btn-sm invite-link__copy${copied ? " invite-link__copy--done" : ""}`}
                onClick={copy}
              >
                {copied ? "✓ Copied" : "Copy Link"}
              </button>
              <p className="label-mono invite-link__note">
                One-time use · Brings in {slotsRemaining} person{slotsRemaining !== 1 ? "s" : ""}
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
