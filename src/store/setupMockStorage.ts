// localStorage のモックを定義（テスト環境での警告抑制と高速化のため）
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => {
      store[key] = String(value);
    },
    removeItem: (key: string) => {
      delete store[key];
    },
    clear: () => {
      store = {};
    },
    length: 0,
    key: (_index: number) => null,
  };
})();

declare global {
  var IS_TEST_ENVIRONMENT: boolean | undefined;
}

Object.defineProperty(globalThis, "localStorage", {
  value: localStorageMock,
  writable: true,
});

globalThis.IS_TEST_ENVIRONMENT = true;

export {};
