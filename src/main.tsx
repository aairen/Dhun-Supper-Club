import "./index.css";

const rootEl = document.getElementById("root")!;
const env = import.meta.env;
const firebaseConfigured = Boolean(
  env.VITE_FIREBASE_API_KEY &&
    env.VITE_FIREBASE_PROJECT_ID &&
    env.VITE_FIREBASE_APP_ID,
);

if (!firebaseConfigured) {
  rootEl.innerHTML = `
    <div style="min-height:100vh;display:flex;align-items:center;justify-content:center;padding:2rem;font-family:system-ui,sans-serif;background:#fafafa;color:#171717;">
      <div style="max-width:28rem;line-height:1.6;">
        <h1 style="font-size:1.25rem;font-weight:600;margin:0 0 1rem;">Site configuration missing</h1>
        <p style="margin:0 0 1rem;color:#525252;font-size:0.9375rem;">
          This build does not include Firebase settings. GitHub Pages builds need
          <strong> repository secrets</strong> so Vite can embed them at build time.
        </p>
        <p style="margin:0 0 1rem;color:#525252;font-size:0.9375rem;">
          In GitHub: <strong>Settings → Secrets and variables → Actions</strong>, add:
          <code style="display:block;margin-top:0.5rem;padding:0.75rem;background:#fff;border:1px solid #e5e5e5;font-size:0.8125rem;word-break:break-all;">
            VITE_FIREBASE_API_KEY, VITE_FIREBASE_AUTH_DOMAIN, VITE_FIREBASE_PROJECT_ID,<br/>
            VITE_FIREBASE_STORAGE_BUCKET, VITE_FIREBASE_MESSAGING_SENDER_ID, VITE_FIREBASE_APP_ID</code>
        </p>
        <p style="margin:0;color:#737373;font-size:0.8125rem;">
          Optional: <code>VITE_FIREBASE_FIRESTORE_DATABASE_ID</code>, <code>VITE_STRIPE_PUBLIC_KEY</code>.
          Then push to <code>main</code> to redeploy.
        </p>
      </div>
    </div>`;
} else {
  void import("./bootstrap");
}
