import { getDownloadURL, getStorage, ref, uploadString } from 'firebase/storage';
import { firebaseApp } from '../firebase';

/**
 * Uploads an image or PDF asset (data URL) to Firebase Storage when available,
 * and seamlessly falls back to the compressed local/Firestore DataURL when offline
 * or if the Storage bucket isn't provisioned on the active Firebase project.
 */
export async function uploadAssetWithOfflineFallback(
  uid: string | undefined,
  folder: 'logos' | 'products' | 'customers' | 'suppliers' | 'documents',
  fileName: string,
  dataUrl: string,
): Promise<{ url: string; uploadedToStorage: boolean }> {
  if (!uid || typeof navigator === 'undefined' || !navigator.onLine) {
    return { url: dataUrl, uploadedToStorage: false };
  }
  try {
    const storage = getStorage(firebaseApp);
    const safeName = `${Date.now()}_${fileName.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
    const storageRef = ref(storage, `workspaces/${uid}/${folder}/${safeName}`);
    await uploadString(storageRef, dataUrl, 'data_url');
    const url = await getDownloadURL(storageRef);
    return { url, uploadedToStorage: true };
  } catch {
    return { url: dataUrl, uploadedToStorage: false };
  }
}

/**
 * Registers browser notification permission (Web Notification / FCM-ready hook)
 * for overdue invoices, low-stock alerts, and expiry warnings.
 */
export async function requestAlertNotificationPermission(): Promise<NotificationPermission | 'unsupported'> {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return 'unsupported';
  }
  if (Notification.permission === 'granted') return 'granted';
  try {
    return await Notification.requestPermission();
  } catch {
    return 'denied';
  }
}

export function dispatchSmartNotification(title: string, body: string): void {
  if (typeof window === 'undefined' || !('Notification' in window)) return;
  if (Notification.permission === 'granted') {
    try {
      new Notification(title, { body });
    } catch {
      // Ignore if running in sandboxed iframe without notification permission
    }
  }
}
