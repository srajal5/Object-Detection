"use client"

import * as React from "react"
import { Moon, Sun } from "lucide-react"
import { useTheme } from "next-themes"

export function ThemeToggle() {
  const { theme, setTheme } = useTheme()
  const [mounted, setMounted] = React.useState(false)

  React.useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted) {
    return null
  }

  return (
    <button
      onClick={() => setTheme(theme === "light" ? "dark" : "light")}
      className="relative h-8 w-14 rounded-full bg-gray-200 dark:bg-slate-700 transition-colors duration-300 ease-in-out"
      aria-label="Toggle theme"
    >
      <div
        className={`absolute top-1 left-1 h-6 w-6 rounded-full bg-white dark:bg-slate-900 transition-transform duration-300 ease-in-out flex items-center justify-center ${
          theme === "dark" ? "translate-x-6" : "translate-x-0"
        }`}
      >
        {theme === "light" ? (
          <Sun className="h-4 w-4 text-yellow-500" />
        ) : (
          <Moon className="h-4 w-4 text-blue-400" />
        )}
      </div>
      <div className="absolute inset-0 flex items-center justify-between px-2">
        <Sun className="h-4 w-4 text-yellow-500" />
        <Moon className="h-4 w-4 text-blue-400" />
      </div>
    </button>
  )
} 