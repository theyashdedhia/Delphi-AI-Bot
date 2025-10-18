const msalConfig = {
  auth: {
    clientId: import.meta.env.VITE_AAD_CLIENT_ID,
    authority: `https://login.microsoftonline.com/${import.meta.env.VITE_AAD_TENANT_ID}`,
    redirectUri: "https://localhost:3000",        
    postLogoutRedirectUri: "https://localhost:3000",
  },
  cache: { cacheLocation: "sessionStorage", storeAuthStateInCookie: false },
};

export const loginRequest = {
  scopes: [import.meta.env.VITE_API_SCOPE], // or ["openid","profile","email"] while testing
};

export default msalConfig;
