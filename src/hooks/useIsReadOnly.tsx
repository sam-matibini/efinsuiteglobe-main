import { createContext, useContext, ReactNode } from 'react';
import { useEnabledModules } from '@/hooks/useEnabledModules';

interface ReadOnlyContextType {
  isReadOnly: boolean;
}

const ReadOnlyContext = createContext<ReadOnlyContextType>({ isReadOnly: false });

export function ReadOnlyProvider({ children }: { children: ReactNode }) {
  const { isReadOnly } = useEnabledModules();
  return (
    <ReadOnlyContext.Provider value={{ isReadOnly }}>
      {children}
    </ReadOnlyContext.Provider>
  );
}

export function useIsReadOnly() {
  return useContext(ReadOnlyContext).isReadOnly;
}
