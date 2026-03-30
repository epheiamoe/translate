import '@testing-library/jest-dom';

const indexedDB = {
  open: () => ({
    onerror: null,
    onsuccess: null,
    onupgradeneeded: null,
    result: {
      objectStoreNames: {
        contains: () => false,
      },
      createObjectStore: () => ({
        createIndex: () => {},
      }),
      transaction: () => ({
        objectStore: () => ({
          getAll: () => ({ onsuccess: null, onerror: null, result: [] }),
          get: () => ({ onsuccess: null, onerror: null, result: undefined }),
          add: () => ({ onsuccess: null, onerror: null, result: 1 }),
          put: () => ({ onsuccess: null, onerror: null }),
          delete: () => ({ onsuccess: null, onerror: null }),
          clear: () => ({ onsuccess: null, onerror: null }),
        }),
      }),
    },
  }),
};

Object.defineProperty(window, 'indexedDB', { value: indexedDB });