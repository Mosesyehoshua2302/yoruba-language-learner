import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { StoreProvider } from "./state/store";
import { AuthProvider, useAuth } from "./state/auth";
import { AuthScreen, AuthSplash } from "./components/Auth/AuthScreen";
import { loadConfig } from "./lib/config";
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

// Runtime config must resolve before auth (it configures the OIDC client) and
// before the API client picks its base URL.
loadConfig().then(() => {
  ReactDOM.createRoot(document.getElementById("root")!).render(
    <React.StrictMode>
      <AuthProvider>
        <Gate />
      </AuthProvider>
    </React.StrictMode>,
  );
});
