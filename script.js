// ---------- 1. Locations (3 districts near hometown Gujar Khan) ----------
const LOCATIONS = [
  { name: 'Rawalpindi', short: 'RAWALPINDI', tag: 'District Rawalpindi · Home district of Gujar Khan', lat: 33.5651, lon: 73.0169 },
  { name: 'Murree',     short: 'MURREE',     tag: 'District Murree · Hill district',                  lat: 33.9062, lon: 73.3903 },
  { name: 'Jhelum',     short: 'JHELUM',     tag: 'District Jhelum · Neighbour of Gujar Khan',        lat: 32.9425, lon: 73.7257 }
];

// ---------- 2. Open-Meteo API URL (one request, 3 locations) ----------
const lats = LOCATIONS.map(l => l.lat).join(',');
const lons = LOCATIONS.map(l => l.lon).join(',');
const API_URL =
  'https://api.open-meteo.com/v1/forecast' +
  `?latitude=${lats}&longitude=${lons}` +
  '&current=temperature_2m,relative_humidity_2m,wind_speed_10m,wind_direction_10m' +
  '&timezone=auto';

document.getElementById('apiUrl').textContent = API_URL;
document.getElementById('apiUrl').title = API_URL;

// ---------- 3. Temperature -> colour ----------
function tempClass(t) {
  if (t < 10) return { color: '#6366f1', label: 'Very Cold' };
  if (t < 18) return { color: '#0ea5e9', label: 'Cool' };
  if (t < 25) return { color: '#10b981', label: 'Pleasant' };
  if (t < 32) return { color: '#f59e0b', label: 'Warm' };
  return { color: '#f43f5e', label: 'Hot' };
}
// gauge fill percent: -5°C = 0%, 45°C = 100%
function gaugePercent(t) {
  return Math.max(8, Math.min(100, ((t + 5) / 50) * 100));
}

// ---------- 4. Basemaps (all free, no API key) ----------
const baseLayers = {
  sat: new ol.layer.Group({
    layers: [
      new ol.layer.Tile({
        source: new ol.source.XYZ({
          url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
          attributions: 'Tiles © Esri — Source: Esri, Maxar, Earthstar Geographics',
          maxZoom: 18
        })
      }),
      new ol.layer.Tile({
        source: new ol.source.XYZ({
          url: 'https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}',
          maxZoom: 18
        })
      })
    ]
  }),
  street: new ol.layer.Tile({
    visible: false,
    source: new ol.source.OSM()
  }),
  dark: new ol.layer.Group({
    visible: false,
    layers: [
      new ol.layer.Tile({
        source: new ol.source.XYZ({
          url: 'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}',
          attributions: 'Tiles © Esri',
          maxZoom: 16
        })
      }),
      new ol.layer.Tile({
        source: new ol.source.XYZ({
          url: 'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Reference/MapServer/tile/{z}/{y}/{x}',
          maxZoom: 16
        })
      })
    ]
  })
};

baseLayers.sat.setVisible(true);

const map = new ol.Map({
  target: 'map',
  layers: [baseLayers.sat, baseLayers.street, baseLayers.dark],
  view: new ol.View({
    center: ol.proj.fromLonLat([73.38, 33.47]),
    zoom: 9
  })
});

// Switcher buttons
document.querySelectorAll('#switcher button').forEach(btn => {
  btn.onclick = () => {
    Object.keys(baseLayers).forEach(k => baseLayers[k].setVisible(k === btn.dataset.layer));
    document.querySelectorAll('#switcher button').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
  };
});

function fitAll(animated = true) {
  const coords = LOCATIONS.map(l => ol.proj.fromLonLat([l.lon, l.lat]));
  const extent = ol.extent.boundingExtent(coords);
  const small = window.innerWidth <= 768;
  map.getView().fit(extent, {
    padding: small ? [130, 40, 290, 40] : [130, 400, 130, 220],
    duration: animated ? 1200 : 0,
    maxZoom: 11
  });
}
fitAll(false);

// ---------- 5. Popup overlay ----------
const popupEl = document.getElementById('popup');
const popupContent = document.getElementById('popupContent');
const popup = new ol.Overlay({
  element: popupEl,
  positioning: 'bottom-center',
  offset: [0, -42],
  autoPan: { animation: { duration: 300 } }
});
map.addOverlay(popup);

