import { useState, useEffect } from 'react'

// WMO weather interpretation codes → emoji + label
function getWeatherInfo(code) {
  if (code === 0) return { emoji: '☀️', label: 'Clear' }
  if (code <= 2) return { emoji: '⛅', label: 'Partly Cloudy' }
  if (code === 3) return { emoji: '☁️', label: 'Cloudy' }
  if (code <= 49) return { emoji: '🌫️', label: 'Foggy' }
  if (code <= 59) return { emoji: '🌦️', label: 'Drizzle' }
  if (code <= 69) return { emoji: '🌧️', label: 'Rainy' }
  if (code <= 79) return { emoji: '🌨️', label: 'Snowy' }
  if (code <= 82) return { emoji: '🌧️', label: 'Showers' }
  if (code <= 84) return { emoji: '🌨️', label: 'Snow Showers' }
  if (code <= 94) return { emoji: '⛈️', label: 'Thunderstorm' }
  return { emoji: '⛈️', label: 'Stormy' }
}

const PHOENIX_LAT = 33.4484
const PHOENIX_LON = -112.0740

export default function WeatherWidget() {
  const [weather, setWeather] = useState(null)

  async function fetchWeather() {
    try {
      const url = `https://api.open-meteo.com/v1/forecast?latitude=${PHOENIX_LAT}&longitude=${PHOENIX_LON}&current=temperature_2m,weathercode&temperature_unit=fahrenheit&timezone=America%2FPhoenix`
      const res = await fetch(url)
      const data = await res.json()
      const temp = Math.round(data.current.temperature_2m)
      const code = data.current.weathercode
      setWeather({ temp, ...getWeatherInfo(code) })
    } catch {
      // silently fail — weather is non-critical
    }
  }

  useEffect(() => {
    fetchWeather()
    const id = setInterval(fetchWeather, 30 * 60 * 1000) // refresh every 30 min
    return () => clearInterval(id)
  }, [])

  if (!weather) return null

  return (
    <div className="weather-widget">
      <div className="weather-top">
        <span className="weather-emoji">{weather.emoji}</span>
        <span className="weather-temp">{weather.temp}°F</span>
      </div>
      <span className="weather-label">{weather.label}</span>
    </div>
  )
}
