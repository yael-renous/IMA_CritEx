// Declare variables that will be used across functions
let video, canvas, ctx, cocoSsdModel;
let detectedObjects = []; // Array to store detected objects and faces
let objectData; // Variable to store the loaded JSON data

// Load the JSON data
async function loadObjectData() {
    const response = await fetch('JSON/Objects.json');
    objectData = await response.json();
}

// Function to get object data by identifier
function getObjectData(identifier) {
    return objectData.find(obj => obj.identifier === identifier);
}

// Function to detect faces and provide results
async function detectFrame() {   
    // Detect faces, landmarks, descriptors, age, and gender from the video feed
    const faceAIData = await faceapi.detectAllFaces(video).withFaceLandmarks().withFaceDescriptors().withAgeAndGender()
    
    // Clear the canvas before drawing new results
    ctx.clearRect(0, 0, canvas.width, canvas.height)


    // Detect objects
    if (cocoSsdModel) {
        //console.log("cocoSsdModel is loaded");
        const objectDetections = await cocoSsdModel.detect(video);
        // Resize object detections to match canvas size
        const resizedObjectDetections = resizeDetections(objectDetections, { width: canvas.width, height: canvas.height });
        drawObjectDetections(resizedObjectDetections);
    }

    // Detect faces
    const resizedResults = faceapi.resizeResults(faceAIData, { width: canvas.width, height: canvas.height })
    drawCustomDetections(resizedResults)

    // Request the next animation frame to continue face detection
    requestAnimationFrame(detectFrame)
}

function resizeDetections(detections, dimensions) {
    const { width, height } = dimensions;
    return detections.map(detection => {
        const { bbox, class: className, score } = detection;
        const [x, y, boxWidth, boxHeight] = bbox;
        
        return {
            bbox: [
                (x / video.videoWidth) * width,
                (y / video.videoHeight) * height,
                (boxWidth / video.videoWidth) * width,
                (boxHeight / video.videoHeight) * height
            ],
            class: className,
            score: score
        };
    });
}

function drawObjectDetections(detections) {
    detections.forEach(detection => {
        const [x, y, width, height] = detection.bbox;
        const centerX = x + width / 2;
        const centerY = y + height / 2;
        const label = detection.class;
        const radius = Math.min(width, height) / 4; // Adjust size as needed

        const objectInfo = getObjectData(label);
        if (objectInfo) {
            // Draw circular button
            ctx.beginPath();
            ctx.arc(centerX, centerY, radius, 0, 2 * Math.PI);
            ctx.fillStyle = objectInfo.color;
            ctx.fill();
            ctx.strokeStyle = objectInfo.color;
            ctx.lineWidth = 2;
            ctx.stroke();

            // Draw label above the button
            ctx.fillStyle = '#fff';
            ctx.font = '12px Arial';
            ctx.textAlign = 'center';
            ctx.fillText(label, centerX, y - 10);

            // Store the detection in the detectedObjects array
            detectedObjects.push({
                type: 'object',
                center: [centerX, centerY],
                radius: radius,
                label: label,
                descriptions: objectInfo.descriptions
            });
        }
    });
}

function drawCustomDetections(detections) {
    detections.forEach(detection => {
        const { age, gender, detection: faceDetection } = detection;
        const { box } = faceDetection;
        const centerX = box.x + box.width / 2;
        const centerY = box.y + box.height / 2;
        const radius = Math.min(box.width, box.height) / 4; // Adjust size as needed

        let ageGroup;
        if (age < 18) ageGroup = 'child';
        else if (age >= 18 && age <= 50) ageGroup = 'adult';
        else ageGroup = 'senior';

        const identifier = `${gender.toLowerCase()}-${ageGroup}`;
        const faceInfo = getObjectData(identifier);

        if (faceInfo) {
            // Draw circular button
            ctx.beginPath();
            ctx.arc(centerX, centerY, radius, 0, 2 * Math.PI);
            ctx.fillStyle = faceInfo.color;
            ctx.fill();
            ctx.strokeStyle = faceInfo.color;
            ctx.lineWidth = 2;
            ctx.stroke();

            // Prepare text to display
            const label = `${gender}, Age: ${Math.round(age)}`;

            // Draw label above the button
            ctx.fillStyle = '#fff';
            ctx.font = '12px Arial';
            ctx.textAlign = 'center';
            ctx.fillText(label, centerX, box.y - 10);

            // Store the detection in the detectedObjects array
            detectedObjects.push({
                type: 'face',
                center: [centerX, centerY],
                radius: radius,
                label: label,
                descriptions: faceInfo.descriptions
            });
        }
    });
}

// New function to handle canvas clicks
function handleCanvasClick(event) {
    const rect = canvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;

    for (const obj of detectedObjects) {
        const [centerX, centerY] = obj.center;
        const dx = x - centerX;
        const dy = y - centerY;
        if (dx * dx + dy * dy <= obj.radius * obj.radius) {
            const randomDescription = obj.descriptions[Math.floor(Math.random() * obj.descriptions.length)];
            alert(`${obj.label}: ${randomDescription}`);
            return;
        }
    }
}

// Main function to run the facial detection
const run = async () => {
    // Load JSON data
    await loadObjectData();

    // Load required face-api.js models
    await Promise.all([
        faceapi.nets.ssdMobilenetv1.loadFromUri('./models'),
        faceapi.nets.faceLandmark68Net.loadFromUri('./models'),
        faceapi.nets.faceRecognitionNet.loadFromUri('./models'),
        faceapi.nets.ageGenderNet.loadFromUri('./models'),
    ]);
    
    // Load COCO-SSD model
    try {
        cocoSsdModel = await cocoSsd.load();
    } catch (error) {
        console.error('Failed to load COCO-SSD model:', error);
        cocoSsdModel = null;
    }

    // Create a video element to display the camera feed
    video = document.createElement('video')
    video.id = 'video'
    document.body.appendChild(video)

    // Access the user's camera
    const stream = await navigator.mediaDevices.getUserMedia({ video: {} })
    video.srcObject = stream
    // Wait for the video metadata to load before playing
    await new Promise(resolve => video.onloadedmetadata = resolve)
    video.play()

    // Get the existing canvas element from the HTML
    canvas = document.getElementById('canvas')
    // Get the 2D rendering context for the canvas
    ctx = canvas.getContext('2d', { willReadFrequently: true })

    // Set canvas size to match the window size
    function resizeCanvas() {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
    }

    // Call resizeCanvas initially and add event listener for window resize
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    // Add click event listener to the canvas
    canvas.addEventListener('click', handleCanvasClick);

    // Start the face detection process
    detectFrame()
}

// Call the main function to start the application
run()