function openPopup(loc, w) {
  const c = tempClass(w.temp);
  popupEl.style.setProperty('--c', c.color);
  popupContent.innerHTML = `
    <h3>📍 ${loc.name}</h3>
    <div class="sub">${loc.tag} · ${c.label}</div>
    <div class="row"><span>🌡️ Temperature</span><span class="big">${w.temp} °C</span></div>
    <div class="row"><span>💧 Relative Humidity</span><span>${w.hum} %</span></div>
    <div class="row"><span>💨 Wind Speed</span><span>${w.wind} km/h</span></div>
    <div class="bar"><div style="width:${w.hum}%"></div></div>
  `;
  popup.setPosition(ol.proj.fromLonLat([loc.lon, loc.lat]));
}
function closePopup() { popup.setPosition(undefined); }
document.getElementById('popupClose').onclick = closePopup;

// ---------- 6. Markers, cards, summary ----------
let markerOverlays = [];

function flyTo(loc, w) {
  map.getView().animate({
    center: ol.proj.fromLonLat([loc.lon, loc.lat]),
    zoom: 12,
    duration: 1000
  }, () => openPopup(loc, w));
}

function render(data) {
  markerOverlays.forEach(o => map.removeOverlay(o));
  markerOverlays = [];
  const cards = document.getElementById('cards');
  cards.innerHTML = '';

  const results = LOCATIONS.map((loc, i) => {
    const cur = data[i].current;
    return {
      loc,
      w: {
        temp: cur.temperature_2m,
        hum: cur.relative_humidity_2m,
        wind: cur.wind_speed_10m,
        dir: cur.wind_direction_10m
      }
    };
  });

  results.forEach(({ loc, w }) => {
    const c = tempClass(w.temp);

    // gauge marker
    const el = document.createElement('div');
    el.className = 'marker';
    el.style.setProperty('--c', c.color);
    el.style.setProperty('--p', gaugePercent(w.temp));
    el.innerHTML = `<div class="inner"><b>${Math.round(w.temp)}°</b><small>${loc.short}</small></div>`;
    el.addEventListener('click', (e) => { e.stopPropagation(); openPopup(loc, w); });

    const overlay = new ol.Overlay({
      element: el,
      position: ol.proj.fromLonLat([loc.lon, loc.lat]),
      positioning: 'center-center',
      stopEvent: true
    });
    map.addOverlay(overlay);
    markerOverlays.push(overlay);

    // card
    const card = document.createElement('div');
    card.className = 'card';
    card.style.setProperty('--c', c.color);
    card.innerHTML = `
      <h3>${loc.name} <span class="label">${c.label}</span></h3>
      <div class="tag">${loc.tag}</div>
      <div class="temp">${w.temp} °C</div>
      <div class="stats">
        <span>💧 ${w.hum}%</span>
        <span>💨 ${w.wind} km/h <span class="arrow" style="transform:rotate(${w.dir + 180}deg)">➤</span></span>
      </div>
      <div class="bar"><div style="width:${w.hum}%"></div></div>
    `;
    card.onclick = () => flyTo(loc, w);
    cards.appendChild(card);
  });

  // hottest / coolest summary
  const sorted = [...results].sort((a, b) => b.w.temp - a.w.temp);
  const hot = sorted[0], cold = sorted[sorted.length - 1];
  document.getElementById('summary').innerHTML = `
    <div class="chip" style="--c:${tempClass(hot.w.temp).color}"><span>🔥 Hottest</span><b>${hot.loc.name}</b></div>
    <div class="chip" style="--c:${tempClass(cold.w.temp).color}"><span>❄️ Coolest</span><b>${cold.loc.name}</b></div>
  `;

  document.getElementById('updated').textContent =
    'Last updated: ' + new Date().toLocaleTimeString();
}

// ---------- 7. Fetch weather ----------
async function loadWeather() {
  const cards = document.getElementById('cards');
  cards.innerHTML = '<div class="loading">Loading weather data...</div>';
  try {
    const res = await fetch(API_URL);
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const data = await res.json();
    render(Array.isArray(data) ? data : [data]);
  } catch (err) {
    cards.innerHTML = `<div class="loading">⚠️ Data load nahi hua. Internet check karo.<br>${err.message}</div>`;
  }
}

// ---------- 8. Buttons & events ----------
document.getElementById('refreshBtn').onclick = () => { closePopup(); loadWeather(); fitAll(); };
document.getElementById('copyBtn').onclick = () => {
  navigator.clipboard.writeText(API_URL);
  const b = document.getElementById('copyBtn');
  b.textContent = 'Copied ✓';
  setTimeout(() => b.textContent = 'Copy', 1500);
};
map.on('click', closePopup);
window.addEventListener('resize', () => map.updateSize());

loadWeather();
setInterval(loadWeather, 10 * 60 * 1000); // auto refresh every 10 min