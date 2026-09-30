// © 2026 Riadh MNASRI
import * as SecureStore from "expo-secure-store";

// Android et iOS : le jeton Lichess est gardé dans le trousseau sécurisé du système.
const KEY = "riachess.lichess.token";

export const loadToken = () => SecureStore.getItemAsync(KEY);
export const saveToken = (token: string) => SecureStore.setItemAsync(KEY, token);
export const clearToken = () => SecureStore.deleteItemAsync(KEY);
