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

    features.forEach(feature => {
        dxf += convertFeatureToDXF(feature);
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

function convertFeatureToDXF(feature) {
    const geomType = feature.geometry.type;
    const coords = feature.geometry.coordinates;
    let dxf = '';

    if (geomType === 'Point') {
        const [x, y] = lonLatToMeters(coords[0], coords[1]);
        dxf += '0\nPOINT\n';
        dxf += '8\nKML_LAYER\n';
        dxf += `10\n${x}\n`;
        dxf += `20\n${y}\n`;
        dxf += `30\n${coords[2] || 0}\n`;
    } else if (geomType === 'LineString') {
        dxf += '0\nPOLYLINE\n';
        dxf += '8\nKML_LAYER\n';
        dxf += '66\n1\n'; // Vertices follow
        dxf += '70\n0\n'; // Open polyline

        coords.forEach(coord => {
            const [x, y] = lonLatToMeters(coord[0], coord[1]);
            dxf += '0\nVERTEX\n';
            dxf += '8\nKML_LAYER\n';
            dxf += `10\n${x}\n`;
            dxf += `20\n${y}\n`;
            dxf += `30\n${coord[2] || 0}\n`;
        });

        dxf += '0\nSEQEND\n';
    } else if (geomType === 'Polygon') {
        const ring = coords[0];
        dxf += '0\nPOLYLINE\n';
        dxf += '8\nKML_LAYER\n';
        dxf += '66\n1\n';
        dxf += '70\n1\n'; // Closed polyline

        ring.forEach(coord => {
            const [x, y] = lonLatToMeters(coord[0], coord[1]);
            dxf += '0\nVERTEX\n';
            dxf += '8\nKML_LAYER\n';
            dxf += `10\n${x}\n`;
            dxf += `20\n${y}\n`;
            dxf += `30\n${coord[2] || 0}\n`;
        });

        dxf += '0\nSEQEND\n';
    }

    return dxf;
}
