import { createFileRoute } from "@tanstack/react-router";
import { AnimatePresence, motion } from "framer-motion";
import { useState } from "react";
import StickMan, { type Emotion } from "~/components/StickMan";

export const Route = createFileRoute("/demo/stickman")({
  component: StickManDemo,
});

const EMOTIONS: { id: Emotion; label: string; emoji: string; description: string }[] = [
  {
    id: "happy",
    label: "Happy",
    emoji: "😊",
    description: "Cheerful and content — a gentle smile with rosy cheeks.",
  },
  {
    id: "sad",
    label: "Sad",
    emoji: "😢",
    description: "Droopy eyelids, downturned brows, arms hanging low.",
  },
  {
    id: "confused",
    label: "Confused",
    emoji: "🤔",
    description: "One brow up, one down, head tilted — scratching the back of the head.",
  },
  {
    id: "overjoyed",
    label: "Overjoyed",
    emoji: "🤩",
    description: "Arms in the air, brows flying off the face, bouncing with joy!",
  },
  {
    id: "angry",
    label: "Angry",
    emoji: "😡",
    description: "X eyes, fierce brows, arms on hips — do not mess with this stick man.",
  },
];

function StickManDemo() {
  const [emotion, setEmotion] = useState<Emotion>("happy");
  const [speaking, setSpeaking] = useState(false);
  const [size, setSize] = useState(240);

  const current = EMOTIONS.find((e) => e.id === emotion)!;

  return (
    <div className="stickman-demo">
      <div className="stickman-demo__header">
        <h1 className="stickman-demo__title">StickMan</h1>
        <p className="stickman-demo__subtitle">An organic animated companion</p>
      </div>

      {/* Stage */}
      <div className="stickman-demo__stage">
        <StickMan emotion={emotion} size={size} speaking={speaking} />

        {/* Emotion label */}
        <AnimatePresence mode="wait">
          <motion.div
            key={emotion}
            className="stickman-demo__emotion-label"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2 }}
          >
            <span className="stickman-demo__emotion-emoji">{current.emoji}</span>
            <span className="stickman-demo__emotion-name">{current.label}</span>
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Controls */}
      <div className="stickman-demo__controls">

        {/* Emotion buttons */}
        <div className="stickman-demo__emotions">
          {EMOTIONS.map((e) => (
            <motion.button
              key={e.id}
              className={`stickman-emotion-btn${emotion === e.id ? " stickman-emotion-btn--active" : ""}`}
              onClick={() => setEmotion(e.id)}
              whileTap={{ scale: 0.93 }}
              whileHover={{ scale: 1.05 }}
            >
              <span className="stickman-emotion-btn__emoji">{e.emoji}</span>
              <span className="stickman-emotion-btn__label">{e.label}</span>
            </motion.button>
          ))}
        </div>

        {/* Description */}
        <AnimatePresence mode="wait">
          <motion.p
            key={emotion}
            className="stickman-demo__description"
            initial={{ opacity: 0, x: 10 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -10 }}
            transition={{ duration: 0.18 }}
          >
            {current.description}
          </motion.p>
        </AnimatePresence>

        {/* Secondary controls */}
        <div className="stickman-demo__secondary">
          {/* Speaking toggle */}
          <label className="stickman-demo__toggle">
            <input
              type="checkbox"
              checked={speaking}
              onChange={(e) => setSpeaking(e.target.checked)}
              className="stickman-demo__checkbox"
            />
            <span className="stickman-demo__toggle-track">
              <span className="stickman-demo__toggle-thumb" />
            </span>
            <span className="stickman-demo__toggle-label">Speaking</span>
          </label>

          {/* Size slider */}
          <div className="stickman-demo__slider-group">
            <label className="stickman-demo__slider-label">
              Size <span className="stickman-demo__slider-value">{size}px</span>
            </label>
            <input
              type="range"
              min={100}
              max={400}
              step={10}
              value={size}
              onChange={(e) => setSize(Number(e.target.value))}
              className="stickman-demo__slider"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
