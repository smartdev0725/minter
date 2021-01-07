import React from 'react'
import App from './App'
import {
  createMuiTheme,
  CssBaseline,
  makeStyles,
  ThemeProvider
} from '@material-ui/core'

const theme = createMuiTheme({
  palette: {
    primary: {
      main: '#5c2a72'
    }
  },
  typography: {
    caption: {
      color: '#666'
    }
  }
})

const useStyles = makeStyles({
  root: {
    background: 'linear-gradient(135deg, #56276b, #a578b9)',
    width: '100vw',
    minHeight: '100vh',
    margin: 0,
    padding: 0
  }
})

const AppTheme = () => {
  const classes = useStyles()

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <div className={classes.root}>
        <App />
      </div>
    </ThemeProvider>
  )
}

export default AppTheme
