import React, { createContext, useCallback, useContext, useMemo, useState } from "react";

/**
 * ModalStack — a simple stack-based context for managing multiple modals.
 *
 * Each modal registers itself with a unique key. The topmost modal is the one
 * that handles ESC. New modals pushed onto the stack receive higher z-index.
 *
 * Usage:
 *   const { push, pop, isTop } = useModalStack();
 *   const handleOpen = () => push("my-modal");
 *   const handleClose = () => pop("my-modal");
 *   const top = isTop("my-modal");
 */

export type ModalKey = string;

interface ModalState {
  stack: ModalKey[];
  push: (key: ModalKey) => void;
  pop: (key: ModalKey) => void;
  isTop: (key: ModalKey) => boolean;
  indexOf: (key: ModalKey) => number;
  /** Total number of open modals. */
  size: number;
}

const ModalStackContext = createContext<ModalState | null>(null);

export const ModalStackProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [stack, setStack] = useState<ModalKey[]>([]);

  const push = useCallback((key: ModalKey) => {
    setStack((s) => (s.includes(key) ? s : [...s, key]));
  }, []);

  const pop = useCallback((key: ModalKey) => {
    setStack((s) => s.filter((k) => k !== key));
  }, []);

  const isTop = useCallback(
    (key: ModalKey) => stack.length > 0 && stack[stack.length - 1] === key,
    [stack],
  );

  const indexOf = useCallback((key: ModalKey) => stack.indexOf(key), [stack]);

  const value = useMemo<ModalState>(
    () => ({ stack, push, pop, isTop, indexOf, size: stack.length }),
    [stack, push, pop, isTop, indexOf],
  );

  return <ModalStackContext.Provider value={value}>{children}</ModalStackContext.Provider>;
};

export const useModalStack = (): ModalState => {
  const ctx = useContext(ModalStackContext);
  if (!ctx) {
    // Not a hard error — return a no-op stack so components can be used outside provider
    return {
      stack: [],
      push: () => {},
      pop: () => {},
      isTop: () => true,
      indexOf: () => -1,
      size: 0,
    };
  }
  return ctx;
};

/**
 * Computes z-index for a modal based on its position in the stack.
 * Base z is 50, each subsequent modal adds 10.
 */
export const getModalZIndex = (stackIndex: number, baseZ = 50): number => {
  if (stackIndex < 0) return baseZ;
  return baseZ + stackIndex * 10;
};
