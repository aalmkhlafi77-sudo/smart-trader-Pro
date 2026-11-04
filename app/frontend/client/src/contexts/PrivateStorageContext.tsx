import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  getPrivateStorageState,
  initializePrivateStorageClient,
  loginPrivateStorage,
  logoutPrivateStorage,
  reloadPrivateStorageFromServer,
  subscribePrivateStorage,
  updatePrivateAccount,
  type PrivateStorageState,
} from "@/lib/db/privateStorageClient";

type PrivateStorageContextValue = PrivateStorageState & {
  login: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  reloadFromServer: () => Promise<void>;
  updateAccount: (input: { currentPassword: string; username?: string; password?: string }) => Promise<void>;
};

const PrivateStorageContext = createContext<PrivateStorageContextValue | null>(null);

export function PrivateStorageProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<PrivateStorageState>(() => getPrivateStorageState());

  useEffect(() => {
    const unsubscribe = subscribePrivateStorage(setState);
    void initializePrivateStorageClient();
    return unsubscribe;
  }, []);

  const value = useMemo<PrivateStorageContextValue>(
    () => ({
      ...state,
      login: loginPrivateStorage,
      logout: logoutPrivateStorage,
      reloadFromServer: reloadPrivateStorageFromServer,
      updateAccount: updatePrivateAccount,
    }),
    [state]
  );

  return (
    <PrivateStorageContext.Provider value={value}>
      {children}
    </PrivateStorageContext.Provider>
  );
}

export function usePrivateStorage() {
  const context = useContext(PrivateStorageContext);
  if (!context) {
    throw new Error("usePrivateStorage must be used inside PrivateStorageProvider");
  }
  return context;
}
