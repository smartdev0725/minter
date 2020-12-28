import React from 'react'
import App from './App'
import { createMuiTheme, CssBaseline, ThemeProvider } from '@material-ui/core'

const theme = createMuiTheme({
  palette: {
    primary: {
      main: '#5c2a72'
    }
  }
})

const AppTheme = () => {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <App />
    </ThemeProvider>
  )
}

export default AppTheme
