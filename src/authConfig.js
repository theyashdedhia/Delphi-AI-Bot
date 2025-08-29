
const msalConfig = {
  auth: {
    clientId: "CLIENT_ID",                             // from Azure App Registration
    authority: "https://login.microsoftonline.com/common",  // or your tenant GUID/domain or 'organizations'
    redirectUri: window.location.origin,                    // must be listed in Azure → Authentication (SPA)
  },
  cache: { cacheLocation: "sessionStorage", storeAuthStateInCookie: false },
};

export const loginRequest = { scopes: ["User.Read"] };
export default msalConfig;
