let uploadedFile = null;
let parsedData = null;
let map = null;
let boqData = null;

// Initialize application
document.addEventListener('DOMContentLoaded', function() {
    initializeUpload();
    initializeConversion();
});

function initializeUpload() {
    const uploadArea = document.getElementById('uploadArea');
    const fileInput = document.getElementById('fileInput');

    // Drag and drop functionality
    uploadArea.addEventListener('dragover', (e) => {
        e.preventDefault();
        uploadArea.classList.add('dragover');
    });

    uploadArea.addEventListener('dragleave', () => {
        uploadArea.classList.remove('dragover');
    });

    uploadArea.addEventListener('drop', (e) => {
        e.preventDefault();
        uploadArea.classList.remove('dragover');
        const files = e.dataTransfer.files;
        if (files.length > 0) {
            handleFileUpload(files[0]);
        }
    });

    fileInput.addEventListener('change', (e) => {
        if (e.target.files.length > 0) {
            handleFileUpload(e.target.files[0]);
        }
    });
}

async function handleFileUpload(file) {
    const validTypes = ['application/vnd.google-earth.kml+xml', 'application/vnd.google-earth.kmz', '.kml', '.kmz'];
    const fileName = file.name.toLowerCase();
    
    if (!fileName.endsWith('.kml') && !fileName.endsWith('.kmz')) {
        alert('Please upload a valid KML or KMZ file');
        return;
    }

    uploadedFile = file;
    showFileInfo(file);

    try {
        // Parse file
        if (fileName.endsWith('.kmz')) {
            parsedData = await parseKMZ(file);
        } else {
            parsedData = await parseKML(file);
        }

        // Show preview
        showPreview(parsedData);
        
        // Show conversion section
        document.getElementById('conversionSection').classList.remove('hidden');
    } catch (error) {
        console.error('Error parsing file:', error);
        alert('Error parsing file: ' + error.message);
    }
}

function showFileInfo(file) {
    const fileInfo = document.getElementById('fileInfo');
    const fileSize = (file.size / 1024).toFixed(2);
    fileInfo.innerHTML = `
        <div class="file-details">
            <p><strong>File:</strong> ${file.name}</p>
            <p><strong>Size:</strong> ${fileSize} KB</p>
            <p><strong>Type:</strong> ${file.name.endsWith('.kmz') ? 'KMZ' : 'KML'}</p>
        </div>
    `;
    fileInfo.classList.remove('hidden');
}

async function parseKML(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const kmlText = e.target.result;
                const parser = new DOMParser();
                const xmlDoc = parser.parseFromString(kmlText, 'text/xml');
                const geoJson = kmlToGeoJSON(xmlDoc);
                resolve(geoJson);
            } catch (error) {
                reject(error);
            }
        };
        reader.onerror = reject;
        reader.readAsText(file);
    });
}

async function parseKMZ(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = async (e) => {
            try {
                const zip = await JSZip.loadAsync(e.target.result);
                let kmlFile = null;
                
                // Find KML file in KMZ
                for (const filename in zip.files) {
                    if (filename.endsWith('.kml')) {
                        kmlFile = await zip.files[filename].async('string');
                        break;
                    }
                }
                
                if (!kmlFile) {
                    throw new Error('No KML file found in KMZ archive');
                }
                
                const parser = new DOMParser();
                const xmlDoc = parser.parseFromString(kmlFile, 'text/xml');
                const geoJson = kmlToGeoJSON(xmlDoc);
                resolve(geoJson);
            } catch (error) {
                reject(error);
            }
        };
        reader.onerror = reject;
        reader.readAsArrayBuffer(file);
    });
}

function kmlToGeoJSON(xmlDoc) {
    const features = [];
    
    // Parse Points
    const placemarks = xmlDoc.getElementsByTagName('Placemark');
    for (let i = 0; i < placemarks.length; i++) {
        const placemark = placemarks[i];
        const feature = parsePlacemark(placemark);
        if (feature) features.push(feature);
    }
    
    return {
        type: 'FeatureCollection',
        features: features
    };
}

