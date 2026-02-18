import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useEffect } from "react";
import { getSession } from "../../../server/sessions";
import LiveResults from "../../../components/LiveResults";

export const Route = createFileRoute("/vote/$slug/results")({
  loader: async ({ params }) => {
    try {
      return await getSession({ data: params.slug });
    } catch {
      return { error: "UNAUTHORIZED" } as const;
    }
  },
  component: ResultsPage,
});

function ResultsPage() {
  const loaderData = Route.useLoaderData();
  const { slug } = Route.useParams();
  const router = useRouter();

  useEffect(() => {
    if (!("session" in loaderData) || loaderData.session.status !== "open") return;
    const interval = setInterval(() => router.invalidate(), 15000);
    return () => clearInterval(interval);
  }, [loaderData, router]);

  if ("error" in loaderData) {
    return (
      <div className="page-centered">
        <p className="label-mono" style={{ color: "var(--accent-red)" }}>
          Access denied. <Link to="/admin">Go to Admin</Link>
        </p>
      </div>
    );
  }

  const { session, movies } = loaderData;

  return (
    <div className="page-container">
      <div style={{ paddingTop: "2rem", paddingBottom: "4rem", maxWidth: 700, margin: "0 auto" }}>
        <div style={{ marginBottom: "1.5rem" }}>
          <p className="label-mono" style={{ color: "var(--text-muted)" }}>Movie Night</p>
          <h1 className="title-large">{session.name}</h1>
          <span className={`badge ${session.status === "open" ? "badge-library" : "badge-requested"}`}>
            {session.status}
          </span>
        </div>

        <LiveResults
          movies={movies}
          sessionStatus={session.status}
          winnerMovieId={session.winnerMovieId}
        />

        <div style={{ marginTop: "2rem" }}>
          <Link
            to="/vote/$slug"
            params={{ slug }}
            className="btn btn-secondary"
          >
            ← Back to Voting Room
          </Link>
        </div>
      </div>
    </div>
  );
}
