import { motion } from "framer-motion";

export default function VoteTokens({ total, used }: { total: number; used: number }) {
  const remaining = total - used;
  const tokens = Array.from({ length: total }, (_, i) => i < remaining);

  const groups: boolean[][] = [];
  for (let i = 0; i < total; i += 5) {
    groups.push(tokens.slice(i, i + 5));
  }

  return (
    <div className="vote-tokens" title={`${remaining} of ${total} votes remaining`}>
      <span className="vote-tokens__label label-mono">Votes</span>
      <div className="vote-tokens__groups">
        {groups.map((group, gi) => (
          <TallyGroup key={gi} tokens={group} groupIndex={gi} />
        ))}
      </div>
      <span className="vote-tokens__count label-mono">
        {remaining}/{total}
      </span>
    </div>
  );
}

function TallyGroup({ tokens, groupIndex }: { tokens: boolean[]; groupIndex: number }) {
  return (
    <div className="tally-group">
      {tokens.map((active, i) => {
        const isSlash = (i + 1) % 5 === 0;
        return (
          <TallyMark
            key={i}
            active={active}
            isSlash={isSlash}
            index={groupIndex * 5 + i}
          />
        );
      })}
    </div>
  );
}

function TallyMark({ active, isSlash }: { active: boolean; isSlash: boolean; index: number }) {
  return (
    <motion.div
      className={`tally-mark${isSlash ? " tally-mark--slash" : ""}${active ? " tally-mark--active" : " tally-mark--used"}`}
      initial={false}
      animate={{ opacity: active ? 1 : 0.25 }}
      transition={{ duration: 0.15 }}
      title={active ? "Vote available" : "Vote used"}
    >
      {isSlash ? (
        <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <line x1="2" y1="22" x2="22" y2="2" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
          <line x1="4" y1="2" x2="4" y2="22" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          <line x1="9" y1="2" x2="9" y2="22" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          <line x1="14" y1="2" x2="14" y2="22" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          <line x1="19" y1="2" x2="19" y2="22" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
      ) : (
        <svg viewBox="0 0 8 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <line x1="4" y1="2" x2="4" y2="22" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
      )}
    </motion.div>
  );
}
