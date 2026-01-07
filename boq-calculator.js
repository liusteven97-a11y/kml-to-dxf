function calculateBOQ(features, unitRate) {
    const items = [];
    let totalCost = 0;
    const summary = {
        points: 0,
        lines: 0,
        polygons: 0
    };

    features.forEach((feature, index) => {
        const geomType = feature.geometry.type;
        const props = feature.properties;
        let quantity = 0;
        let unit = '';

        if (geomType === 'Point') {
            quantity = 1;
            unit = 'titik';
            summary.points++;
        } else if (geomType === 'LineString') {
            quantity = calculateLineLength(feature.geometry.coordinates);
            unit = 'meter';
            summary.lines++;
        } else if (geomType === 'Polygon') {
            quantity = calculatePolygonArea(feature.geometry.coordinates[0]);
            unit = 'm²';
            summary.polygons++;
        }

        const totalPrice = quantity * unitRate;
        totalCost += totalPrice;

        items.push({
            name: props.name || `Feature ${index + 1}`,
            type: geomType,
            quantity: quantity,
            unit: unit,
            unitPrice: unitRate,
            totalPrice: totalPrice
        });
    });

    return {
        items: items,
        totalCost: totalCost,
        summary: summary
    };
}

function calculateLineLength(coordinates) {
    let length = 0;
    for (let i = 0; i < coordinates.length - 1; i++) {
        length += haversineDistance(
            coordinates[i][1], coordinates[i][0],
            coordinates[i + 1][1], coordinates[i + 1][0]
        );
    }
    return length;
}

// Proyeksi lon/lat -> meter (Web Mercator) untuk perhitungan area yang lebih akurat
function lonLatToMeters(lon, lat) {
    const x = lon * 20037508.34 / 180;
    let y = Math.log(Math.tan((90 + lat) * Math.PI / 360)) / (Math.PI / 180);
    y = y * 20037508.34 / 180;
    return [x, y];
}

function calculatePolygonArea(coordinates) {
    // Proyeksikan setiap titik ke meter lalu hitung area dengan Shoelace pada koordinat proyeksi
    if (!coordinates || coordinates.length < 3) return 0;

    const pts = coordinates.map(c => lonLatToMeters(c[0], c[1]));

    // Pastikan ring tertutup (first == last)
    if (pts.length > 0) {
        const first = pts[0];
        const last = pts[pts.length - 1];
        if (first[0] !== last[0] || first[1] !== last[1]) {
            pts.push([first[0], first[1]]);
        }
    }

    let area = 0;
    for (let i = 0; i < pts.length - 1; i++) {
        const [x1, y1] = pts[i];
        const [x2, y2] = pts[i + 1];
        area += (x1 * y2) - (x2 * y1);
    }
    area = Math.abs(area / 2); // area dalam m^2

    return area;
}

function haversineDistance(lat1, lon1, lat2, lon2) {
    const R = 6371e3; // Earth radius in meters
    const φ1 = lat1 * Math.PI / 180;
    const φ2 = lat2 * Math.PI / 180;
    const Δφ = (lat2 - lat1) * Math.PI / 180;
    const Δλ = (lon2 - lon1) * Math.PI / 180;

    const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
              Math.cos(φ1) * Math.cos(φ2) *
              Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c;
}
