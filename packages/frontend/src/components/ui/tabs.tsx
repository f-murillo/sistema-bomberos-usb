import * as React from "react"
import { cn } from "@/lib/utils"

const TabsContext = React.createContext<{
  value: string
  onValueChange: (value: string) => void
} | null>(null)

const Tabs = ({ children, defaultValue, onValueChange, className }: { 
    children: React.ReactNode, 
    defaultValue: string, 
    onValueChange?: (value: string) => void,
    className?: string 
}) => {
  const [value, setValue] = React.useState(defaultValue)

  const handleValueChange = (newValue: string) => {
    setValue(newValue)
    if (onValueChange) onValueChange(newValue)
  }

  return (
    <TabsContext.Provider value={{ value, onValueChange: handleValueChange }}>
      <div className={cn("space-y-2", className)}>
        {children}
      </div>
    </TabsContext.Provider>
  )
}

const TabsList = ({ children, className }: { 
    children: React.ReactNode, 
    className?: string
}) => {
  return (
    <div className={cn("inline-flex items-center justify-center rounded-lg bg-slate-100 p-1 text-slate-500", className)}>
      {children}
    </div>
  )
}

const TabsTrigger = ({ children, value, className }: { 
    children: React.ReactNode, 
    value: string, 
    className?: string 
}) => {
  const context = React.useContext(TabsContext)
  if (!context) throw new Error("TabsTrigger must be used within Tabs")
  
  const isActive = context.value === value
  
  return (
    <button
      type="button"
      onClick={() => context.onValueChange(value)}
      className={cn(
        "inline-flex items-center justify-center whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50",
        isActive 
          ? "bg-white text-slate-950 shadow-sm" 
          : "hover:bg-white/50 hover:text-slate-900",
        className
      )}
    >
      {children}
    </button>
  )
}

const TabsContent = ({ children, value, className }: { 
    children: React.ReactNode, 
    value: string, 
    className?: string 
}) => {
  const context = React.useContext(TabsContext)
  if (!context) throw new Error("TabsContent must be used within Tabs")

  if (context.value !== value) return null
  
  return (
    <div className={cn("mt-2 ring-offset-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-950 focus-visible:ring-offset-2", className)}>
      {children}
    </div>
  )
}

export { Tabs, TabsList, TabsTrigger, TabsContent }

