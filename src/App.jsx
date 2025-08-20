import { useState, useEffect } from 'react'
import { ThemeProvider, createTheme } from '@mui/material'
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet'
import { Select, MenuItem, Button, Box, CssBaseline } from '@mui/material'
import 'leaflet/dist/leaflet.css'
import './App.css'

const darkTheme = createTheme({
  palette: {
    mode: 'dark',
  },
})

function App() {
  const [vpnList, setVpnList] = useState([])
  const [selectedCountry, setSelectedCountry] = useState('')
  const [selectedServer, setSelectedServer] = useState(null)
  const [countries, setCountries] = useState({})

  useEffect(() => {
    window.api.getVpnList().then(data => {
      setVpnList(data.servers)
      setCountries(data.countries)
    })
  }, [])

  const handleConnect = () => {
    if (selectedServer) {
      console.log('Download URL:', selectedServer.download_url)
    }
  }

  return (
    <ThemeProvider theme={darkTheme}>
      <CssBaseline />
      <Box sx={{ height: '100vh', p: 2 }}>
        <Box sx={{ mb: 2, display: 'flex', gap: 2 }}>
          <Select
            value={selectedCountry}
            onChange={(e) => setSelectedCountry(e.target.value)}
            sx={{ minWidth: 200 }}
          >
            <MenuItem value="">All Countries</MenuItem>
            {Object.entries(countries).map(([code, name]) => (
              <MenuItem key={code} value={code}>
                {name}
              </MenuItem>
            ))}
          </Select>
          
          <Select
            value={selectedServer ? JSON.stringify(selectedServer) : ''}
            onChange={(e) => setSelectedServer(JSON.parse(e.target.value))}
            sx={{ minWidth: 200 }}
          >
            <MenuItem value="">Select Server</MenuItem>
            {vpnList
              .filter(server => !selectedCountry || server.country_code?.toLowerCase() === selectedCountry)
              .map((server, index) => (
                <MenuItem key={index} value={JSON.stringify(server)}>
                  {server.ip} ({server.country})
                </MenuItem>
              ))}
          </Select>

          <Button 
            variant="contained" 
            onClick={handleConnect}
            disabled={!selectedServer}
          >
            Connect
          </Button>
        </Box>

        <Box sx={{ height: 'calc(100vh - 100px)', width: '100%' }}>
          <MapContainer 
            center={[20, 0]} 
            zoom={2} 
            style={{ height: '100%', width: '100%' }}
          >
            <TileLayer
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            />
            {vpnList
              .filter(server => !selectedCountry || server.country_code?.toLowerCase() === selectedCountry)
              .map((server, index) => (
                server.lat && server.lon ? (
                  <Marker 
                    key={index}
                    position={[parseFloat(server.lat), parseFloat(server.lon)]}
                  >
                    <Popup>
                      {server.ip}<br/>
                      {server.country}<br/>
                      Speed: {(parseInt(server.speed) / 1000000).toFixed(2)} Mbps
                    </Popup>
                  </Marker>
                ) : null
              ))}
          </MapContainer>
        </Box>
      </Box>
    </ThemeProvider>
  )
}

export default App
