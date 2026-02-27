const fs = require('fs');
const path = require('path');
const proj4 = require('proj4');

// RD New (Amersfoort) EPSG:28992
proj4.defs("EPSG:28992", "+proj=sterea +lat_0=52.15616055555555 +lon_0=5.38763888888889 +k=0.9999079 +x_0=155000 +y_0=463000 +ellps=bessel +datum=datumurn:ogc:def:datum:EPSG::6289 +towgs84=565.2369,50.0087,465.658,-0.406857330322398,0.350732676542563,-1.8703473836068,4.0812 +units=m +no_defs");
// WGS84 EPSG:4326
proj4.defs("EPSG:4326", "+proj=longlat +datum=WGS84 +no_defs");

const API_URL = "https://api.data.amsterdam.nl/v1/huishoudelijkafval/container/?_pageSize=2000";

async function fetchAll() {
    let url = API_URL;
    let allContainers = [];
    let page = 1;

    console.log("Starting to fetch containers from Amsterdam Open Data API...");

    while (url) {
        console.log(`Fetching page ${page}...`);
        const res = await fetch(url);
        if (!res.ok) {
            console.error("Failed to fetch page", page, res.status, res.statusText);
            break;
        }
        const data = await res.json();
        if (!data._embedded || !data._embedded.container) break;

        // Process geometries and format
        const processed = data._embedded.container.map(c => {
            let lat = null, lng = null;
            if (c.geometrie && c.geometrie.type === 'Point' && c.geometrie.coordinates) {
                const [x, y] = c.geometrie.coordinates;
                // Convert RD to WGS84
                try {
                    const [lon_deg, lat_deg] = proj4("EPSG:28992", "EPSG:4326", [x, y]);
                    lat = lat_deg;
                    lng = lon_deg;
                } catch (e) {
                    console.error("Proj4 conversion error for container", c.id, e);
                }
            }
            return {
                id: c.id,
                fractie: c.fractieOmschrijving,
                lat,
                lng
            };
        }).filter(c => c.lat !== null && c.lng !== null); // only keep those with valid coords

        allContainers.push(...processed);

        // Pagination
        if (data._links && data._links.next && data._links.next.href) {
            url = data._links.next.href;
            page++;
        } else {
            url = null;
        }
    }

    console.log(`Finished fetching. Total valid containers: ${allContainers.length}`);
    const outPath = path.join(__dirname, '..', 'data', 'containers.json');
    fs.writeFileSync(outPath, JSON.stringify(allContainers));
    console.log(`Saved to ${outPath}`);
}

fetchAll().catch(console.error);
