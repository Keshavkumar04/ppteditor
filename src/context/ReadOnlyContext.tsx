import { createContext, useContext, ReactNode } from 'react'

const ReadOnlyContext = createContext<boolean>(false)

export interface ReadOnlyProviderProps {
  readOnly?: boolean
  children: ReactNode
}

export function ReadOnlyProvider({ readOnly, children }: ReadOnlyProviderProps) {
  return (
    <ReadOnlyContext.Provider value={!!readOnly}>
      {children}
    </ReadOnlyContext.Provider>
  )
}

export function useReadOnly() {
  return useContext(ReadOnlyContext)
}
