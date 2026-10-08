import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react'

interface ToastAction {
  label: string
  run: () => void
}

interface ToastState {
  id: number
  message: string
  action?: ToastAction
}

type ShowToast = (message: string, action?: ToastAction) => void

const ToastContext = createContext<ShowToast>(() => {})

// eslint-disable-next-line react-refresh/only-export-components
export function useToast(): ShowToast {
  return useContext(ToastContext)
}

/** 畫面下方的提示；有「復原」等動作時顯示 6 秒，否則 2.6 秒 */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<ToastState | null>(null)
  const timer = useRef<number | undefined>(undefined)

  const show = useCallback<ShowToast>((message, action) => {
    window.clearTimeout(timer.current)
    const id = Date.now()
    setToast({ id, message, action })
    timer.current = window.setTimeout(() => setToast((t) => (t?.id === id ? null : t)), action ? 6000 : 2600)
  }, [])

  return (
    <ToastContext.Provider value={show}>
      {children}
      {toast && (
        <div className="toast" role="status" key={toast.id}>
          <span>{toast.message}</span>
          {toast.action && (
            <button
              onClick={() => {
                toast.action!.run()
                setToast(null)
              }}
            >
              {toast.action.label}
            </button>
          )}
        </div>
      )}
    </ToastContext.Provider>
  )
}
