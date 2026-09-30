// © 2026 Riadh MNASRI

// Lichess accepte l'OAuth avec PKCE sans enregistrer d'application : l'identifiant est libre.
export const CLIENT_ID = "riachess.fr";
export const SCOPES = ["board:play"];
export const discovery = {
  authorizationEndpoint: "https://lichess.org/oauth",
  tokenEndpoint: "https://lichess.org/api/token",
};

export type AuthState = "loading" | "signedOut" | "signingIn" | "signedIn";
