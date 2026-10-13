import { useRef, useState, useCallback } from 'react';

export function useUndoStack(initial: string) {
  const stackRef = useRef<string[]>([initial]);
  const indexRef = useRef(0);
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);

  const sync = () => {
    setCanUndo(indexRef.current > 0);
    setCanRedo(indexRef.current < stackRef.current.length - 1);
  };

  const push = useCallback((content: string) => {
    if (content === stackRef.current[indexRef.current]) return;
    stackRef.current = stackRef.current.slice(0, indexRef.current + 1);
    stackRef.current.push(content);
    if (stackRef.current.length > 50) stackRef.current.shift();
    indexRef.current = stackRef.current.length - 1;
    sync();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const undo = useCallback((): string | null => {
    if (indexRef.current <= 0) return null;
    indexRef.current--;
    sync();
    return stackRef.current[indexRef.current];
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const redo = useCallback((): string | null => {
    if (indexRef.current >= stackRef.current.length - 1) return null;
    indexRef.current++;
    sync();
    return stackRef.current[indexRef.current];
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const reset = useCallback((content: string) => {
    stackRef.current = [content];
    indexRef.current = 0;
    setCanUndo(false);
    setCanRedo(false);
  }, []);

  return { push, undo, redo, canUndo, canRedo, reset };
}
