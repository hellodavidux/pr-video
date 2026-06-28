import { createContext, useContext } from 'react'
import { DEFAULT_THEME } from '../../lib/productTheme.js'

const ProductThemeContext = createContext(DEFAULT_THEME)

export function ProductThemeProvider({ theme, children }) {
  return (
    <ProductThemeContext.Provider value={{ ...DEFAULT_THEME, ...theme }}>
      {children}
    </ProductThemeContext.Provider>
  )
}

export function useProductTheme() {
  return useContext(ProductThemeContext)
}
