'use client';
import { useEffect, useState } from 'react';

type BIPEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
};

const DISMISS_KEY = 'pwa_install_dismissed';

export default function InstallPWA() {
  const [deferred, setDeferred] = useState<BIPEvent | null>(null);
  const [show, setShow] = useState(false);
  const [ios, setIos] = useState(false);

  useEffect(() => {
    // Register the service worker (needed for the Android install prompt).
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(() => {});
    }

    // Already installed / running standalone → never show.
    const standalone =
      window.matchMedia?.('(display-mode: standalone)').matches ||
      (window.navigator as any).standalone === true;
    if (standalone) return;

    // User closed the banner before → respect it.
    try { if (localStorage.getItem(DISMISS_KEY) === '1') return; } catch {}

    const ua = navigator.userAgent || '';
    const isIOS = /iphone|ipad|ipod/i.test(ua) && !(window as any).MSStream;
    // iPad on iOS 13+ reports as Mac; detect touch + Apple platform.
    const isIPadOS = navigator.platform === 'MacIntel' && (navigator as any).maxTouchPoints > 1;
    const isInWebApp = /crios|fxios|edgios/i.test(ua); // 3rd-party iOS browsers can't add to home screen the same way
    if ((isIOS || isIPadOS) && !isInWebApp) {
      setIos(true);
      setShow(true);
      return;
    }

    const onBIP = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BIPEvent);
      setShow(true);
    };
    const onInstalled = () => {
      setShow(false);
      try { localStorage.setItem(DISMISS_KEY, '1'); } catch {}
    };
    window.addEventListener('beforeinstallprompt', onBIP);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', onBIP);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  async function install() {
    if (!deferred) return;
    try {
      await deferred.prompt();
      await deferred.userChoice;
    } catch {}
    setDeferred(null);
    setShow(false);
  }

  function dismiss() {
    setShow(false);
    try { localStorage.setItem(DISMISS_KEY, '1'); } catch {}
  }

  if (!show) return null;

  return (
    <div className="fixed top-0 inset-x-0 z-[90] px-3 pt-[env(safe-area-inset-top)]">
      <div className="mx-auto mt-2 max-w-md flex items-center gap-3 rounded-xl bg-fog/95 border border-eldritch/40 px-3 py-2.5 shadow-lg backdrop-blur">
        <img src="/icon-192.png" alt="" className="w-9 h-9 rounded-lg shrink-0" />
        {ios ? (
          <div className="flex-1 min-w-0 text-left text-[12px] leading-snug text-parchment/85">
            <div className="text-parchment font-medium text-[13px]">Install MystNight</div>
            <div>Tap Share <span aria-hidden>⬆️</span> &rarr; <span className="text-eldritch">Add to Home Screen</span></div>
          </div>
        ) : (
          <div className="flex-1 min-w-0 text-left">
            <div className="text-parchment font-medium text-[13px]">Install MystNight</div>
            <div className="text-parchment/70 text-[12px] leading-snug">Add to your home screen — opens full-screen, no app store.</div>
          </div>
        )}
        {!ios && (
          <button
            onClick={install}
            className="shrink-0 px-3.5 py-1.5 rounded-lg bg-blood/85 hover:bg-blood text-parchment text-sm border border-blood">
            Install
          </button>
        )}
        <button
          onClick={dismiss}
          aria-label="Dismiss"
          className="shrink-0 w-7 h-7 rounded-lg text-parchment/50 hover:text-parchment hover:bg-eldritch/20 text-base leading-none">
          ✕
        </button>
      </div>
    </div>
  );
}
