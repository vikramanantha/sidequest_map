const CONFIG = {
    SERVER: 'https://reel-mapper-server.fly.dev',
};

let map = null;
let markers = [];
let allPlaces = [];
let activeFilter = 'all';
let isFullscreen = false;

async function initSidequestMap() {
    try {
        const [keyRes, locRes] = await Promise.all([
            fetch(`${CONFIG.SERVER}/maps-key`),
            fetch(`${CONFIG.SERVER}/locations`),
        ]);
        if (!keyRes.ok) throw new Error(`Key fetch failed: ${keyRes.status}`);
        if (!locRes.ok) throw new Error(`Locations fetch failed: ${locRes.status}`);

        const { key } = await keyRes.json();
        const data = await locRes.json();
        allPlaces = (data.places || []).filter(p => p.lat && p.lng);

        await loadMapsApi(key);
        initMap();
        renderFilters();
    } catch (e) {
        document.getElementById('map').innerHTML =
            `<div id="map-loading" style="color:var(--color-accent);">
                <i class="fas fa-exclamation-circle"></i> Could not load map: ${esc(e.message)}
            </div>`;
        document.getElementById('filter-bar').innerHTML = '';
    }
}

function loadMapsApi(key) {
    return new Promise((resolve, reject) => {
        window.__mapsReady = resolve;
        const script = document.createElement('script');
        script.src = `https://maps.googleapis.com/maps/api/js?key=${key}&callback=__mapsReady&loading=async`;
        script.async = true;
        script.onerror = () => reject(new Error('Google Maps failed to load'));
        document.head.appendChild(script);
    });
}

function initMap() {
    map = new google.maps.Map(document.getElementById('map'), {
        zoom: 13,
        center: { lat: 37.44, lng: -122.17 },
        mapTypeControl: false,
        streetViewControl: false,
        fullscreenControl: false,
        zoomControlOptions: {
            position: google.maps.ControlPosition.RIGHT_BOTTOM,
        },
    });
    showPlaces(allPlaces);
}

function showPlaces(places) {
    markers.forEach(({ marker, iw }) => { marker.setMap(null); iw.close(); });
    markers = [];

    if (places.length === 0) return;

    const bounds = new google.maps.LatLngBounds();

    places.forEach(place => {
        const marker = new google.maps.Marker({
            position: { lat: place.lat, lng: place.lng },
            map,
            title: place.name,
        });

        const iw = new google.maps.InfoWindow({
            content: `
                <div style="font-family:'Lexend Deca',sans-serif;max-width:210px;padding:2px;">
                    <div style="font-weight:600;color:#0A2342;font-size:0.95rem;margin-bottom:3px;">${esc(place.name)}</div>
                    ${place.context ? `<div style="color:#555;font-size:0.82rem;margin-bottom:5px;">${esc(place.context)}</div>` : ''}
                    ${place.category ? `<span style="background:#0A2342;color:white;font-size:0.7rem;padding:2px 8px;border-radius:10px;">${esc(place.category)}</span>` : ''}
                    <br>
                    <a href="${esc(place.map_url)}" target="_blank" rel="noopener"
                       style="display:inline-block;margin-top:7px;background:#ED254E;color:white;font-size:0.78rem;font-weight:600;padding:4px 10px;border-radius:6px;text-decoration:none;">
                        Open in Maps ↗
                    </a>
                </div>`,
        });

        marker.addListener('click', () => {
            markers.forEach(m => m.iw.close());
            iw.open(map, marker);
        });

        markers.push({ marker, iw });
        bounds.extend({ lat: place.lat, lng: place.lng });
    });

    map.fitBounds(bounds);

    // Don't zoom too far in if only one pin
    const listener = google.maps.event.addListener(map, 'idle', () => {
        if (map.getZoom() > 15) map.setZoom(15);
        google.maps.event.removeListener(listener);
    });
}

function renderFilters() {
    const categories = [...new Set(allPlaces.map(p => p.category).filter(Boolean))];
    document.getElementById('filter-bar').innerHTML = `
        <button class="sm-filter-btn ${activeFilter === 'all' ? 'active' : ''}"
                onclick="setFilter('all')">All (${allPlaces.length})</button>
        ${categories.map(c => {
            const n = allPlaces.filter(p => p.category === c).length;
            return `<button class="sm-filter-btn ${activeFilter === c ? 'active' : ''}"
                            onclick="setFilter('${esc(c)}')">${esc(c)} (${n})</button>`;
        }).join('')}
    `;
}

function setFilter(cat) {
    activeFilter = cat;
    renderFilters();
    const filtered = cat === 'all' ? allPlaces : allPlaces.filter(p => p.category === cat);
    showPlaces(filtered);
}

function toggleFullscreen() {
    isFullscreen = !isFullscreen;
    document.body.classList.toggle('map-fullscreen', isFullscreen);
    document.getElementById('fullscreen-btn').innerHTML = isFullscreen
        ? '<i class="fas fa-compress"></i>'
        : '<i class="fas fa-expand"></i>';
    if (map) google.maps.event.trigger(map, 'resize');
}

function esc(str) {
    return String(str ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
