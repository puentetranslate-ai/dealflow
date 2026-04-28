import { createContext, useContext, useState } from 'react'

const QuickLogContext = createContext(null)

export function QuickLogProvider({ children }) {
  const [open, setOpen] = useState(false)
  const [prefilled, setPrefilled] = useState(null)
  return (
    <QuickLogContext.Provider value={{ open, setOpen, prefilled, setPrefilled }}>
      {children}
    </QuickLogContext.Provider>
  )
}

export function useQuickLog() {
  const ctx = useContext(QuickLogContext)
  if (!ctx) throw new Error('useQuickLog must be used inside QuickLogProvider')
  return ctx
}
