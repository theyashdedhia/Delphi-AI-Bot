const msalConfig = {
  auth: {
    clientId: "YOUR_CLIENT_ID",                             // from Azure App Registration
    authority: "https://login.microsoftonline.com/common",  // or your tenant GUID/domain
    redirectUri: window.location.origin,                    // must be in Azure → Authentication
  },
  cache: { cacheLocation: "sessionStorage", storeAuthStateInCookie: false },
};

export const loginRequest = { scopes: ["User.Read"] };
export default msalConfig;
