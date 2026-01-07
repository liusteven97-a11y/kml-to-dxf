function generateDXF(geoJson, filterType) {
    let dxf = '';

    // DXF Header
    dxf += '0\nSECTION\n2\nHEADER\n';
    dxf += '9\n$ACADVER\n1\nAC1015\n'; // AutoCAD 2000
    dxf += '9\n$INSUNITS\n70\n6\n'; // Meters
    dxf += '0\nENDSEC\n';

    // Tables Section
    dxf += '0\nSECTION\n2\nTABLES\n';
    dxf += '0\nTABLE\n2\nLAYER\n70\n1\n';
    dxf += '0\nLAYER\n2\nKML_LAYER\n70\n0\n62\n7\n6\nCONTINUOUS\n';
    dxf += '0\nENDTAB\n';
    dxf += '0\nENDSEC\n';

    // Entities Section
    dxf += '0\nSECTION\n2\nENTITIES\n';

    const features = filterType === 'all'
        ? geoJson.features
        : geoJson.features.filter(f => f.properties.geometryType.toLowerCase() === filterType.toLowerCase());

    // Collect all coordinates (projected to meters) to compute centroid for offset
    const allCoords = [];
    features.forEach(feature => {
        const geom = feature.geometry;
        if (!geom) return;
        if (geom.type === 'Point') {
            allCoords.push(lonLatToMeters(geom.coordinates[0], geom.coordinates[1]));
        } else if (geom.type === 'LineString') {
            geom.coordinates.forEach(c => allCoords.push(lonLatToMeters(c[0], c[1])));
        } else if (geom.type === 'Polygon') {
            const ring = geom.coordinates[0] || [];
            ring.forEach(c => allCoords.push(lonLatToMeters(c[0], c[1])));
        }
    });

    // Compute centroid (if any) to translate coordinates near origin for better CAD compatibility
    let cx = 0, cy = 0;
    if (allCoords.length > 0) {
        const s = allCoords.reduce((acc, p) => { acc.x += p[0]; acc.y += p[1]; return acc; }, {x:0,y:0});
        cx = s.x / allCoords.length;
        cy = s.y / allCoords.length;

        // Add comment with original centroid
        dxf += `999\nOriginal centroid X=${cx.toFixed(6)}, Y=${cy.toFixed(6)} (coordinates translated to origin)\n`;
    }

    // Convert each feature into DXF entities using projected coords translated by centroid
    features.forEach(feature => {
        dxf += convertFeatureToDXF(feature, cx, cy);
    });

    dxf += '0\nENDSEC\n';
    dxf += '0\nEOF\n';

    return dxf;
}

// Proyeksi lon/lat (derajat) -> meter (Web Mercator / EPSG:3857)
function lonLatToMeters(lon, lat) {
    const x = lon * 20037508.34 / 180;
    let y = Math.log(Math.tan((90 + lat) * Math.PI / 360)) / (Math.PI / 180);
    y = y * 20037508.34 / 180;
    return [x, y];
}

function convertFeatureToDXF(feature, cx = 0, cy = 0) {
    const geomType = feature.geometry.type;
    const coords = feature.geometry.coordinates;
    let dxf = '';

    function fmt(v) { return Number(v).toFixed(006); }

    if (geomType === 'Point') {
        const [x, y] = lonLatToMeters(coords[0], coords[1]);
        const tx = x - cx;
        const ty = y - cy;
        dxf += '0\nPOINT\n';
        dxf += '8\nKML_LAYER\n';
        dxf += `10\n${fmt(tx)}\n`;
        dxf += `20\n${fmt(ty)}\n`;
        dxf += `30\n${fmt(coords[2] || 0)}\n`;
    } else if (geomType === 'LineString') {
        // Use LWPOLYLINE for better compatibility
        const pts = coords.map(c => {
            const [x, y] = lonLatToMeters(c[0], c[1]);
            return [x - cx, y - cy];
        });

        dxf += '0\nLWPOLYLINE\n';
        dxf += '8\nKML_LAYER\n';
        dxf += `90\n${pts.length}\n`; // vertex count
        dxf += '70\n0\n'; // open polyline
        pts.forEach(p => {
            dxf += `10\n${fmt(p[0])}\n`;
            dxf += `20\n${fmt(p[1])}\n`;
        });
    } else if (geomType === 'Polygon') {
        const ring = coords[0];
        const pts = ring.map(c => {
            const [x, y] = lonLatToMeters(c[0], c[1]);
            return [x - cx, y - cy];
        });

        dxf += '0\nLWPOLYLINE\n';
        dxf += '8\nKML_LAYER\n';
        dxf += `90\n${pts.length}\n`;
        dxf += '70\n1\n'; // closed polyline
        pts.forEach(p => {
            dxf += `10\n${fmt(p[0])}\n`;
            dxf += `20\n${fmt(p[1])}\n`;
        });
    }

    return dxf;
}

// Export functions for testing in browser/node if needed
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { generateDXF, lonLatToMeters, convertFeatureToDXF };
}
