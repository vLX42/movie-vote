import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";

const STORAGE_KEY = "movienightapp_onboarding_v1";

const STEPS = [
  {
    icon: "▷",
    title: "Search for a Movie",
    body: "Type any title in the search bar at the top. The Library tab searches your Jellyfin collection; Request finds anything on TMDB.",
    hint: "Look for the search bar just below the header.",
  },
  {
    icon: "✦",
    title: "Nominate It",
    body: "Pick a result from the dropdown and hit Nominate. The film is added to the shared list — everyone in the room can see and vote on it.",
    hint: "You can also browse the Recent tab for latest additions.",
  },
  {
    icon: "▌▌",
    title: "Cast Your Votes",
    body: "You have __VOTES__ vote token__PLURAL__. Tap Vote on any card to spend one — you can spread them or stack multiple on your top pick.",
    hint: "Your remaining tokens are shown in the header.",
  },
];

type Props = {
  votesPerVoter: number;
};

export default function OnboardingGuide({ votesPerVoter }: Props) {
  const [step, setStep] = useState(0);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    try {
      if (!localStorage.getItem(STORAGE_KEY)) {
        // Small delay so the room finishes rendering first
        const t = setTimeout(() => setVisible(true), 600);
        return () => clearTimeout(t);
      }
    } catch {
      // localStorage unavailable, skip onboarding
    }
  }, []);

  function dismiss() {
    try {
      localStorage.setItem(STORAGE_KEY, "1");
    } catch {}
    setVisible(false);
  }

  function next() {
    if (step < STEPS.length - 1) {
      setStep((s) => s + 1);
    } else {
      dismiss();
    }
  }

  function prev() {
    setStep((s) => Math.max(0, s - 1));
  }

  const current = STEPS[step];
  const body = current.body
    .replace("__VOTES__", String(votesPerVoter))
    .replace("__PLURAL__", votesPerVoter === 1 ? "" : "s");

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          className="onboarding"
          initial={{ opacity: 0, y: 32, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 32, scale: 0.97 }}
          transition={{ type: "spring", stiffness: 340, damping: 28 }}
          role="dialog"
          aria-label="How to use the voting room"
        >
          {/* Header */}
          <div className="onboarding__header">
            <span className="onboarding__label label-mono">How It Works</span>
            <button className="onboarding__skip" onClick={dismiss} aria-label="Skip guide">
              skip
            </button>
          </div>

          {/* Step content — animated on step change */}
          <AnimatePresence mode="wait">
            <motion.div
              key={step}
              className="onboarding__body"
              initial={{ opacity: 0, x: 12 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -12 }}
              transition={{ duration: 0.18 }}
            >
              <span className="onboarding__icon" aria-hidden="true">
                {current.icon}
              </span>
              <div className="onboarding__body-text">
                <p className="onboarding__title">{current.title}</p>
                <p className="onboarding__text">{body}</p>
                <p className="onboarding__hint label-mono">{current.hint}</p>
              </div>
            </motion.div>
          </AnimatePresence>

          {/* Footer */}
          <div className="onboarding__footer">
            <div className="onboarding__dots" aria-label={`Step ${step + 1} of ${STEPS.length}`}>
              {STEPS.map((_, i) => (
                <button
                  key={i}
                  className={`onboarding__dot${i === step ? " active" : ""}`}
                  onClick={() => setStep(i)}
                  aria-label={`Go to step ${i + 1}`}
                />
              ))}
            </div>
            <div className="onboarding__nav">
              {step > 0 && (
                <button className="btn btn-sm btn-secondary" onClick={prev}>
                  Back
                </button>
              )}
              <button className="btn btn-sm btn-primary" onClick={next}>
                {step < STEPS.length - 1 ? "Next" : "Got It"}
              </button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
