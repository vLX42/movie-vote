import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { adminGetSettings, adminUpdateSettings } from "../../server/admin";

export const Route = createFileRoute("/admin/settings")({
  component: SettingsPage,
});

function getAdminSecret() {
  if (typeof window === "undefined") return "";
  return localStorage.getItem("movienightapp_admin_secret") ?? "";
}

function SettingsPage() {
  const [secret, setSecretState] = useState(getAdminSecret);

  const [settings, setSettings] = useState<{
    jellyfinUrl: string;
    jellyfinApiKeySet: boolean;
    jellyseerrUrl: string;
    jellyseerrApiKeySet: boolean;
  } | null>(null);

  const [form, setForm] = useState({
    jellyfinUrl: "",
    jellyfinApiKey: "",
    jellyseerrUrl: "",
    jellyseerrApiKey: "",
    newAdminSecret: "",
    confirmAdminSecret: "",
  });

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  async function loadSettings(currentSecret: string) {
    try {
      const s = await adminGetSettings({ data: currentSecret });
      setSettings(s);
      setForm((f) => ({
        ...f,
        jellyfinUrl: s.jellyfinUrl,
        jellyseerrUrl: s.jellyseerrUrl,
      }));
    } catch (err: any) {
      setError(err?.message ?? "Failed to load settings");
    }
  }

  useEffect(() => {
    if (!secret) return;
    loadSettings(secret);
  }, [secret]);

  if (!secret) {
    return (
      <div className="page-centered">
        <p className="label-mono text-danger">
          Not authenticated. <Link to="/admin">Go to Admin</Link>
        </p>
      </div>
    );
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);

    if (form.newAdminSecret || form.confirmAdminSecret) {
      if (form.newAdminSecret !== form.confirmAdminSecret) {
        setError("New admin passwords do not match");
        return;
      }
      if (!form.newAdminSecret) {
        setError("New admin password cannot be empty");
        return;
      }
    }

    setSaving(true);
    try {
      const payload: Parameters<typeof adminUpdateSettings>[0]["data"] = {
        secret,
        jellyfinUrl: form.jellyfinUrl,
        jellyseerrUrl: form.jellyseerrUrl,
        ...(form.jellyfinApiKey   ? { jellyfinApiKey:   form.jellyfinApiKey   } : {}),
        ...(form.jellyseerrApiKey ? { jellyseerrApiKey: form.jellyseerrApiKey } : {}),
        ...(form.newAdminSecret   ? { newAdminSecret:   form.newAdminSecret   } : {}),
      };

      const result = await adminUpdateSettings({ data: payload });

      if (result.newSecret) {
        localStorage.setItem("movienightapp_admin_secret", result.newSecret);
        setSecretState(result.newSecret);
      }

      setSuccessMsg("Settings saved.");
      setForm((f) => ({
        ...f,
        jellyfinApiKey: "",
        jellyseerrApiKey: "",
        newAdminSecret: "",
        confirmAdminSecret: "",
      }));

      await loadSettings(result.newSecret ?? secret);
    } catch (err: any) {
      if (err?.message?.includes("UNAUTHORIZED")) {
        setError("Unauthorized. Please check your admin secret.");
      } else {
        setError(err?.message ?? "Failed to save settings");
      }
    } finally {
      setSaving(false);
    }
  }

  function field(key: keyof typeof form) {
    return (e: React.ChangeEvent<HTMLInputElement>) =>
      setForm((f) => ({ ...f, [key]: e.target.value }));
  }

  return (
    <div className="admin-page">
      <AdminHeader />
      <div className="admin-content">
        <form className="settings-form" onSubmit={handleSave}>

          {/* Jellyfin */}
          <div className="panel settings-section">
            <h2 className="panel-title">Jellyfin</h2>
            <div className="settings-section__fields">
              <div className="form-group">
                <label className="form-label">Jellyfin URL</label>
                <input
                  type="text"
                  className="form-input"
                  value={form.jellyfinUrl}
                  onChange={field("jellyfinUrl")}
                  placeholder="http://jellyfin:8096"
                />
                <span className="form-hint label-mono">Leave empty to disable Jellyfin search</span>
              </div>
              <div className="form-group">
                <label className="form-label">
                  Jellyfin API Key
                  {settings && (
                    <span className={`settings-key-status settings-key-status--${settings.jellyfinApiKeySet ? "set" : "unset"}`}>
                      {settings.jellyfinApiKeySet ? "(set)" : "(not set)"}
                    </span>
                  )}
                </label>
                <input
                  type="password"
                  className="form-input"
                  value={form.jellyfinApiKey}
                  onChange={field("jellyfinApiKey")}
                  placeholder="Leave blank to keep current value"
                  autoComplete="new-password"
                />
              </div>
            </div>
          </div>

          {/* Jellyseerr */}
          <div className="panel settings-section">
            <h2 className="panel-title">Jellyseerr</h2>
            <div className="settings-section__fields">
              <div className="form-group">
                <label className="form-label">Jellyseerr URL</label>
                <input
                  type="text"
                  className="form-input"
                  value={form.jellyseerrUrl}
                  onChange={field("jellyseerrUrl")}
                  placeholder="http://jellyseerr:5055"
                />
                <span className="form-hint label-mono">Leave empty to disable Jellyseerr requests</span>
              </div>
              <div className="form-group">
                <label className="form-label">
                  Jellyseerr API Key
                  {settings && (
                    <span className={`settings-key-status settings-key-status--${settings.jellyseerrApiKeySet ? "set" : "unset"}`}>
                      {settings.jellyseerrApiKeySet ? "(set)" : "(not set)"}
                    </span>
                  )}
                </label>
                <input
                  type="password"
                  className="form-input"
                  value={form.jellyseerrApiKey}
                  onChange={field("jellyseerrApiKey")}
                  placeholder="Leave blank to keep current value"
                  autoComplete="new-password"
                />
              </div>
            </div>
          </div>

          {/* Admin Password */}
          <div className="panel settings-section">
            <h2 className="panel-title">Admin Password</h2>
            <div className="settings-section__fields">
              <div className="form-group">
                <label className="form-label">New Password</label>
                <input
                  type="password"
                  className="form-input"
                  value={form.newAdminSecret}
                  onChange={field("newAdminSecret")}
                  placeholder="Leave blank to keep current password"
                  autoComplete="new-password"
                />
              </div>
              <div className="form-group">
                <label className="form-label">Confirm New Password</label>
                <input
                  type="password"
                  className="form-input"
                  value={form.confirmAdminSecret}
                  onChange={field("confirmAdminSecret")}
                  placeholder="Repeat new password"
                  autoComplete="new-password"
                />
              </div>
              <span className="form-hint label-mono">
                Changing the password will update your browser session automatically.
              </span>
            </div>
          </div>

          {error   && <p className="label-mono text-danger">{error}</p>}
          {successMsg && <p className="label-mono text-teal">{successMsg}</p>}

          <div className="flex gap-2">
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? "Saving…" : "Save Settings"}
            </button>
            <Link to="/admin" className="btn btn-secondary">Back to Sessions</Link>
          </div>
        </form>
      </div>
    </div>
  );
}

function AdminHeader() {
  return (
    <nav className="admin-nav">
      <Link to="/admin" className="admin-nav__brand">
        <span className="label-mono">Movie Night</span>
        <span className="admin-nav__sep">·</span>
        <span className="label-mono text-muted">Admin</span>
        <span className="admin-nav__sep">·</span>
        <span className="label-mono">Settings</span>
      </Link>
    </nav>
  );
}
