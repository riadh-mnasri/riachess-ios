// © 2026 Riadh MNASRI
import { exchangeCodeAsync, useAuthRequest } from "expo-auth-session";
import { useCallback, useEffect, useState } from "react";
import { CLIENT_ID, SCOPES, discovery, type AuthState } from "./oauth";
import { clearToken, loadToken, saveToken } from "./tokenStore";

const PENDING_KEY = "riachess.lichess.pkce";

/**
 * Web : redirection pleine page vers Lichess puis retour sur /online, plutôt
 * qu'une fenêtre surgissante (bloquée ou mal refermée, notamment sur Safari iPhone).
 */
export function useLichessAuth() {
  const [token, setToken] = useState<string | null>(null);
  const [state, setState] = useState<AuthState>("loading");
  const [error, setError] = useState<string | null>(null);
  const redirectUri = `${window.location.origin}/online`;
  const [request] = useAuthRequest({ clientId: CLIENT_ID, scopes: SCOPES, redirectUri, usePKCE: true }, discovery);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get("code");
    const pending = sessionStorage.getItem(PENDING_KEY);
    if (!code || !pending) {
      void loadToken().then((stored) => {
        setToken(stored);
        setState(stored ? "signedIn" : "signedOut");
      });
      return;
    }
    sessionStorage.removeItem(PENDING_KEY);
    window.history.replaceState(null, "", window.location.pathname);
    const { verifier, expectedState } = JSON.parse(pending) as { verifier: string; expectedState: string };
    if (params.get("state") !== expectedState) {
      setError("state");
      setState("signedOut");
      return;
    }
    setState("signingIn");
    exchangeCodeAsync({ clientId: CLIENT_ID, code, redirectUri, extraParams: { code_verifier: verifier } }, discovery)
      .then(async ({ accessToken }) => {
        await saveToken(accessToken);
        setToken(accessToken);
        setState("signedIn");
      })
      .catch((reason: unknown) => {
        setError(String(reason));
        setState("signedOut");
      });
  }, [redirectUri]);

  const signIn = useCallback(async () => {
    if (!request?.codeVerifier) return;
    setError(null);
    setState("signingIn");
    const url = await request.makeAuthUrlAsync(discovery);
    sessionStorage.setItem(PENDING_KEY, JSON.stringify({ verifier: request.codeVerifier, expectedState: request.state }));
    window.location.assign(url);
  }, [request]);

  const signOut = useCallback(async () => {
    await clearToken();
    setToken(null);
    setState("signedOut");
  }, []);

  return { token, state, error, signIn: () => void signIn(), signOut, ready: !!request };
}
