// Safe storage adapter for Zalo Mini App and Web environments
const memoryStore = new Map<string, string>();

interface NativeStorageLike {
  getItem: (key: string) => any;
  setItem: (key: string, value: any) => void;
  removeItem: (key: string) => void;
}

function getNativeStorage(): NativeStorageLike | null {
  try {
    if (typeof window !== "undefined") {
      const win = window as any;
      if (win.ZaloMiniAppSDK?.nativeStorage) {
        return win.ZaloMiniAppSDK.nativeStorage;
      }
      if (win.nativeStorage) {
        return win.nativeStorage;
      }
    }
  } catch {
    // Ignore runtime access errors
  }
  return null;
}

export const safeStorage = {
  /**
   * Reports whether storage operations will persist across browser/app reloads.
   * Returns true when either ZMP nativeStorage or window.localStorage is functional.
   * Returns false when falling back to ephemeral in-memory storage.
   */
  isPersistent(): boolean {
    if (getNativeStorage()) return true;
    try {
      if (typeof window !== "undefined" && window.localStorage) {
        const testKey = "__test_persist__";
        window.localStorage.setItem(testKey, "1");
        window.localStorage.removeItem(testKey);
        return true;
      }
    } catch {
      // In-memory fallback
    }
    return false;
  },

  getItem(key: string): string | null {
    const native = getNativeStorage();
    if (native) {
      try {
        const val = native.getItem(key);
        if (val !== undefined && val !== null) {
          return typeof val === "string" ? val : JSON.stringify(val);
        }
      } catch {
        // Proceed to fallback
      }
    }

    try {
      if (typeof window !== "undefined" && window.localStorage) {
        return window.localStorage.getItem(key);
      }
    } catch {
      // Proceed to memory fallback
    }

    return memoryStore.get(key) ?? null;
  },

  setItem(key: string, value: string): void {
    const native = getNativeStorage();
    if (native) {
      try {
        native.setItem(key, value);
        return;
      } catch {
        // Proceed to fallback
      }
    }

    try {
      if (typeof window !== "undefined" && window.localStorage) {
        window.localStorage.setItem(key, value);
        return;
      }
    } catch {
      // Proceed to memory fallback
    }

    memoryStore.set(key, value);
  },

  removeItem(key: string): void {
    const native = getNativeStorage();
    if (native) {
      try {
        native.removeItem(key);
      } catch {
        // Proceed to fallback
      }
    }

    try {
      if (typeof window !== "undefined" && window.localStorage) {
        window.localStorage.removeItem(key);
      }
    } catch {
      // Proceed to memory fallback
    }

    memoryStore.delete(key);
  },

  clearMemory(): void {
    memoryStore.clear();
  },
};
