import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { claimInvite } from "../../server/invites";
import { getBrowserFingerprint } from "../../utils/fingerprint";

export const Route = createFileRoute("/join/$code")({
  component: JoinPage,
});

function JoinPage() {
  const { code } = Route.useParams();
  const router = useRouter();
  const [state, setState] = useState<"loading" | "success" | "error">("loading");
  const [errorData, setErrorData] = useState<{ code?: string; message: string; sessionName?: string; slug?: string } | null>(null);
  const [sessionData, setSessionData] = useState<{ name: string; slug: string; inviteSlotsRemaining: number } | null>(null);
  const [showEnter, setShowEnter] = useState(false);

  useEffect(() => {
    getBrowserFingerprint()
      .then((fingerprint) => claimInvite({ data: { code, fingerprint } }))
      .then((result) => {
        setSessionData({ name: result.session.name, slug: result.session.slug, inviteSlotsRemaining: result.voter.inviteSlotsRemaining });
        setState("success");
        setTimeout(() => setShowEnter(true), 900);
      })
      .catch((err: Error) => {
        const msg = err.message || "";
        const parts = msg.split(":");
        const errorCode = parts[0];
        const details = parts.slice(1).join(":");
        const parsed: typeof errorData = { code: errorCode, message: details };
        if (errorCode === "SESSION_CLOSED") {
          const [sessionName, slug] = details.split(":");
          parsed.sessionName = sessionName;
          parsed.slug = slug;
          parsed.message = details;
        }
        if (errorCode === "FULLY_CLAIMED") {
          parsed.message = details; // contains the maxUses number
        }
        setErrorData(parsed);
        setState("error");
      });
  }, [code]);

  function enterVotingRoom() {
    if (!sessionData) return;
    router.navigate({ to: "/vote/$slug", params: { slug: sessionData.slug } });
  }

  if (state === "loading") {
    return (
      <div className="page-centered">
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
          <div className="join-loading__tape" />
          <p className="label-mono" style={{ color: "var(--text-muted)", marginTop: "1rem" }}>
            Validating access...
          </p>
        </motion.div>
      </div>
    );
  }

  if (state === "error" && errorData) {
    return (
      <div className="page-centered">
        <motion.div
          className="join-error"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
        >
          <div className="join-error__icon">⏏</div>
          <h1 className="title-large">
            {errorData.code === "ALREADY_USED" && "Spot Claimed"}
            {errorData.code === "FULLY_CLAIMED" && "Link Full"}
            {errorData.code === "REVOKED" && "Link Revoked"}
            {errorData.code === "SESSION_CLOSED" && "Voting Closed"}
            {errorData.code === "INVALID" && "Invalid Link"}
            {!["ALREADY_USED", "FULLY_CLAIMED", "REVOKED", "SESSION_CLOSED", "INVALID"].includes(errorData.code ?? "") && "Access Denied"}
          </h1>
          <p className="join-error__message">
            {errorData.code === "ALREADY_USED" && "This spot was already claimed by someone else. Ask someone on the inside for a fresh invite."}
            {errorData.code === "FULLY_CLAIMED" && `This link has already been used on ${errorData.message} device${errorData.message === "1" ? "" : "s"}. Ask the person who shared it to send you a new one.`}
            {errorData.code === "REVOKED" && "This invite link has been revoked by the host. Ask for a new one."}
            {errorData.code === "SESSION_CLOSED" && `Voting has wrapped up for ${errorData.sessionName}.`}
            {errorData.code === "INVALID" && "This link doesn't match any active session."}
            {!["ALREADY_USED", "FULLY_CLAIMED", "REVOKED", "SESSION_CLOSED", "INVALID"].includes(errorData.code ?? "") && (errorData.message || "Something went wrong.")}
          </p>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="page-centered">
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
          transition={{ delay: 0.2, type: "spring", stiffness: 200, damping: 15 }}
        >
          <div className="join-ticket__header">
            <span className="label-mono">Admit One</span>
            <span className="join-ticket__dot" />
            <span className="join-ticket__dot" />
            <span className="join-ticket__dot" />
          </div>
          <h1 className="join-ticket__title title-large">{sessionData?.name}</h1>
          <p className="join-ticket__sub label-mono">Movie Night — You're In</p>
          <div className="join-ticket__tear" />
        </motion.div>

        {showEnter && sessionData && sessionData.inviteSlotsRemaining > 0 && (
          <motion.p
            className="label-mono join-invite-note"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
          >
            You can invite others from the Invites tab once you're inside.
          </motion.p>
        )}

        <motion.button
          className="btn btn-primary btn-lg join-enter-btn"
          onClick={enterVotingRoom}
          initial={{ opacity: 0 }}
          animate={{ opacity: showEnter ? 1 : 0 }}
          transition={{ delay: 0.1 }}
        >
          Enter Voting Room
        </motion.button>
      </motion.div>
    </div>
  );
}
