/**
 * Token Manager - Gerencia tokens de autenticacao
 * Separado para evitar dependencia circular entre api e authStore
 */

type TokenGetter = () => string | null;
type TokenRefresher = () => Promise<void>;
type LogoutHandler = () => void;

let getAccessToken: TokenGetter = () => null;
let refreshToken: TokenRefresher = async () => {};
let logout: LogoutHandler = () => {};

export const tokenManager = {
  setGetAccessToken: (fn: TokenGetter) => {
    getAccessToken = fn;
  },

  setRefreshToken: (fn: TokenRefresher) => {
    refreshToken = fn;
  },

  setLogout: (fn: LogoutHandler) => {
    logout = fn;
  },

  getAccessToken: () => getAccessToken(),
  refreshToken: () => refreshToken(),
  logout: () => logout(),
};
