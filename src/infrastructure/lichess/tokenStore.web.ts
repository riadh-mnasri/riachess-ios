// © 2026 Riadh MNASRI
import AsyncStorage from "@react-native-async-storage/async-storage";

// Web : pas de trousseau sécurisé, le jeton est gardé dans le stockage du navigateur.
const KEY = "riachess.lichess.token";

export const loadToken = () => AsyncStorage.getItem(KEY);
export const saveToken = (token: string) => AsyncStorage.setItem(KEY, token);
export const clearToken = () => AsyncStorage.removeItem(KEY);
