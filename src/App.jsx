import { useState, useEffect } from "react";
import { ThemeProvider, createTheme } from "@mui/material";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import { Select, MenuItem, Button, Box, CssBaseline } from "@mui/material";
import L from 'leaflet';
import "leaflet/dist/leaflet.css";
import "./App.css";

const darkTheme = createTheme({
  palette: {
    mode: "dark",
  },
});

const defaultIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-blue.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
});

const selectedIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
});

function MapCenter({ server }) {
  const map = useMap();
  
  useEffect(() => {
    if (server?.lat && server?.lon) {
      map.setView(
        [parseFloat(server.lat), parseFloat(server.lon)],
        12, // zoom level
        {
          animate: true,
          duration: 1 // animation duration in seconds
        }
      );
    }
  }, [map, server]);

  return null;
}

function App() {  
  const [configs, setConfigs] = useState([]);
  const [selectedCountry, setSelectedCountry] = useState("");
  const [selectedCity, setSelectedCity] = useState("");
  const [selectedServer, setSelectedServer] = useState(null);
  const [countries, setCountries] = useState({});

  const handleServerSelect = (server) => {
    setSelectedServer(server);
    if (server) {
      const countryKey = server.country.toLowerCase().replace(/ /g, '_');
      setSelectedCountry(countryKey);
      setSelectedCity(server.city || "Unknown City");
    }
  };

  const handleCityChange = (city) => {
    setSelectedCity(city);
    // Select first server of the selected city
    const firstServerInCity = configs.find(
      server => server.country.toLowerCase().replace(/ /g, '_') === selectedCountry 
      && (server.city || "Unknown City") === city
    );
    handleServerSelect(firstServerInCity || null);
  };

  // Get unique cities for selected country
  const getCitiesForCountry = () => {
    return [...new Set(
      configs
        .filter(server => !selectedCountry || server.country.toLowerCase().replace(/ /g, '_') === selectedCountry)
        .map(server => server.city || "Unknown City")
    )].sort();
  };

  // Get servers for selected city
  const getServersForCity = () => {
    return configs
      .filter(server => 
        (!selectedCountry || server.country.toLowerCase().replace(/ /g, '_') === selectedCountry) &&
        (!selectedCity || (server.city || "Unknown City") === selectedCity)
      )
      .sort((a, b) => a.ip.localeCompare(b.ip));
  };

  useEffect(() => {
    console.log("Fetching VPN configurations...");
    window.api.getConfigs().then((data) => {
      setConfigs(data);
      
      const countryMap = data.reduce((acc, server) => {
        const countryKey = server.country.toLowerCase().replace(/ /g, '_');
        acc[countryKey] = server.country;
        return acc;
      }, {});
      
      setCountries(countryMap);
      
      if (data.length > 0) {
        handleServerSelect(data[0]);
      }
    });
  }, []);

  const handleConnect = () => {
    if (selectedServer) {
      console.log("Download URL:", selectedServer.download_url);
    }
  };

  const handleCountryChange = (event) => {
    const newCountry = event.target.value;
    setSelectedCountry(newCountry);
    
    // Select first server of the selected country
    if (newCountry) {
      const firstServer = configs.find(
        server => server.country.toLowerCase().replace(/ /g, '_') === newCountry
      );
      handleServerSelect(firstServer || null);
    } else {
      handleServerSelect(null);
    }
  };

  return (
    <ThemeProvider theme={darkTheme}>
      <CssBaseline />
      <Box sx={{ height: "100vh", p: 2 }}>
        <Box sx={{ mb: 2, display: "flex", gap: 2 }}>
          <Select
            value={selectedCountry}
            onChange={handleCountryChange}
            sx={{ minWidth: 200 }}
          >
            <MenuItem value="">All Countries</MenuItem>
            {Object.entries(countries)
              .sort(([_, a], [__, b]) => a.localeCompare(b))
              .map(([code, name]) => (
                <MenuItem key={code} value={code}>
                  {name}
                </MenuItem>
            ))}
          </Select>

          <Select
            value={selectedCity}
            onChange={(e) => handleCityChange(e.target.value)}
            sx={{ minWidth: 200 }}
          >
            <MenuItem value="">Select City</MenuItem>
            {getCitiesForCountry().map((city) => (
              <MenuItem key={city} value={city}>
                {city}
              </MenuItem>
            ))}
          </Select>

          <Select
            value={selectedServer ? JSON.stringify(selectedServer) : ""}
            onChange={(e) => handleServerSelect(e.target.value ? JSON.parse(e.target.value) : null)}
            sx={{ minWidth: 200 }}
          >
            <MenuItem value="">Select Server</MenuItem>
            {getServersForCity().map((server, index) => (
              <MenuItem key={index} value={JSON.stringify(server)}>
                {server.ip}
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

        <Box sx={{ height: "calc(100vh - 100px)", width: "100%" }}>
          <MapContainer
            center={[20, 0]}
            zoom={2}
            style={{ height: "100%", width: "100%" }}
          >
            <TileLayer
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            />
            <MapCenter server={selectedServer} />
            {configs.map((server, index) =>
              server.lat && server.lon ? (
                <Marker
                  key={index}
                  position={[parseFloat(server.lat), parseFloat(server.lon)]}
                  icon={selectedServer && selectedServer.download_url === server.download_url ? selectedIcon : defaultIcon}
                  eventHandlers={{
                    click: () => handleServerSelect(server)
                  }}
                >
                  <Popup>
                    {server.ip}
                    <br />
                    {server.country}
                    {server.city && <><br />{server.city}</>}
                    {server.isp && <><br />ISP: {server.isp}</>}
                  </Popup>
                </Marker>
              ) : null
            )}
          </MapContainer>
        </Box>
      </Box>
    </ThemeProvider>
  );
}

export default App;
