import { useCallback, useRef, useState } from 'react';

export const CRM_ORIGIN = 'https://crm-sylvain-v2.hatchable.site';
const BRIDGE_URI = CRM_ORIGIN + '/native-bridge.html';

export function useCrmBridge() {
  const webviewRef = useRef(null);
  const pending = useRef(new Map());
  const counter = useRef(0);
  const readyRef = useRef(false);
  const [phase, setPhase] = useState('connecting');
  const [profile, setProfile] = useState(null);

  const request = useCallback((method, path, body) => {
    if (!readyRef.current || !webviewRef.current) {
      return Promise.reject(new Error('Connexion au CRM indisponible.'));
    }
    if (!/^\/api\//.test(path)) {
      return Promise.reject(new Error('Chemin API interdit.'));
    }
    const id = String(++counter.current);
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        pending.current.delete(id);
        reject(new Error('Le CRM ne répond pas. Réessaie.'));
      }, 25000);
      pending.current.set(id, { resolve, reject, timer });
      const payload = JSON.stringify({ id, method, path, body });
      webviewRef.current.injectJavaScript('window.__crmNativeBridge(' + payload + ');true;');
    });
  }, []);

  const handleMessage = useCallback((event) => {
    let msg;
    try { msg = JSON.parse(event.nativeEvent.data); } catch (_) { return; }
    if (msg.type === 'ready') {
      readyRef.current = true;
      setProfile(msg.profile || null);
      setPhase('ready');
    } else if (msg.type === 'expired' || msg.type === 'denied') {
      readyRef.current = false;
      setPhase(msg.type === 'expired' ? 'login' : 'denied');
      for (const [id, item] of pending.current) {
        clearTimeout(item.timer);
        item.reject(new Error('Compte déconnecté ou accès refusé.'));
        pending.current.delete(id);
      }
    } else if (msg.type === 'connection_error') {
      readyRef.current = false;
      setPhase('connection_error');
    } else if (msg.type === 'response') {
      const item = pending.current.get(msg.id);
      if (!item) return;
      clearTimeout(item.timer);
      pending.current.delete(msg.id);
      if (msg.ok) item.resolve(msg.data);
      else item.reject(new Error(msg.data?.error || msg.error || 'Erreur CRM (' + (msg.status || '') + ')'));
    }
  }, []);

  const navigationChanged = useCallback((nav) => {
    const url = String(nav.url || '');
    if (url.includes('/login.html') || /\/login\?/.test(url)) {
      readyRef.current = false;
      setPhase('login');
    }
  }, []);

  const isAllowedNavigation = useCallback((event) => {
    try {
      const url = new URL(event.url);
      return url.protocol === 'about:' || (url.protocol === 'https:' && url.hostname === 'crm-sylvain-v2.hatchable.site');
    } catch (_) { return false; }
  }, []);

  const disconnect = useCallback(() => {
    if (!webviewRef.current) return;
    readyRef.current = false;
    setProfile(null);
    setPhase('login');
    webviewRef.current.injectJavaScript(
      "Promise.resolve(window.hatchable?.auth?.signOut?.()).finally(()=>location.replace('/login.html?next=%2Fnative-bridge.html'));true;"
    );
  }, []);

  return {
    webviewRef, bridgeUri: BRIDGE_URI, phase, profile, request,
    handleMessage, navigationChanged, isAllowedNavigation, disconnect
  };
}
