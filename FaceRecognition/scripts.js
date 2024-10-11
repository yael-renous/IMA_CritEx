// Declare variables that will be used across functions
let video, canvas, ctx, cocoSsdModel;
let detectedObjects = []; // Array to store detected objects and faces
let objectData; // Variable to store the loaded JSON data

// Load the JSON data
async function loadObjectData() {
    const response = await fetch('./JSON/objects.json');
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
    drawGenderDetection(resizedResults)

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

// function applyFilter(sourceCanvas, filter) {
//     const tempCanvas = document.createElement('canvas');
//     tempCanvas.width = sourceCanvas.width;
//     tempCanvas.height = sourceCanvas.height;
//     const tempCtx = tempCanvas.getContext('2d');
    
//     tempCtx.filter = filter;
//     tempCtx.drawImage(sourceCanvas, 0, 0);
    
//     return tempCanvas;
// }

function drawObjectDetections(detections) {
    detections.forEach(detection => {
        const [x, y, width, height] = detection.bbox;
        const label = detection.class;

        const objectInfo = getObjectData(label);
        if (objectInfo) {
            // Create a temporary canvas for the detection area
            // const tempCanvas = document.createElement('canvas');
            // tempCanvas.width = width;
            // tempCanvas.height = height;
            // const tempCtx = tempCanvas.getContext('2d');

            // // Draw the detection area onto the temporary canvas
            // tempCtx.drawImage(video, x, y, width, height);

            // // Apply filter
            // const filteredCanvas = applyFilter(tempCanvas, 'grayscale(100%)');

            // // Draw the filtered area back onto the main canvas
            // ctx.drawImage(filteredCanvas, x, y);

            // Draw bounding box
            ctx.strokeStyle = objectInfo.color;
            ctx.lineWidth = 2;
            ctx.strokeRect(x, y, width, height);

            // Draw label above the box
            ctx.fillStyle = objectInfo.color;
            ctx.font = '16px Arial';
            ctx.fillText(label, x, y - 5);

            // Store the detection in the detectedObjects array
            detectedObjects.push({
                type: 'object',
                boundingBox: {x, y, width, height},
                label: label,
                descriptions: objectInfo.descriptions
            });
        }
    });
}

function drawGenderDetection(detections) {
    detections.forEach(detection => {
        const { age, gender, detection: faceDetection } = detection;
        const { box } = faceDetection;

        let ageGroup;
        if (age < 18) ageGroup = 'child';
        else if (age >= 18 && age <= 50) ageGroup = 'adult';
        else ageGroup = 'senior';

        const identifier = `${gender.toLowerCase()}-${ageGroup}`;
        const faceInfo = getObjectData(identifier);

        if (faceInfo) {
            // Create a temporary canvas for the detection area
            const tempCanvas = document.createElement('canvas');
            tempCanvas.width = box.width;
            tempCanvas.height = box.height;
            const tempCtx = tempCanvas.getContext('2d');
            tempCtx.filter = "grayscale(100%)";

            // Calculate the scaling factors
            const scaleX = video.videoWidth / canvas.width;
            const scaleY = video.videoHeight / canvas.height;

            // Draw the detection area onto the temporary canvas, applying the scaling
            tempCtx.drawImage(
                video, 
                box.x * scaleX, 
                box.y * scaleY, 
                box.width * scaleX, 
                box.height * scaleY, 
                0, 
                0, 
                box.width, 
                box.height
            );

            // Draw the filtered area back onto the main canvas
            ctx.drawImage(tempCanvas, box.x, box.y);

            // Draw bounding box
            ctx.strokeStyle = faceInfo.color;
            ctx.lineWidth = 2;
            ctx.strokeRect(box.x, box.y, box.width, box.height);
            // Prepare text to display
            const label = `${gender}, Age: ${Math.round(age)}`;

            // Draw label above the box
            ctx.fillStyle = faceInfo.color;
            ctx.font = '16px Arial';
            ctx.fillText(label, box.x, box.y - 5);

            // Store the detection in the detectedObjects array
            detectedObjects.push({
                type: 'face',
                boundingBox: {x: box.x, y: box.y, width: box.width, height: box.height},
                label: label,
                descriptions: faceInfo.descriptions
            });
        }
    });
}

// Update handleCanvasClick function to work with bounding boxes
function handleCanvasClick(event) {
    const rect = canvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;

    for (const obj of detectedObjects) {
        const { boundingBox } = obj;
        if (x >= boundingBox.x && x <= boundingBox.x + boundingBox.width &&
            y >= boundingBox.y && y <= boundingBox.y + boundingBox.height) {
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
    const stream = await navigator.mediaDevices.getUserMedia({
        video: {
            facingMode: "environment"
        }
    })
    video.srcObject = stream
    // Wait for the video metadata to load before playing
    await new Promise(resolve => video.onloadedmetadata = resolve)
    video.play()

    // Resize canvas to match video dimensions
    resizeCanvas();

    // Get the existing canvas element from the HTML
    canvas = document.getElementById('canvas')
    // Get the 2D rendering context for the canvas
    ctx = canvas.getContext('2d', { willReadFrequently: true })

    // Set canvas size to match the window size
    function resizeCanvas() {
        if(!canvas) return;
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
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