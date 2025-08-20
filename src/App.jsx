import { useState, useEffect } from "react";
import { ThemeProvider, createTheme } from "@mui/material";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import {
  Select,
  MenuItem,
  Button,
  Box,
  CssBaseline,
  Paper,
  Typography,
} from "@mui/material";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import "./App.css";
import * as CountryFlags from "country-flag-icons/react/3x2";

const darkTheme = createTheme({
  palette: {
    mode: "dark",
  },
});

const defaultIcon = new L.Icon({
  iconUrl:
    "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-blue.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
});

const selectedIcon = new L.Icon({
  iconUrl:
    "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png",
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
          duration: 1, // animation duration in seconds
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
  const [connectedServer, setConnectedServer] = useState(null);

  const handleServerSelect = (server) => {
    setSelectedServer(server);
    if (server) {
      const countryKey = server.country.toLowerCase().replace(/ /g, "_");
      setSelectedCountry(countryKey);
      setSelectedCity(server.city || "Unknown City");
    }
  };

  const handleConnect = async () => {
    if (selectedServer) {
      try {
        if (!connectedServer) {
          console.log("Connecting to:", selectedServer.ip);
          const result = await window.api.connectVPN(selectedServer.download_url);
          if (result.success) {
            setConnectedServer(selectedServer);
          } else {
            console.error("Connection failed:", result.error);
          }
        } else {
          console.log("Disconnecting from:", connectedServer.ip);
          const result = await window.api.disconnectVPN();
          if (result.success) {
            setConnectedServer(null);
          } else {
            console.error("Disconnection failed:", result.error);
          }
        }
      } catch (error) {
        console.error("VPN operation failed:", error);
      }
    }
  };

  const handleCityChange = (city) => {
    setSelectedCity(city);
    // Select first server of the selected city
    const firstServerInCity = configs.find(
      (server) =>
        server.country.toLowerCase().replace(/ /g, "_") === selectedCountry &&
        (server.city || "Unknown City") === city
    );
    handleServerSelect(firstServerInCity || null);
  };

  // Get unique cities for selected country
  const getCitiesForCountry = () => {
    return [
      ...new Set(
        configs
          .filter(
            (server) =>
              !selectedCountry ||
              server.country.toLowerCase().replace(/ /g, "_") ===
                selectedCountry
          )
          .map((server) => server.city || "Unknown City")
      ),
    ].sort();
  };

  // Get servers for selected city
  const getServersForCity = () => {
    return configs
      .filter(
        (server) =>
          (!selectedCountry ||
            server.country.toLowerCase().replace(/ /g, "_") ===
              selectedCountry) &&
          (!selectedCity || (server.city || "Unknown City") === selectedCity)
      )
      .sort((a, b) => a.ip.localeCompare(b.ip));
  };

  useEffect(() => {
    console.log("Fetching VPN configurations...");
    window.api.getConfigs().then((data) => {
      setConfigs(data);

      const countryMap = data.reduce((acc, server) => {
        const countryKey = server.country.toLowerCase().replace(/ /g, "_");
        acc[countryKey] = server.country;
        return acc;
      }, {});

      setCountries(countryMap);

      if (data.length > 0) {
        handleServerSelect(data[0]);
      }
    });
  }, []);

  const handleCountryChange = (event) => {
    const newCountry = event.target.value;
    setSelectedCountry(newCountry);

    // Select first server of the selected country
    if (newCountry) {
      const firstServer = configs.find(
        (server) =>
          server.country.toLowerCase().replace(/ /g, "_") === newCountry
      );
      handleServerSelect(firstServer || null);
    } else {
      handleServerSelect(null);
    }
  };

  const getCountryCode = (countryName) => {
    // Table de conversion pour les cas spéciaux
    const specialCases = {
      united_states: "US",
      united_kingdom: "GB",
      south_korea: "KR",
      russian_federation: "RU",
      viet_nam: "VN",
      korea_republic: "KR",
      korea: "KR",
      taiwan: "TW",
      china: "CN",
      japan: "JP",
      sweden: "SE", // Ajout du code pour la Suède
      // Ajoutez d'autres cas spéciaux ici
    };

    const code =
      specialCases[countryName.toLowerCase()] ||
      countryName.substring(0, 2).toUpperCase();
    return code;
  };

  return (
    <ThemeProvider theme={darkTheme}>
      <CssBaseline />
      <Box sx={{ height: "100vh", position: "relative" }}>
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
                icon={
                  selectedServer &&
                  selectedServer.download_url === server.download_url
                    ? selectedIcon
                    : defaultIcon
                }
                zIndexOffset={
                  selectedServer &&
                  selectedServer.download_url === server.download_url
                    ? 1000
                    : 0
                }
                eventHandlers={{
                  click: () => handleServerSelect(server),
                }}
              >
                <Popup>
                  <div className="popup-content">
                    <Typography variant="subtitle1" fontWeight="bold">
                      {server.country}
                    </Typography>
                    {server.city && (
                      <Typography variant="body2">
                        City: {server.city}
                      </Typography>
                    )}
                    <Typography variant="body2">IP: {server.ip}</Typography>
                    {server.isp && (
                      <Typography variant="body2">ISP: {server.isp}</Typography>
                    )}
                  </div>
                </Popup>
              </Marker>
            ) : null
          )}
        </MapContainer>

        <Paper className="controls-panel" elevation={3}>
          <Box className="select-container">
            <Typography variant="subtitle2" gutterBottom>
              Country
            </Typography>
            <Select
              value={selectedCountry}
              onChange={handleCountryChange}
              fullWidth
              size="small"
            >
              {Object.entries(countries)
                .sort(([_, a], [__, b]) => a.localeCompare(b))
                .map(([code, name]) => {
                  const countryCode = getCountryCode(code);
                  const FlagComponent = CountryFlags[countryCode];

                  return (
                    <MenuItem key={code} value={code}>
                      {FlagComponent ? (
                        <Box
                          component="span"
                          sx={{ display: "inline-block", width: 24, mr: 1 }}
                        >
                          <FlagComponent />
                        </Box>
                      ) : null}
                      {name}
                    </MenuItem>
                  );
                })}
            </Select>
          </Box>

          <Box className="select-container">
            <Typography variant="subtitle2" gutterBottom>
              City
            </Typography>
            <Select
              value={selectedCity}
              onChange={(e) => handleCityChange(e.target.value)}
              fullWidth
              size="small"
            >
              {getCitiesForCountry().map((city) => (
                <MenuItem key={city} value={city}>
                  {city}
                </MenuItem>
              ))}
            </Select>
          </Box>

          <Box className="select-container">
            <Typography variant="subtitle2" gutterBottom>
              Server
            </Typography>
            <Select
              value={selectedServer ? JSON.stringify(selectedServer) : ""}
              onChange={(e) =>
                handleServerSelect(
                  e.target.value ? JSON.parse(e.target.value) : null
                )
              }
              fullWidth
              size="small"
            >
              {getServersForCity().map((server, index) => (
                <MenuItem key={index} value={JSON.stringify(server)}>
                  {server.ip}
                </MenuItem>
              ))}
            </Select>
          </Box>

          {selectedServer && (
            <Box className="server-info">
              <Typography variant="body2" gutterBottom>
                Selected Server Info:
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {selectedServer.isp && (
                  <>
                    ISP: {selectedServer.isp}<br />
                    Lon: {selectedServer.lon}<br />
                    Lat: {selectedServer.lat}<br />
                    Timezone : {selectedServer.timezone || "Unknown"}<br />
                    Provider: {selectedServer.provider || "Unknown"}<br />
                  </>
                )}
              </Typography>
            </Box>
          )}

          <Button
            variant="contained"
            onClick={handleConnect}
            disabled={!selectedServer}
            className="connect-button"
            sx={{
              backgroundColor: connectedServer ? '#d32f2f' : undefined,
              '&:hover': {
                backgroundColor: connectedServer ? '#aa2424' : undefined
              }
            }}
          >
            {connectedServer ? 'DISCONNECT' : 'CONNECT'}
          </Button>
        </Paper>
      </Box>
    </ThemeProvider>
  );
}

export default App;
