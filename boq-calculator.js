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

function calculatePolygonArea(coordinates) {
    // Using Shoelace formula for area calculation
    let area = 0;
    const n = coordinates.length;
    
    for (let i = 0; i < n - 1; i++) {
        const [lon1, lat1] = coordinates[i];
        const [lon2, lat2] = coordinates[i + 1];
        area += (lon1 * lat2) - (lon2 * lat1);
    }
    
    area = Math.abs(area / 2);
    
    // Convert to square meters (approximate)
    const metersPerDegree = 111320; // at equator
    return area * metersPerDegree * metersPerDegree;
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
