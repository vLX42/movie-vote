import { AnimatePresence, motion, useAnimation } from "framer-motion";
import { useEffect } from "react";

export type Emotion = "happy" | "sad" | "confused" | "overjoyed" | "angry";

interface StickManProps {
  emotion: Emotion;
  size?: number;
  speaking?: boolean;
}

// ── Emotion configurations ─────────────────────────────────────────────────
interface EmotionConfig {
  // Eyebrows [left, right]: { y offset from base, rotate degrees }
  leftBrow: { y: number; rotate: number; scaleX: number };
  rightBrow: { y: number; rotate: number; scaleX: number };
  // Eyes: scaleY (0=closed, 1=open)
  leftEyeScaleY: number;
  rightEyeScaleY: number;
  // Pupils offset
  pupilOffset: { x: number; y: number };
  // Mouth: Q control point Y (higher number = bigger smile in SVG coords)
  mouthCtrlY: number;
  mouthWidth: number;
  // Arms: endpoint coords [x, y] and control point
  leftArm: { cx: number; cy: number; ex: number; ey: number };
  rightArm: { cx: number; cy: number; ex: number; ey: number };
  // Legs spread
  leftLeg: { cx: number; cy: number; ex: number; ey: number };
  rightLeg: { cx: number; cy: number; ex: number; ey: number };
  // Head tilt
  headRotate: number;
  // Blush opacity
  blush: number;
  // Show X eyes
  xEyes: boolean;
  // Body sway
  bodySway: number;
  // Bounce speed (0 = no bounce extra)
  bounceAmplitude: number;
  bounceSpeed: number;
}

const EMOTIONS: Record<Emotion, EmotionConfig> = {
  happy: {
    leftBrow: { y: -2, rotate: -5, scaleX: 1 },
    rightBrow: { y: -2, rotate: 5, scaleX: 1 },
    leftEyeScaleY: 1,
    rightEyeScaleY: 1,
    pupilOffset: { x: 0, y: 1 },
    mouthCtrlY: 66,
    mouthWidth: 1,
    leftArm: { cx: 36, cy: 102, ex: 20, ey: 118 },
    rightArm: { cx: 64, cy: 102, ex: 80, ey: 118 },
    leftLeg: { cx: 46, cy: 145, ex: 35, ey: 175 },
    rightLeg: { cx: 54, cy: 145, ex: 65, ey: 175 },
    headRotate: 0,
    blush: 0.55,
    xEyes: false,
    bodySway: 0,
    bounceAmplitude: 3,
    bounceSpeed: 2.5,
  },
  sad: {
    leftBrow: { y: 2, rotate: 15, scaleX: 1 },
    rightBrow: { y: 2, rotate: -15, scaleX: 1 },
    leftEyeScaleY: 0.5,
    rightEyeScaleY: 0.5,
    pupilOffset: { x: 0, y: 3 },
    mouthCtrlY: 42,
    mouthWidth: 0.8,
    leftArm: { cx: 42, cy: 105, ex: 30, ey: 130 },
    rightArm: { cx: 58, cy: 105, ex: 70, ey: 130 },
    leftLeg: { cx: 47, cy: 143, ex: 38, ey: 172 },
    rightLeg: { cx: 53, cy: 143, ex: 62, ey: 172 },
    headRotate: -4,
    blush: 0,
    xEyes: false,
    bodySway: 0,
    bounceAmplitude: 1,
    bounceSpeed: 3.5,
  },
  confused: {
    leftBrow: { y: -8, rotate: -20, scaleX: 1.1 },
    rightBrow: { y: 2, rotate: 10, scaleX: 0.8 },
    leftEyeScaleY: 1,
    rightEyeScaleY: 0.45,
    pupilOffset: { x: -2, y: 0 },
    mouthCtrlY: 52,
    mouthWidth: 0.7,
    // Right arm raised like scratching head
    leftArm: { cx: 40, cy: 103, ex: 22, ey: 122 },
    rightArm: { cx: 62, cy: 98, ex: 74, ey: 72 },
    leftLeg: { cx: 46, cy: 144, ex: 34, ey: 173 },
    rightLeg: { cx: 54, cy: 144, ex: 66, ey: 173 },
    headRotate: 8,
    blush: 0,
    xEyes: false,
    bodySway: 2,
    bounceAmplitude: 2,
    bounceSpeed: 3,
  },
  overjoyed: {
    leftBrow: { y: -12, rotate: -8, scaleX: 1.15 },
    rightBrow: { y: -12, rotate: 8, scaleX: 1.15 },
    leftEyeScaleY: 0.08,
    rightEyeScaleY: 0.08,
    pupilOffset: { x: 0, y: 0 },
    mouthCtrlY: 70,
    mouthWidth: 1.2,
    leftArm: { cx: 34, cy: 98, ex: 14, ey: 80 },
    rightArm: { cx: 66, cy: 98, ex: 86, ey: 80 },
    leftLeg: { cx: 45, cy: 144, ex: 30, ey: 176 },
    rightLeg: { cx: 55, cy: 144, ex: 70, ey: 176 },
    headRotate: 0,
    blush: 0.9,
    xEyes: false,
    bodySway: 0,
    bounceAmplitude: 14,
    bounceSpeed: 0.5,
  },
  angry: {
    leftBrow: { y: 3, rotate: 28, scaleX: 1.05 },
    rightBrow: { y: 3, rotate: -28, scaleX: 1.05 },
    leftEyeScaleY: 0.7,
    rightEyeScaleY: 0.7,
    pupilOffset: { x: 0, y: 2 },
    mouthCtrlY: 38,
    mouthWidth: 0.85,
    // Arms on hips (pointing outward + down)
    leftArm: { cx: 38, cy: 104, ex: 18, ey: 108 },
    rightArm: { cx: 62, cy: 104, ex: 82, ey: 108 },
    leftLeg: { cx: 46, cy: 144, ex: 34, ey: 174 },
    rightLeg: { cx: 54, cy: 144, ex: 66, ey: 174 },
    headRotate: 0,
    blush: 0,
    xEyes: true,
    bodySway: 0,
    bounceAmplitude: 2,
    bounceSpeed: 0.8,
  },
};

