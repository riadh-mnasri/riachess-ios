// © 2026 Riadh MNASRI
import { exchangeCodeAsync, makeRedirectUri, useAuthRequest } from "expo-auth-session";
import * as WebBrowser from "expo-web-browser";
import { useCallback, useEffect, useState } from "react";
import { CLIENT_ID, SCOPES, discovery, type AuthState } from "./oauth";
import { clearToken, loadToken, saveToken } from "./tokenStore";

// Android et iOS : Lichess s'ouvre dans le navigateur système puis renvoie vers l'appli (schéma riachess://).
WebBrowser.maybeCompleteAuthSession();

/** Connexion au compte Lichess du joueur, avec le seul droit de jouer des parties (board:play). */
export function useLichessAuth() {
  const [token, setToken] = useState<string | null>(null);
  const [state, setState] = useState<AuthState>("loading");
  const [error, setError] = useState<string | null>(null);
  const redirectUri = makeRedirectUri({ scheme: "riachess", path: "online" });
  const [request, response, promptAsync] = useAuthRequest(
    { clientId: CLIENT_ID, scopes: SCOPES, redirectUri, usePKCE: true },
    discovery,
  );

  useEffect(() => {
    void loadToken().then((stored) => {
      setToken(stored);
      setState(stored ? "signedIn" : "signedOut");
    });
  }, []);

  useEffect(() => {
    if (!response || !request) return;
    if (response.type !== "success") {
      setState("signedOut");
      if (response.type === "error") setError(response.error?.message ?? "OAuth");
      return;
    }
    exchangeCodeAsync(
      {
        clientId: CLIENT_ID,
        code: response.params.code,
        redirectUri,
        extraParams: { code_verifier: request.codeVerifier ?? "" },
      },
      discovery,
    )
      .then(async ({ accessToken }) => {
        await saveToken(accessToken);
        setToken(accessToken);
        setState("signedIn");
      })
      .catch((reason: unknown) => {
        setError(String(reason));
        setState("signedOut");
      });
  }, [response, request, redirectUri]);

  const signIn = useCallback(() => {
    setError(null);
    setState("signingIn");
    void promptAsync();
  }, [promptAsync]);

  const signOut = useCallback(async () => {
    await clearToken();
    setToken(null);
    setState("signedOut");
  }, []);

  return { token, state, error, signIn, signOut, ready: !!request };
}
