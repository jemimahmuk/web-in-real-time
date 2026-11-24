// The Web in Real Time
// Fetches live current weather from Open-Meteo and maps it onto the page.

const CITIES = {
  toronto:   { name: 'Toronto',   lat: 43.65, lon: -79.38 },
  london:    { name: 'London',    lat: 51.51, lon: -0.13 },
  tokyo:     { name: 'Tokyo',     lat: 35.68, lon: 139.69 },
  reykjavik: { name: 'Reykjavík', lat: 64.15, lon: -21.94 },
};

const REFRESH_MS = 5 * 60 * 1000;

const state = {
  city: 'toronto',
  unit: 'C',          // 'C' or 'F'
  current: null,      // latest API "current" object
  timer: null,
};

const el = {
  cityName: document.getElementById('city-name'),
  temperature: document.getElementById('temperature'),
  condition: document.getElementById('condition'),
  feelsLike: document.getElementById('feels-like'),
  wind: document.getElementById('wind'),
  daylight: document.getElementById('daylight'),
  status: document.getElementById('status'),
  unitToggle: document.getElementById('unit-toggle'),
  refresh: document.getElementById('refresh'),
  cityButtons: document.querySelectorAll('[data-city]'),
};

// WMO weather codes used by Open-Meteo
const WEATHER = {
  0: 'Clear sky', 1: 'Mainly clear', 2: 'Partly cloudy', 3: 'Overcast',
  45: 'Fog', 48: 'Freezing fog',
  51: 'Light drizzle', 53: 'Drizzle', 55: 'Heavy drizzle',
  61: 'Light rain', 63: 'Rain', 65: 'Heavy rain',
  71: 'Light snow', 73: 'Snow', 75: 'Heavy snow', 77: 'Snow grains',
  80: 'Rain showers', 81: 'Rain showers', 82: 'Violent showers',
  85: 'Snow showers', 86: 'Heavy snow showers',
  95: 'Thunderstorm', 96: 'Thunderstorm with hail', 99: 'Thunderstorm with hail',
};

// ---------- Fetching ----------

async function fetchCurrentWeather(cityKey) {
  const city = CITIES[cityKey];
  const url = new URL('https://api.open-meteo.com/v1/forecast');
  url.search = new URLSearchParams({
    latitude: city.lat,
    longitude: city.lon,
    current: 'temperature_2m,apparent_temperature,weather_code,wind_speed_10m,is_day',
    timezone: 'auto',
  }).toString();

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Weather service responded with ${response.status}`);
  }
  const json = await response.json();
  if (!json.current) {
    throw new Error('Weather data was missing from the response');
  }
  return json.current;
}

async function load(cityKey) {
  setStatus('Updating…');
  el.refresh.disabled = true;
  try {
    const current = await fetchCurrentWeather(cityKey);
    state.current = current;
    state.city = cityKey;
    render();
    setStatus(`Updated ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`);
  } catch (error) {
    // Keep the last good reading on screen and explain what failed.
    setStatus(`Could not load weather (${error.message}). Try Refresh.`, true);
  } finally {
    el.refresh.disabled = false;
  }
}

// ---------- Mapping data to the interface ----------

// Temperature (°C) -> hue: cold blues (210) to hot reds (10).
function temperatureToHue(celsius) {
  const cold = -10, hot = 35;
  const t = Math.min(1, Math.max(0, (celsius - cold) / (hot - cold)));
  return Math.round(210 - t * 200);
}

// Wind speed (km/h) -> seconds for one drift across the screen.
// Calm air drifts slowly; strong wind moves quickly. Bounded to 2–12 s.
function windToDuration(kmh) {
  return Math.min(12, Math.max(2, 12 - kmh / 3));
}

function formatTemperature(celsius) {
  const value = state.unit === 'C' ? celsius : (celsius * 9) / 5 + 32;
  return `${Math.round(value)}°${state.unit}`;
}

function render() {
  const c = state.current;
  const celsius = c.temperature_2m;

  // 1. Colour: background hue follows temperature.
  document.documentElement.style.setProperty('--hue', temperatureToHue(celsius));

  // 2. Motion: wind lines move at a speed set by wind speed.
  document.documentElement.style.setProperty('--wind-duration', `${windToDuration(c.wind_speed_10m)}s`);

  // 3. Mood: night-time readings dim the page.
  document.body.classList.toggle('night', c.is_day === 0);

  // 4. Text: every number and label comes from the response.
  el.cityName.textContent = CITIES[state.city].name;
  el.temperature.textContent = formatTemperature(celsius);
  el.condition.textContent = WEATHER[c.weather_code] ?? 'Conditions unavailable';
  el.feelsLike.textContent = formatTemperature(c.apparent_temperature);
  el.wind.textContent = `${Math.round(c.wind_speed_10m)} km/h`;
  el.daylight.textContent = c.is_day === 1 ? 'Day' : 'Night';
  el.unitToggle.textContent = state.unit === 'C' ? '°F' : '°C';
}

function setStatus(message, isError = false) {
  el.status.textContent = message;
  el.status.classList.toggle('error', isError);
}

// ---------- Interactions ----------

// Interaction 1: choose a city.
el.cityButtons.forEach((button) => {
  button.addEventListener('click', () => {
    const cityKey = button.dataset.city;
    el.cityButtons.forEach((b) => b.setAttribute('aria-pressed', String(b === button)));
    load(cityKey);
    restartTimer();
  });
});

// Interaction 2: switch units without refetching (values re-render from stored data).
el.unitToggle.addEventListener('click', () => {
  state.unit = state.unit === 'C' ? 'F' : 'C';
  if (state.current) render();
});

// Extra: manual refresh.
el.refresh.addEventListener('click', () => {
  load(state.city);
  restartTimer();
});

// ---------- Auto refresh ----------

function restartTimer() {
  clearInterval(state.timer);
  state.timer = setInterval(() => load(state.city), REFRESH_MS);
}

load(state.city);
restartTimer();
