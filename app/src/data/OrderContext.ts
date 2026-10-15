import { createContext, useContext, useSyncExternalStore } from "react"
import { orderRepository } from "./orderRepository"

export type OrderContextValue = {
  repository: typeof orderRepository
  runAction: (action: () => void | Promise<void>) => Promise<boolean>
}

export const OrderContext = createContext<OrderContextValue | null>(null)

export function useOrderData() {
  const context = useContext(OrderContext)
  if (!context) throw new Error("useOrderData must be used inside OrderProvider")
  const snapshot = useSyncExternalStore(context.repository.subscribe, context.repository.getSnapshot)
  return { ...context, ...snapshot }
}
