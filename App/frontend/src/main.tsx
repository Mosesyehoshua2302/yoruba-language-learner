import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { StoreProvider, initContentExports } from "./state/store";
import { AuthProvider, useAuth } from "./state/auth";
import { AuthScreen, AuthSplash } from "./components/Auth/AuthScreen";
import { loadConfig } from "./lib/config";
import { loadContent } from "./lib/content";
import "./index.css";

/**
 * Hard auth gate: the app (and thus cloud sync via StoreProvider) mounts only
 * once signed in. While restoring the session, a neutral splash is shown.
 */
function Gate() {
  const { status } = useAuth();
  if (status === "loading") return <AuthSplash />;
  if (status === "signed-out") return <AuthScreen />;
  return (
    <StoreProvider>
      <App />
    </StoreProvider>
  );
}

// Two things must resolve before the app renders:
//  - runtime config (configures the OIDC client + API base URL)
//  - content + sentences (the store initializes synchronously from them)
// Both are fetched in parallel; content exports are populated before render.
Promise.all([loadConfig(), loadContent()]).then(() => {
  initContentExports();
  ReactDOM.createRoot(document.getElementById("root")!).render(
    <React.StrictMode>
      <AuthProvider>
        <Gate />
      </AuthProvider>
    </React.StrictMode>,
  );
});
