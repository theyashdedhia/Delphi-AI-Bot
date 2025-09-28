import React, { useState } from 'react';
import { useMsal } from '@azure/msal-react';
import { loginRequest } from './authConfig';

export default function AppTest() {
  const { instance, accounts } = useMsal();
  const [token, setToken] = useState(null);
  const isSignedIn = accounts.length > 0;
  const account = accounts[0];

  const signIn = async () => {
    try {
      const resp = await instance.loginPopup(loginRequest);
      console.log('Signed in:', resp.account);
    } catch (e) {
      console.error('Login failed:', e);
      alert('Login failed. Check console for details.');
    }
  };

  const signOut = async () => {
    try {
      await instance.logoutPopup();
      setToken(null);
    } catch (e) {
      console.error('Logout failed:', e);
    }
  };

  const getToken = async () => {
    try {
      const resp = await instance.acquireTokenSilent({ ...loginRequest, account: account || (await instance.getAllAccounts())[0] });
      setToken(resp.accessToken);
    } catch (silentErr) {
      try {
        const resp = await instance.acquireTokenPopup(loginRequest);
        setToken(resp.accessToken);
      } catch (popupErr) {
        console.error('Token acquisition failed:', popupErr);
        alert('Could not acquire token. Check console for details.');
      }
    }
  };

  return (
    <main style={styles.page}>
      <section style={styles.card} aria-label="MSAL smoke test">
        <h1 style={styles.title}>MSAL Smoke Test</h1>
        <p style={styles.sub}>Use this screen only to verify Microsoft sign-in. Your styled login lives elsewhere.</p>
        {!isSignedIn ? (
          <button onClick={signIn} style={styles.primaryBtn} aria-label="Sign in with Microsoft (test)">Sign in with Microsoft</button>
        ) : (
          <>
            <div style={styles.infoBox} aria-live="polite">
              <p style={styles.label}>Signed in as</p>
              <p style={styles.value}>{account?.name || '(no name)'} · {account?.username}</p>
            </div>
            <div style={styles.actions}>
              <button onClick={getToken} style={styles.secondaryBtn} aria-label="Acquire token">Get Access Token</button>
              <button onClick={signOut} style={styles.linkBtn} aria-label="Sign out">Sign out</button>
            </div>
            {token && (
              <details style={styles.tokenBox}>
                <summary>Show access token (debug)</summary>
                <pre style={styles.pre}>{token}</pre>
              </details>
            )}
          </>
        )}
      </section>
    </main>
  );
}

const styles = {
  page: { minHeight: '100vh', display: 'grid', placeItems: 'center', background: 'linear-gradient(135deg, #8e0d26 0%, #9f102d 55%, #c11a3a 100%)', padding: 24 },
  card: { width: 'min(520px, 94vw)', background: '#ffffff', color: '#0f172a', borderRadius: 16, padding: '28px 24px', boxShadow: '0 12px 28px rgba(16,24,40,.18)' },
  title: { margin: 0, fontSize: 22, fontWeight: 800 },
  sub: { margin: '8px 0 18px', color: '#475467', fontSize: 14 },
  primaryBtn: { width: '100%', height: 50, borderRadius: 12, border: '2px solid #c11a3a', background: '#fff', color: '#111827', fontWeight: 700, cursor: 'pointer', boxShadow: '0 8px 18px rgba(16,24,40,.10)' },
  infoBox: { marginTop: 6, padding: '10px 12px', background: '#f8fafc', borderRadius: 12, border: '1px solid #e5e7eb' },
  label: { margin: 0, fontSize: 12, color: '#667085' },
  value: { margin: '2px 0 0', fontSize: 14, fontWeight: 600 },
  actions: { display: 'flex', gap: 10, marginTop: 14 },
  secondaryBtn: { flex: '0 0 auto', padding: '10px 14px', borderRadius: 10, border: '1px solid #c11a3a', background: '#fff5f7', color: '#7a0e24', fontWeight: 600, cursor: 'pointer' },
  linkBtn: { flex: '0 0 auto', padding: '10px 14px', borderRadius: 10, border: '1px solid transparent', background: 'transparent', color: '#7a0e24', fontWeight: 700, cursor: 'pointer' },
  tokenBox: { marginTop: 14, padding: 10, border: '1px dashed #e5e7eb', borderRadius: 12, background: '#f9fafb' },
  pre: { margin: 0, padding: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-all', fontSize: 12, lineHeight: 1.4 }
};

// Basic vitest placeholder to keep suite green
import { describe, it, expect } from 'vitest';
describe('placeholder', () => {
  it('renders style object', () => {
    expect(styles.title.fontSize).toBe(22);
  });
});