// Spring transition used for all body part animations
const SPRING = { type: "spring", stiffness: 280, damping: 24 } as const;

export default function StickMan({ emotion, size = 200, speaking = false }: StickManProps) {
  const cfg = EMOTIONS[emotion];
  const headShake = useAnimation();

  // Trigger head shake on angry
  useEffect(() => {
    if (emotion === "angry") {
      headShake.start({
        x: [-4, 5, -4, 4, -2, 2, 0],
        transition: { duration: 0.55, ease: "easeInOut" },
      });
    } else {
      headShake.start({ x: 0, transition: SPRING });
    }
  }, [emotion, headShake]);

  // Bounce animation for overjoyed vs idle float
  const bodyFloat =
    emotion === "overjoyed"
      ? {
          y: [0, -cfg.bounceAmplitude, 0],
          transition: { duration: cfg.bounceSpeed, repeat: Infinity, ease: "easeInOut" },
        }
      : {
          y: [0, -cfg.bounceAmplitude, 0],
          transition: { duration: cfg.bounceSpeed, repeat: Infinity, ease: "easeInOut" },
        };

  // Brow base Y positions (in SVG units)
  const leftBrowBaseY = 23;
  const rightBrowBaseY = 23;

  // Mouth path: always same structure M x Q cx,cy x
  const mouthScale = cfg.mouthWidth;
  const mx1 = 50 - 16 * mouthScale;
  const mx2 = 50 + 16 * mouthScale;
  const mouthPath = `M ${mx1},54 Q 50,${cfg.mouthCtrlY} ${mx2},54`;

  // Speaking wobble on mouth ctrl y
  const speakCtrlY = speaking ? cfg.mouthCtrlY - 5 : cfg.mouthCtrlY;

  // Body path: slightly S-curved for organic feel
  const bodyPath = `M 50,75 C ${48 + cfg.bodySway},92 ${52 - cfg.bodySway},112 50,130`;

  return (
    <motion.svg
      viewBox="0 0 100 200"
      width={size}
      height={size * (200 / 100)}
      style={{ overflow: "visible", display: "block" }}
      animate={bodyFloat}
    >
      {/* ── Defs: clip paths for eyelids ── */}
      <defs>
        <clipPath id="leftEyeClip">
          <rect x="22" y="26" width="20" height="20" rx="10" />
        </clipPath>
        <clipPath id="rightEyeClip">
          <rect x="58" y="26" width="20" height="20" rx="10" />
        </clipPath>
      </defs>

      {/* ── Whole figure group (for head shake on angry) ── */}
      <motion.g animate={headShake}>

        {/* ── Shadow ── */}
        <motion.ellipse
          cx={50}
          cy={198}
          rx={18}
          ry={4}
          fill="rgba(0,0,0,0.18)"
          animate={{ rx: emotion === "overjoyed" ? [18, 12, 18] : 18 }}
          transition={
            emotion === "overjoyed"
              ? { duration: cfg.bounceSpeed, repeat: Infinity, ease: "easeInOut" }
              : SPRING
          }
        />

        {/* ── Legs ── */}
        <motion.path
          d={`M 50,130 C ${cfg.leftLeg.cx},${cfg.leftLeg.cy} ${cfg.leftLeg.cx - 2},${cfg.leftLeg.cy + 15} ${cfg.leftLeg.ex},${cfg.leftLeg.ey}`}
          stroke="#2a1a0e"
          strokeWidth={3.2}
          strokeLinecap="round"
          fill="none"
          animate={{
            d: `M 50,130 C ${cfg.leftLeg.cx},${cfg.leftLeg.cy} ${cfg.leftLeg.cx - 2},${cfg.leftLeg.cy + 15} ${cfg.leftLeg.ex},${cfg.leftLeg.ey}`,
          }}
          transition={SPRING}
        />
        <motion.path
          d={`M 50,130 C ${cfg.rightLeg.cx},${cfg.rightLeg.cy} ${cfg.rightLeg.cx + 2},${cfg.rightLeg.cy + 15} ${cfg.rightLeg.ex},${cfg.rightLeg.ey}`}
          stroke="#2a1a0e"
          strokeWidth={3.2}
          strokeLinecap="round"
          fill="none"
          animate={{
            d: `M 50,130 C ${cfg.rightLeg.cx},${cfg.rightLeg.cy} ${cfg.rightLeg.cx + 2},${cfg.rightLeg.cy + 15} ${cfg.rightLeg.ex},${cfg.rightLeg.ey}`,
          }}
          transition={SPRING}
        />

        {/* ── Arms ── */}
        <motion.path
          d={`M 50,90 C ${cfg.leftArm.cx},${cfg.leftArm.cy} ${cfg.leftArm.cx - 6},${cfg.leftArm.cy + 10} ${cfg.leftArm.ex},${cfg.leftArm.ey}`}
          stroke="#2a1a0e"
          strokeWidth={3.2}
          strokeLinecap="round"
          fill="none"
          animate={{
            d: `M 50,90 C ${cfg.leftArm.cx},${cfg.leftArm.cy} ${cfg.leftArm.cx - 6},${cfg.leftArm.cy + 10} ${cfg.leftArm.ex},${cfg.leftArm.ey}`,
          }}
          transition={SPRING}
        />
        <motion.path
          d={`M 50,90 C ${cfg.rightArm.cx},${cfg.rightArm.cy} ${cfg.rightArm.cx + 6},${cfg.rightArm.cy + 10} ${cfg.rightArm.ex},${cfg.rightArm.ey}`}
          stroke="#2a1a0e"
          strokeWidth={3.2}
          strokeLinecap="round"
          fill="none"
          animate={{
            d: `M 50,90 C ${cfg.rightArm.cx},${cfg.rightArm.cy} ${cfg.rightArm.cx + 6},${cfg.rightArm.cy + 10} ${cfg.rightArm.ex},${cfg.rightArm.ey}`,
          }}
          transition={SPRING}
        />

        {/* ── Body ── */}
        <motion.path
          d={bodyPath}
          stroke="#2a1a0e"
          strokeWidth={3.5}
          strokeLinecap="round"
          fill="none"
          animate={{ d: bodyPath }}
          transition={SPRING}
        />

        {/* ── Head (CRT TV shape) ── */}
        <motion.g animate={{ rotate: cfg.headRotate }} style={{ originX: "50px", originY: "44px" }} transition={SPRING}>
          {/* Head fill */}
          <motion.rect
            x={14}
            y={5}
            width={72}
            height={62}
            rx={22}
            ry={22}
            fill="#f0d090"
            stroke="#2a1a0e"
            strokeWidth={2.8}
          />

          {/* ── Cheek blush ── */}
          <motion.ellipse
            cx={22}
            cy={50}
            rx={6}
            ry={4}
            fill="#f07090"
            animate={{ opacity: cfg.blush }}
            transition={SPRING}
          />
          <motion.ellipse
            cx={78}
            cy={50}
            rx={6}
            ry={4}
            fill="#f07090"
            animate={{ opacity: cfg.blush }}
            transition={SPRING}
          />

          {/* ── Left Eye ── */}
          <motion.g style={{ originX: "32px", originY: "36px" }}>
            {/* Eye white */}
            <circle cx={32} cy={36} r={9} fill="#fff" stroke="#2a1a0e" strokeWidth={1.5} />
            {/* Eyelid overlay (for sad/squint) */}
            <motion.rect
              x={22}
              y={26}
              width={20}
              rx={3}
              fill="#f0d090"
              animate={{ height: (1 - cfg.leftEyeScaleY) * 16 + 1 }}
              transition={SPRING}
            />
            {/* Pupil */}
            <motion.circle
              cx={32}
              cy={36}
              r={4}
              fill="#2a1a0e"
              animate={{
                cx: 32 + cfg.pupilOffset.x,
                cy: 36 + cfg.pupilOffset.y,
              }}
              transition={SPRING}
            />
            {/* Pupil shine */}
            <motion.circle
              cx={34}
              cy={33}
              r={1.4}
              fill="#fff"
              animate={{
                cx: 34 + cfg.pupilOffset.x,
                cy: 33 + cfg.pupilOffset.y,
                opacity: cfg.xEyes ? 0 : 1,
              }}
              transition={SPRING}
            />
          </motion.g>

          {/* ── Right Eye ── */}
          <motion.g style={{ originX: "68px", originY: "36px" }}>
            <circle cx={68} cy={36} r={9} fill="#fff" stroke="#2a1a0e" strokeWidth={1.5} />
            <motion.rect
              x={58}
              y={26}
              width={20}
              rx={3}
              fill="#f0d090"
              animate={{ height: (1 - cfg.rightEyeScaleY) * 16 + 1 }}
              transition={SPRING}
            />
            <motion.circle
              cx={68}
              cy={36}
              r={4}
              fill="#2a1a0e"
              animate={{
                cx: 68 + cfg.pupilOffset.x,
                cy: 36 + cfg.pupilOffset.y,
              }}
              transition={SPRING}
            />
            <motion.circle
              cx={70}
              cy={33}
              r={1.4}
              fill="#fff"
              animate={{
                cx: 70 + cfg.pupilOffset.x,
                cy: 33 + cfg.pupilOffset.y,
                opacity: cfg.xEyes ? 0 : 1,
              }}
              transition={SPRING}
            />
          </motion.g>

          {/* ── X Eyes overlay (angry) ── */}
          <AnimatePresence>
            {cfg.xEyes && (
              <motion.g
                key="x-eyes"
                initial={{ opacity: 0, scale: 0.5 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.5 }}
                transition={{ duration: 0.25 }}
                style={{ originX: "50px", originY: "36px" }}
              >
                {/* Left X */}
                <line x1="25" y1="29" x2="39" y2="43" stroke="#c44040" strokeWidth={2.8} strokeLinecap="round" />
                <line x1="39" y1="29" x2="25" y2="43" stroke="#c44040" strokeWidth={2.8} strokeLinecap="round" />
                {/* Right X */}
                <line x1="61" y1="29" x2="75" y2="43" stroke="#c44040" strokeWidth={2.8} strokeLinecap="round" />
                <line x1="75" y1="29" x2="61" y2="43" stroke="#c44040" strokeWidth={2.8} strokeLinecap="round" />
              </motion.g>
            )}
          </AnimatePresence>

          {/* ── Mouth ── */}
          <motion.path
            d={mouthPath}
            stroke="#2a1a0e"
            strokeWidth={2.4}
            strokeLinecap="round"
            fill="none"
            animate={{ d: speaking ? `M ${mx1},54 Q 50,${speakCtrlY} ${mx2},54` : mouthPath }}
            transition={
              speaking
                ? { duration: 0.18, repeat: Infinity, repeatType: "reverse", ease: "easeInOut" }
                : SPRING
            }
          />

          {/* ── Eyebrows (float above face) ── */}
          {/* Left brow */}
          <motion.rect
            x={23}
            y={leftBrowBaseY}
            width={14}
            height={3.5}
            rx={2}
            fill="#2a1a0e"
            animate={{
              y: leftBrowBaseY + cfg.leftBrow.y,
              rotate: cfg.leftBrow.rotate,
              scaleX: cfg.leftBrow.scaleX,
            }}
            style={{ originX: "30px", originY: `${leftBrowBaseY + 1.75}px` }}
            transition={SPRING}
          />
          {/* Right brow */}
          <motion.rect
            x={63}
            y={rightBrowBaseY}
            width={14}
            height={3.5}
            rx={2}
            fill="#2a1a0e"
            animate={{
              y: rightBrowBaseY + cfg.rightBrow.y,
              rotate: cfg.rightBrow.rotate,
              scaleX: cfg.rightBrow.scaleX,
            }}
            style={{ originX: "70px", originY: `${rightBrowBaseY + 1.75}px` }}
            transition={SPRING}
          />
        </motion.g>

      </motion.g>
    </motion.svg>
  );
}
