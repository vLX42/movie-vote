type Props = {
  codesCreated: number;
  totalSlots: number;
  onOpen: () => void;
};

export default function InviteLink({ codesCreated, totalSlots, onOpen }: Props) {
  if (totalSlots === 0) return null;

  return (
    <button
      className="invite-link__toggle"
      onClick={onOpen}
      title="Manage your invite links"
    >
      <span className="invite-link__icon">⬡</span>
      <span className="label-mono">Invites</span>
      <span className="invite-link__slot-count label-mono">{codesCreated}/{totalSlots}</span>
    </button>
  );
}
