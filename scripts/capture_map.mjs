// Capture a real map of South Limburg with the 4 opco locations, for the deck.
// Outputs deck/shots/map.png (retina) + deck/shots/map.json (pixel positions).
import { chromium } from 'playwright';
import fs from 'fs';

// Real proxy locations from the app (Companies tab): spread across NL.
const COMPANIES = [
  { code: 'ummels', name: 'Peter Ummels · Brunssum', risk: 'high', lat: 50.949, lon: 5.971 },
  { code: 'opcoa',  name: 'Opco A · Andijk',          risk: 'med',  lat: 52.742, lon: 5.190 },
  { code: 'opcoc',  name: 'Opco C · Winschoten',      risk: 'high', lat: 53.156, lon: 7.048 },
  { code: 'compe',  name: 'Company E · Winschoten',    risk: 'high', lat: 53.110, lon: 6.975 },
];

const W = 840, H = 1000;

const html = `<!DOCTYPE html><html><head>
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"/>
<style>html,body,#map{margin:0;height:${H}px;width:${W}px;background:#e8eef3}</style>
</head><body><div id="map"></div>
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<script>
  window.__ready=false;
  const map=L.map('map',{zoomControl:false,attributionControl:false});
  L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png',{maxZoom:19,subdomains:'abcd'}).addTo(map);
  const pts=${JSON.stringify(COMPANIES)};
  // whole Netherlands
  const b=L.latLngBounds([[50.74,3.30],[53.58,7.23]]).pad(0.02);
  map.fitBounds(b);
  map.whenReady(()=>{ setTimeout(()=>{
    window.__pts=pts.map(p=>{const cp=map.latLngToContainerPoint([p.lat,p.lon]); return {code:p.code,name:p.name,risk:p.risk,x:Math.round(cp.x),y:Math.round(cp.y)};});
    window.__size={w:${W},h:${H}};
    window.__ready=true;
  },400); });
</script></body></html>`;

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 2 });
await page.setContent(html, { waitUntil: 'networkidle' });
await page.waitForFunction('window.__ready===true', { timeout: 20000 });
await page.waitForTimeout(3000); // let tiles paint
const pts = await page.evaluate(() => window.__pts);
const size = await page.evaluate(() => window.__size);
fs.mkdirSync('deck/shots', { recursive: true });
await page.locator('#map').screenshot({ path: 'deck/shots/map.png' });
fs.writeFileSync('deck/shots/map.json', JSON.stringify({ size, pts }, null, 2));
console.log(JSON.stringify({ size, pts }));
await browser.close();
