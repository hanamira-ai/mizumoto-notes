import { useState, useEffect, useCallback } from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';

interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{
    outcome: 'accepted' | 'dismissed';
    platform: string;
  }>;
  prompt(): Promise<void>;
}

export function usePWA() {
  const [isOnline, setIsOnline] = useState<boolean>(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstallDismissed, setIsInstallDismissed] = useState<boolean>(() => {
    try {
      return sessionStorage.getItem('pwa-install-dismissed') === 'true';
    } catch {
      return false;
    }
  });
  const [isInstalled, setIsInstalled] = useState<boolean>(false);

  // Register service worker with virtual:pwa-register/react
  const {
    offlineReady: [offlineReady, setOfflineReady],
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegistered(r) {
      console.log('Service Worker registered successfully:', r);
    },
    onRegisterError(error) {
      console.error('Service Worker registration failed:', error);
    },
  });

  // Track online/offline status
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Listen for beforeinstallprompt event
  useEffect(() => {
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    const handleAppInstalled = () => {
      setIsInstalled(true);
      setDeferredPrompt(null);
      console.log('Mizumoto Notes PWA was successfully installed.');
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const triggerInstall = useCallback(async () => {
    if (!deferredPrompt) return;

    try {
      await deferredPrompt.prompt();
      const choiceResult = await deferredPrompt.userChoice;
      if (choiceResult.outcome === 'accepted') {
        setIsInstalled(true);
      }
    } catch (err) {
      console.error('Install prompt error:', err);
    } finally {
      setDeferredPrompt(null);
    }
  }, [deferredPrompt]);

  const dismissInstall = useCallback(() => {
    setIsInstallDismissed(true);
    try {
      sessionStorage.setItem('pwa-install-dismissed', 'true');
    } catch {
      // Ignore sessionStorage exceptions
    }
  }, []);

  const handleRefreshApp = useCallback(() => {
    updateServiceWorker(true);
  }, [updateServiceWorker]);

  const closeOfflineReady = useCallback(() => {
    setOfflineReady(false);
  }, [setOfflineReady]);

  const closeNeedRefresh = useCallback(() => {
    setNeedRefresh(false);
  }, [setNeedRefresh]);

  const canInstall = Boolean(deferredPrompt && !isInstallDismissed && !isInstalled);

  return {
    isOnline,
    canInstall,
    isInstalled,
    needRefresh,
    offlineReady,
    triggerInstall,
    dismissInstall,
    handleRefreshApp,
    closeOfflineReady,
    closeNeedRefresh,
  };
}