function parsePlacemark(placemark) {
    const name = placemark.getElementsByTagName('name')[0]?.textContent || 'Unnamed';
    const description = placemark.getElementsByTagName('description')[0]?.textContent || '';
    
    // Point
    const point = placemark.getElementsByTagName('Point')[0];
    if (point) {
        const coords = point.getElementsByTagName('coordinates')[0]?.textContent.trim();
        if (coords) {
            const [lon, lat, alt] = coords.split(',').map(parseFloat);
            return {
                type: 'Feature',
                geometry: {
                    type: 'Point',
                    coordinates: [lon, lat, alt || 0]
                },
                properties: { name, description, geometryType: 'Point' }
            };
        }
    }
    
    // LineString
    const lineString = placemark.getElementsByTagName('LineString')[0];
    if (lineString) {
        const coords = lineString.getElementsByTagName('coordinates')[0]?.textContent.trim();
        if (coords) {
            const coordinates = coords.split(/\s+/).map(coord => {
                const [lon, lat, alt] = coord.split(',').map(parseFloat);
                return [lon, lat, alt || 0];
            });
            return {
                type: 'Feature',
                geometry: {
                    type: 'LineString',
                    coordinates: coordinates
                },
                properties: { name, description, geometryType: 'LineString' }
            };
        }
    }
    
    // Polygon
    const polygon = placemark.getElementsByTagName('Polygon')[0];
    if (polygon) {
        const outerBoundary = polygon.getElementsByTagName('outerBoundaryIs')[0];
        if (outerBoundary) {
            const coords = outerBoundary.getElementsByTagName('coordinates')[0]?.textContent.trim();
            if (coords) {
                const coordinates = coords.split(/\s+/).map(coord => {
                    const [lon, lat, alt] = coord.split(',').map(parseFloat);
                    return [lon, lat, alt || 0];
                });
                return {
                    type: 'Feature',
                    geometry: {
                        type: 'Polygon',
                        coordinates: [coordinates]
                    },
                    properties: { name, description, geometryType: 'Polygon' }
                };
            }
        }
    }
    
    return null;
}

function showPreview(geoJson) {
    document.getElementById('previewSection').classList.remove('hidden');
    
    // Initialize map if not already done
    if (!map) {
        map = L.map('map').setView([0, 0], 2);
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '© OpenStreetMap contributors'
        }).addTo(map);
    }
    
    // Clear existing layers
    map.eachLayer(layer => {
        if (layer instanceof L.Marker || layer instanceof L.Polyline || layer instanceof L.Polygon) {
            map.removeLayer(layer);
        }
    });
    
    // Add features to map
    const bounds = [];
    geoJson.features.forEach(feature => {
        const coords = feature.geometry.coordinates;
        const props = feature.properties;
        
        if (feature.geometry.type === 'Point') {
            const marker = L.marker([coords[1], coords[0]]).addTo(map);
            marker.bindPopup(`<b>${props.name}</b><br>${props.description}`);
            bounds.push([coords[1], coords[0]]);
        } else if (feature.geometry.type === 'LineString') {
            const latLngs = coords.map(c => [c[1], c[0]]);
            const polyline = L.polyline(latLngs, {color: 'blue'}).addTo(map);
            polyline.bindPopup(`<b>${props.name}</b><br>${props.description}`);
            bounds.push(...latLngs);
        } else if (feature.geometry.type === 'Polygon') {
            const latLngs = coords[0].map(c => [c[1], c[0]]);
            const polygon = L.polygon(latLngs, {color: 'green'}).addTo(map);
            polygon.bindPopup(`<b>${props.name}</b><br>${props.description}`);
            bounds.push(...latLngs);
        }
    });
    
    // Fit map to bounds
    if (bounds.length > 0) {
        map.fitBounds(bounds);
    }
}

function initializeConversion() {
    document.getElementById('convertBtn').addEventListener('click', performConversion);
    document.getElementById('downloadDxfBtn').addEventListener('click', downloadDXF);
    document.getElementById('downloadBoqBtn').addEventListener('click', downloadBOQ);
    document.getElementById('downloadJsonBtn').addEventListener('click', downloadJSON);
}

