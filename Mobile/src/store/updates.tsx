import { createContext, useContext, useState, type ReactNode } from 'react';

// How many of the resident's reports changed since they last opened them (unseen_updates from
// GET /api/reports/me). Set by "Laporan saya" whenever it loads; shown as a count on its tab.
const UpdatesContext = createContext<{ count: number; setCount: (count: number) => void }>({
  count: 0,
  setCount: () => {},
});

export function UpdatesProvider({ children }: { children: ReactNode }) {
  const [count, setCount] = useState(0);
  return <UpdatesContext.Provider value={{ count, setCount }}>{children}</UpdatesContext.Provider>;
}

export const useUpdates = () => useContext(UpdatesContext);
