type AndroidShareBridge = {
  share(title: string, text: string, url: string): void;
  sharePDF(base64Pdf: string, fileName: string): void;
  showInterstitial(requestId: string): void;
  cancelInterstitial(requestId: string): void;
};

const adRequests = new Map<string, (shown: boolean) => void>();
const adTimeouts = new Map<string, number>();

import { appendPlayStoreLink } from "./share-format";

declare global {
  interface Window {
    AndroidShare?: AndroidShareBridge;
    rmccHandleBack?: () => boolean;
    onNativeAdShown?: (requestId: string) => void;
    onNativeAdResult?: (requestId: string, shown: boolean) => void;
  }
}

if (typeof window !== "undefined") {
  window.onNativeAdShown = (requestId) => {
    const timeout = adTimeouts.get(requestId);
    if (timeout !== undefined) window.clearTimeout(timeout);
    adTimeouts.delete(requestId);
  };
  window.onNativeAdResult = (requestId, shown) => {
    const resolve = adRequests.get(requestId);
    if (resolve) {
      adRequests.delete(requestId);
      const timeout = adTimeouts.get(requestId);
      if (timeout !== undefined) window.clearTimeout(timeout);
      adTimeouts.delete(requestId);
      resolve(shown);
    }
  };
}

export function requestAdBeforeShare(): Promise<boolean> {
  if (!window.AndroidShare) return Promise.resolve(false);
  const requestId = crypto.randomUUID();
  return new Promise((resolve) => {
    const timeout = window.setTimeout(() => {
      adRequests.delete(requestId);
      adTimeouts.delete(requestId);
      window.AndroidShare?.cancelInterstitial(requestId);
      resolve(false);
    }, 12_000);
    adTimeouts.set(requestId, timeout);
    adRequests.set(requestId, (shown) => {
      window.clearTimeout(timeout);
      adTimeouts.delete(requestId);
      resolve(shown);
    });
    try {
      window.AndroidShare?.showInterstitial(requestId);
    } catch {
      window.clearTimeout(timeout);
      adTimeouts.delete(requestId);
      adRequests.delete(requestId);
      resolve(false);
    }
  });
}

export async function shareText(title: string, text: string): Promise<void> {
  const shareBody = appendPlayStoreLink(text);
  if (window.AndroidShare) {
    window.AndroidShare.share(title, shareBody, "");
    return;
  }
  if (navigator.share) {
    await navigator.share({ title, text: shareBody });
    return;
  }
  await navigator.clipboard.writeText(`${title}\n\n${shareBody}`);
}

export async function sharePdf(blob: Blob, fileName: string): Promise<void> {
  if (window.AndroidShare) {
    const base64 = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = () => reject(new Error("Could not prepare PDF for sharing."));
      reader.onload = () => resolve(String(reader.result));
      reader.readAsDataURL(blob);
    });
    window.AndroidShare.sharePDF(base64, fileName);
    return;
  }
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
}
