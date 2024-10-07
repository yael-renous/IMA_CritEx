let cocoSsdModel, blazeFaceModel;
const video = document.getElementById('video');
const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');

const detectionConfig = {
    'person': { color: 'red'},
    'tree': { color: 'green' },
    'building': { color: 'gray' },
    'cell phone': { color: 'blue' },
    'dog': { color: 'brown' },
    'cup': { color: 'purple' },
    'fork': { color: 'orange' },
    'knife': { color: 'yellow' },
    'spoon': { color: 'pink' },
    'carrot': { color: 'orange' },
    'potted plant': { color: 'lightgreen' },
    'mouse': { color: 'gray' },
    'remote': { color: 'black' },
    'clock': { color: 'gold' }
};

// Load the COCO-SSD model and start the webcam
async function init() {
    try {
        [cocoSsdModel, blazeFaceModel] = await Promise.all([
            cocoSsd.load(),
            blazeface.load()
        ]);

        if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
            const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
            video.srcObject = stream;
            video.play();
            video.onloadedmetadata = () => {
                canvas.width = video.videoWidth;
                canvas.height = video.videoHeight;
                detectFrame();
            };
        } else {
            console.error('getUserMedia is not supported');
            showError('Camera access is not supported in this browser.');
        }
    } catch (error) {
        console.error('Error during initialization:', error);
        showError('Failed to initialize the app. ' + error.message);
    }
}

// Detect objects in the video stream
async function detectFrame() {
    try {
        const predictions = await cocoSsdModel.detect(video);
        const faces = await blazeFaceModel.estimateFaces(video, false);

        ctx.clearRect(0, 0, canvas.width,canvas.height);
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        
        for (let prediction of predictions) {
            if ([
                'person', 'tree', 'building',
                'cell phone', 'dog', 'cup',
                'fork', 'knife', 'spoon',
                'carrot', 'potted plant', 'mouse',
                'remote', 'clock'
            ].includes(prediction.class)) {
                if (prediction.class === 'person') {
                    const gender = await detectGender(prediction.bbox, faces);
                    drawPrediction(prediction, gender);
                } else {
                    drawPrediction(prediction);
                }
            }
        }

        requestAnimationFrame(detectFrame);
    } catch (error) {
        console.error('Error during detection:', error);
        showError('An error occurred during detection.');
    }
}

// Draw bounding box and label for a prediction
async function detectGender(personBox, faces) {
    for (let face of faces) {
        const [x, y, width, height] = face.topLeft.concat(face.bottomRight);
        if (isOverlapping(personBox, [x, y, width - x, height - y])) {
            // This is a very simple gender detection based on face landmarks
            // It's not very accurate and should not be used in production
            const leftEye = face.landmarks[1];
            const rightEye = face.landmarks[0];
            const eyeDistance = Math.sqrt(Math.pow(leftEye[0] - rightEye[0], 2) + Math.pow(leftEye[1] - rightEye[1], 2));
            const faceWidth = width - x;
            return eyeDistance / faceWidth > 0.2 ? 'Woman' : 'Man';
        }
    }
    return 'Person';
}

function isOverlapping(box1, box2) {
    return (box1[0] < box2[0] + box2[2] &&
            box1[0] + box1[2] > box2[0] &&
            box1[1] < box2[1] + box2[3] &&
            box1[1] + box1[3] > box2[1]);
}

function drawPrediction(prediction, gender = null) {
    const [x, y, width, height] = prediction.bbox;
    const config = detectionConfig[prediction.class] || { color: '#00FFFF' };
    ctx.strokeStyle = config.color;
    ctx.lineWidth = 4;
    ctx.strokeRect(x, y, width, height);
    
    if (gender === 'Woman') {
        // Fill with horizontal lines
        ctx.fillStyle = config.color;
        const lineSpacing = 5;
        for (let i = y; i < y + height; i += lineSpacing) {
            ctx.beginPath();
            ctx.moveTo(x, i);
            ctx.lineTo(x + width, i);
            ctx.stroke();
        }
        
        // Write "ERROR 404: NOT FOUND"
        ctx.fillStyle = 'white';
        ctx.font = 'bold 16px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('ERROR 404: NOT FOUND', x + width / 2, y + height / 2);
    } else {
        // Original behavior for other cases
        ctx.fillStyle = config.color;
        ctx.font = '18px Arial';
        ctx.fillText(gender || prediction.class, x, y > 10 ? y - 5 : 10);
    }
}

function setCanvasSize() {
    // ... existing function ...
}

function getLocation() {
    return new Promise((resolve, reject) => {
        if ("geolocation" in navigator) {
            navigator.geolocation.getCurrentPosition(resolve, reject);
        } else {
            reject(new Error("Geolocation is not supported by this browser."));
        }
    });
}

async function displayLocation() {
    try {
        const position = await getLocation();
        const { latitude, longitude } = position.coords;
        
        // Create a container for the location information
        const locationDiv = document.createElement('div');
        locationDiv.id = 'location-info';
        locationDiv.style.position = 'absolute';
        locationDiv.style.top = '10px';
        locationDiv.style.left = '10px';
        locationDiv.style.backgroundColor = 'rgba(0, 0, 0, 0.7)';
        locationDiv.style.color = 'white';
        locationDiv.style.padding = '10px';
        locationDiv.style.borderRadius = '5px';
        
        // Display coordinates
        locationDiv.innerHTML = `Latitude: ${latitude.toFixed(6)}<br>Longitude: ${longitude.toFixed(6)}`;
        
        // Append to body
        document.body.appendChild(locationDiv);
        
        // Optional: Use a mapping service to get more readable location info
        const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}`);
        const data = await response.json();
        if (data.display_name) {
            locationDiv.innerHTML += `<br>Location: ${data.display_name}`;
        }
    } catch (error) {
        console.error("Error getting location:", error);
    }
}

document.addEventListener('DOMContentLoaded', () => {
    const video = document.getElementById('video');
    const canvas = document.getElementById('canvas');
    const ctx = canvas.getContext('2d');

    // Set up video stream
    navigator.mediaDevices.getUserMedia({ video: true })
        .then(stream => {
            video.srcObject = stream;
            video.addEventListener('loadedmetadata', setCanvasSize);
        })
        .catch(error => console.error('Error accessing camera:', error));

    // Display user's location
    displayLocation();

    // ... rest of your existing code (COCO-SSD and BlazeFace) ...
});

// Start the application
init();
