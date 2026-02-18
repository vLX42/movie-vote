import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useState } from "react";
import { adminCreateSession } from "../../../server/admin";

export const Route = createFileRoute("/admin/sessions/new")({
  component: CreateSessionPage,
});

function getAdminSecret() {
  if (typeof window === "undefined") return "";
  return localStorage.getItem("movienightapp_admin_secret") ?? "";
}

function CreateSessionPage() {
  const router = useRouter();
  const secret = getAdminSecret();

  const [form, setForm] = useState({
    name: "",
    slug: "",
    votesPerVoter: 5,
    rootInviteCodes: 1,
    guestInviteSlots: 1,
    maxInviteDepth: "",
    allowJellyseerrRequests: true,
    expiresAt: "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<any>(null);

  if (!secret) {
    return (
      <div className="page-centered">
        <p className="label-mono text-danger">
          Not authenticated. <Link to="/admin">Go to Admin</Link>
        </p>
      </div>
    );
  }

  function slugify(name: string) {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, "")
      .replace(/\s+/g, "-")
      .replace(/-+/g, "-")
      .slice(0, 40);
  }

  function handleNameChange(e: React.ChangeEvent<HTMLInputElement>) {
    const name = e.target.value;
    setForm((f) => ({
      ...f,
      name,
      slug: f.slug === "" || f.slug === slugify(f.name) ? slugify(name) : f.slug,
    }));
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const { name, value, type, checked } = e.target;
    setForm((f) => ({ ...f, [name]: type === "checkbox" ? checked : value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const data = await adminCreateSession({
        data: {
          secret,
          name: form.name,
          slug: form.slug,
          votesPerVoter: Number(form.votesPerVoter),
          rootInviteCodes: Number(form.rootInviteCodes),
          guestInviteSlots: Number(form.guestInviteSlots),
          maxInviteDepth: form.maxInviteDepth ? Number(form.maxInviteDepth) : null,
          allowJellyseerrRequests: form.allowJellyseerrRequests,
          expiresAt: form.expiresAt || null,
        },
      });
      setResult(data);
    } catch (err: any) {
      setError(err?.message ?? "Failed to create session");
    } finally {
      setSubmitting(false);
    }
  }

  if (result) {
    return (
      <div className="admin-page">
        <AdminHeader title="Session Created" />
        <div className="admin-content">
          <div className="panel">
            <h2 className="panel-title">Session Ready</h2>
            <p className="label-mono text-teal">
              {result.session.name} · /vote/{result.session.slug}
            </p>

            <div className="mt-3">
              <p className="form-label mb-1">Root Invite Links</p>
              <div className="invite-list">
                {result.rootInviteLinks.map((link: any) => (
                  <div key={link.code} className="invite-list__item">
                    <span className="invite-list__stamp label-mono">PASS</span>
                    <span className="invite-list__url value-mono">{link.url}</span>
                    <button
                      className="btn btn-secondary btn-sm"
                      onClick={() => navigator.clipboard.writeText(link.url)}
                    >
                      Copy
                    </button>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex gap-2 mt-3" style={{ flexWrap: "wrap" }}>
              <Link
                to="/admin/sessions/$id"
                params={{ id: result.session.id }}
                className="btn btn-primary"
              >
                Manage Session
              </Link>
              <Link to="/admin" className="btn btn-secondary">
                All Sessions
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="admin-page">
      <AdminHeader title="New Session" />
      <div className="admin-content">
        <form className="panel create-session-form" onSubmit={handleSubmit}>
          <h2 className="panel-title">Create Session</h2>

          {error && (
            <div className="label-mono text-danger mb-2">{error}</div>
          )}

          <div className="form-grid">
            <div className="form-group form-grid__full">
              <label className="form-label">Session Name *</label>
              <input
                type="text"
                className="form-input"
                name="name"
                value={form.name}
                onChange={handleNameChange}
                placeholder="e.g. Friday Horror Night"
                required
              />
            </div>

            <div className="form-group form-grid__full">
              <label className="form-label">URL Slug *</label>
              <input
                type="text"
                className="form-input"
                name="slug"
                value={form.slug}
                onChange={handleChange}
                placeholder="friday-horror"
                pattern="[a-z0-9-]+"
                required
              />
              <span className="form-hint label-mono">
                Voting URL: /vote/{form.slug || "your-slug"}
              </span>
            </div>

            <div className="form-group">
              <label className="form-label">Votes per Voter</label>
              <input
                type="number"
                className="form-input"
                name="votesPerVoter"
                value={form.votesPerVoter}
                onChange={handleChange}
                min={1}
                max={20}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Root Invite Codes</label>
              <input
                type="number"
                className="form-input"
                name="rootInviteCodes"
                value={form.rootInviteCodes}
                onChange={handleChange}
                min={1}
                max={20}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Guest Invite Slots</label>
              <input
                type="number"
                className="form-input"
                name="guestInviteSlots"
                value={form.guestInviteSlots}
                onChange={handleChange}
                min={0}
                max={10}
              />
              <span className="form-hint label-mono">0 = guests can't invite others</span>
            </div>

            <div className="form-group">
              <label className="form-label">Max Invite Depth</label>
              <input
                type="number"
                className="form-input"
                name="maxInviteDepth"
                value={form.maxInviteDepth}
                onChange={handleChange}
                min={0}
                placeholder="Unlimited"
              />
              <span className="form-hint label-mono">Leave blank for unlimited</span>
            </div>

            <div className="form-group">
              <label className="form-label">Expires At</label>
              <input
                type="datetime-local"
                className="form-input"
                name="expiresAt"
                value={form.expiresAt}
                onChange={handleChange}
              />
            </div>

            <div className="form-group form-group--check">
              <label className="form-check-label">
                <input
                  type="checkbox"
                  name="allowJellyseerrRequests"
                  checked={form.allowJellyseerrRequests}
                  onChange={handleChange}
                />
                <span>Allow Jellyseerr Movie Requests</span>
              </label>
            </div>
          </div>

          <div className="flex gap-2 mt-3">
            <button type="submit" className="btn btn-primary" disabled={submitting}>
              {submitting ? "Creating..." : "Create Session"}
            </button>
            <Link to="/admin" className="btn btn-secondary">
              Cancel
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}

function AdminHeader({ title }: { title: string }) {
  return (
    <nav className="admin-nav">
      <Link to="/admin" className="admin-nav__brand">
        <span className="label-mono">Movie Night</span>
        <span className="admin-nav__sep">·</span>
        <span className="label-mono text-muted">Admin</span>
        <span className="admin-nav__sep">·</span>
        <span className="label-mono">{title}</span>
      </Link>
    </nav>
  );
}
