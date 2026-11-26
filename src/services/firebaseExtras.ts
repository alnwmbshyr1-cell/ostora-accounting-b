import { getDownloadURL, getStorage, ref, uploadString } from 'firebase/storage';
import { getMessaging, getToken, isSupported, onMessage } from 'firebase/messaging';
import { doc, serverTimestamp, setDoc } from 'firebase/firestore';
import { db, firebaseApp } from '../firebase';
import { PersistedState } from '../types/erp';

/**
 * Uploads an image or PDF asset (data URL) to Firebase Storage when online,
 * returning an HTTPS download URL (or falling back to compressed DataURL offline).
 */
export async function uploadAssetWithOfflineFallback(
  workspaceId: string | undefined,
  folder: 'logos' | 'products' | 'customers' | 'suppliers' | 'documents',
  fileName: string,
  dataUrl: string,
): Promise<{ url: string; uploadedToStorage: boolean }> {
  if (!dataUrl || !dataUrl.startsWith('data:')) {
    return { url: dataUrl, uploadedToStorage: dataUrl.startsWith('https://') };
  }
  if (!workspaceId || typeof navigator === 'undefined' || !navigator.onLine) {
    return { url: dataUrl, uploadedToStorage: false };
  }
  try {
    const storage = getStorage(firebaseApp);
    const safeName = `${Date.now()}_${fileName.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
    const storageRef = ref(storage, `workspaces/${workspaceId}/${folder}/${safeName}`);
    await uploadString(storageRef, dataUrl, 'data_url');
    const url = await getDownloadURL(storageRef);
    return { url, uploadedToStorage: true };
  } catch {
    return { url: dataUrl, uploadedToStorage: false };
  }
}

/**
 * Migrates legacy inline base64 data: URLs to Firebase Storage HTTPS URLs when online.
 */
export async function migrateLegacyAssetsToStorage(
  workspaceId: string,
  state: PersistedState,
): Promise<Partial<PersistedState> | null> {
  if (!workspaceId || typeof navigator === 'undefined' || !navigator.onLine) return null;
  let changed = false;

  const nextSettings = { ...state.settings };
  if (nextSettings.logoBase64?.startsWith('data:')) {
    const up = await uploadAssetWithOfflineFallback(workspaceId, 'logos', 'company_logo.png', nextSettings.logoBase64);
    if (up.uploadedToStorage) {
      nextSettings.logoBase64 = up.url;
      changed = true;
    }
  }

  const nextProducts = await Promise.all(
    state.products.map(async (p) => {
      if (!p.imageBase64?.startsWith('data:')) return p;
      const up = await uploadAssetWithOfflineFallback(workspaceId, 'products', `${p.id}.png`, p.imageBase64);
      if (!up.uploadedToStorage) return p;
      changed = true;
      return { ...p, imageBase64: up.url };
    }),
  );

  const nextDocuments = await Promise.all(
    state.documents.map(async (d) => {
      if (!d.fileDataBase64?.startsWith('data:')) return d;
      const up = await uploadAssetWithOfflineFallback(workspaceId, 'documents', d.fileName || `${d.id}.bin`, d.fileDataBase64);
      if (!up.uploadedToStorage) return d;
      changed = true;
      return { ...d, fileDataBase64: up.url };
    }),
  );

  if (!changed) return null;
  return { settings: nextSettings, products: nextProducts, documents: nextDocuments };
}

/**
 * Registers Web Push / FCM permission & stores device token under workspaces/{ws}/fcmTokens/{token}.
 */
export async function registerFcmForWorkspace(workspaceId?: string): Promise<{
  permission: NotificationPermission | 'unsupported';
  token?: string;
}> {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return { permission: 'unsupported' };
  }
  let permission: NotificationPermission = Notification.permission;
  if (permission === 'default') {
    try {
      permission = await Notification.requestPermission();
    } catch {
      return { permission: 'denied' };
    }
  }
  if (permission !== 'granted') return { permission };

  try {
    const supported = await isSupported();
    if (!supported) return { permission };
    const messaging = getMessaging(firebaseApp);
    const swReg = 'serviceWorker' in navigator
      ? await navigator.serviceWorker.register('/firebase-messaging-sw.js').catch(() => undefined)
      : undefined;
    const vapidKey = import.meta.env.VITE_FIREBASE_VAPID_KEY as string | undefined;
    const token = await getToken(messaging, {
      ...(vapidKey ? { vapidKey } : {}),
      ...(swReg ? { serviceWorkerRegistration: swReg } : {}),
    }).catch(() => '');

    if (token && workspaceId) {
      await setDoc(
        doc(db, `workspaces/${workspaceId}/fcmTokens/${token.slice(0, 120)}`),
        {
          token,
          updatedAt: serverTimestamp(),
        },
        { merge: true },
      ).catch(() => undefined);
    }

    onMessage(messaging, (payload) => {
      const title = payload.notification?.title || 'أسطورة المحاسبة';
      const body = payload.notification?.body || '';
      if (body) dispatchSmartNotification(title, body);
    });

    return { permission, token: token || undefined };
  } catch {
    return { permission };
  }
}

export async function requestAlertNotificationPermission(): Promise<NotificationPermission | 'unsupported'> {
  const res = await registerFcmForWorkspace();
  return res.permission;
}

export function dispatchSmartNotification(title: string, body: string): void {
  if (typeof window === 'undefined' || !('Notification' in window)) return;
  if (Notification.permission === 'granted') {
    try {
      new Notification(title, { body });
    } catch {
      // Ignore in sandboxed contexts
    }
  }
}
