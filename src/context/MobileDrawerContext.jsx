import { createContext, useContext, useState } from 'react'

const MobileDrawerContext = createContext(null)

export function MobileDrawerProvider({ children }) {
  const [open, setOpen] = useState(false)
  return (
    <MobileDrawerContext.Provider value={{ open, setOpen }}>
      {children}
    </MobileDrawerContext.Provider>
  )
}

export function useMobileDrawer() {
  const ctx = useContext(MobileDrawerContext)
  if (!ctx) throw new Error('useMobileDrawer must be used inside MobileDrawerProvider')
  return ctx
}