async function performConversion() {
    if (!parsedData) {
        alert('Please upload a file first');
        return;
    }

    const geometryType = document.getElementById('geometryType').value;
    const coordinateSystem = document.getElementById('coordinateSystem').value;
    const unitRate = parseFloat(document.getElementById('unitRate').value);

    // Filter features by geometry type
    let filteredFeatures = parsedData.features;
    if (geometryType !== 'all') {
        filteredFeatures = parsedData.features.filter(f => 
            f.properties.geometryType.toLowerCase() === geometryType.toLowerCase()
        );
    }

    // Calculate BOQ
    boqData = calculateBOQ(filteredFeatures, unitRate);
    displayBOQ(boqData);

    // Show download section
    document.getElementById('boqSection').classList.remove('hidden');
    document.getElementById('downloadSection').classList.remove('hidden');
}

function displayBOQ(boqData) {
    const summary = document.getElementById('boqSummary');
    summary.innerHTML = `
        <div class="summary-cards">
            <div class="summary-card">
                <h3>Total Items</h3>
                <p class="value">${boqData.items.length}</p>
            </div>
            <div class="summary-card">
                <h3>Points</h3>
                <p class="value">${boqData.summary.points}</p>
            </div>
            <div class="summary-card">
                <h3>Lines</h3>
                <p class="value">${boqData.summary.lines}</p>
            </div>
            <div class="summary-card">
                <h3>Polygons</h3>
                <p class="value">${boqData.summary.polygons}</p>
            </div>
            <div class="summary-card highlight">
                <h3>Total Cost</h3>
                <p class="value">Rp ${boqData.totalCost.toLocaleString('id-ID')}</p>
            </div>
        </div>
    `;

    const tbody = document.getElementById('boqTableBody');
    tbody.innerHTML = '';
    
    boqData.items.forEach((item, index) => {
        const row = tbody.insertRow();
        row.innerHTML = `
            <td>${index + 1}</td>
            <td>${item.name}</td>
            <td>${item.type}</td>
            <td>${item.quantity.toFixed(2)}</td>
            <td>${item.unit}</td>
            <td>Rp ${item.unitPrice.toLocaleString('id-ID')}</td>
            <td>Rp ${item.totalPrice.toLocaleString('id-ID')}</td>
        `;
    });

    document.getElementById('totalCost').textContent = `Rp ${boqData.totalCost.toLocaleString('id-ID')}`;
}

function downloadDXF() {
    const dxfContent = generateDXF(parsedData, document.getElementById('geometryType').value);
    const blob = new Blob([dxfContent], { type: 'application/dxf' });
    saveAs(blob, 'converted.dxf');
}

function downloadBOQ() {
    if (!boqData) {
        alert('Please convert the file first');
        return;
    }

    const wb = XLSX.utils.book_new();
    
    // Prepare data for Excel
    const wsData = [
        ['BILL OF QUANTITIES (BOQ)'],
        ['Generated on: ' + new Date().toLocaleDateString('id-ID')],
        [],
        ['No', 'Item', 'Type', 'Quantity', 'Unit', 'Unit Price (Rp)', 'Total Price (Rp)']
    ];

    boqData.items.forEach((item, index) => {
        wsData.push([
            index + 1,
            item.name,
            item.type,
            item.quantity,
            item.unit,
            item.unitPrice,
            item.totalPrice
        ]);
    });

    wsData.push([]);
    wsData.push(['', '', '', '', '', 'TOTAL:', boqData.totalCost]);

    const ws = XLSX.utils.aoa_to_sheet(wsData);
    XLSX.utils.book_append_sheet(wb, ws, 'BOQ');
    
    XLSX.writeFile(wb, 'BOQ_Report.xlsx');
}

function downloadJSON() {
    const jsonContent = JSON.stringify(parsedData, null, 2);
    const blob = new Blob([jsonContent], { type: 'application/json' });
    saveAs(blob, 'converted.json');
}
