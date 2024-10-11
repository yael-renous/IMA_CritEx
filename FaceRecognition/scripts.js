// Declare variables that will be used across functions
let video, canvas, ctx, cocoSsdModel;
let detectedObjects = []; // Array to store detected objects and faces
let objectData; // Variable to store the loaded JSON data
let isClicked = false;

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

function drawDetection(detection, info, type) {
    // Determine the bounding box coordinates and dimensions based on detection type
    let x, y, width, height;
    let label;

    if (type === 'face') {
        // For face detections, use the 'detection' property
        const box = detection.detection.box;
        x = box.x;
        y = box.y;
        width = box.width;
        height = box.height;

        // Create a label with gender and rounded age for face detections
        label = `${detection.gender}, Age: ${Math.round(detection.age)}`;
    } else {
        // For object detections, use the 'bbox' array
        [x, y, width, height] = detection.bbox;

        // Use the class name as the label for object detections
        label = detection.class;
    }

    // Calculate the scaling factors
    const scaleX = video.videoWidth / canvas.width;
    const scaleY = video.videoHeight / canvas.height;

    //if click show alert
    if (isClicked) {
        if (clickPos.x >= x*scaleX && clickPos.x <= x*scaleX + width*scaleX && 
            clickPos.y >= y*scaleY && clickPos.y <= y*scaleY + height*scaleY) {
            const randomDescription = info.descriptions[Math.floor(Math.random() * info.descriptions.length)];
            alert(`${label}: ${randomDescription}`);
            isClicked = false;
        }
    }

    // Create a temporary canvas for the detection area
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = width;
    tempCanvas.height = height;
    const tempCtx = tempCanvas.getContext('2d');
    tempCtx.filter = type === 'face' ? "grayscale(90%)blur(3px)" : "brightness(200%)";

    // Draw the detection area onto the temporary canvas, applying the scaling
    tempCtx.drawImage(
        video,
        x * scaleX,
        y * scaleY,
        width * scaleX,
        height * scaleY,
        0,
        0,
        width,
        height
    );

    // Draw the filtered area back onto the main canvas
    ctx.drawImage(tempCanvas, x, y);

    // Draw bounding box
    ctx.strokeStyle = info.color;
    ctx.lineWidth = 2;
    ctx.strokeRect(x, y, width, height);

    // Draw label above the box
    ctx.fillStyle = info.color;
    ctx.font = '16px Arial';
    ctx.fillText(label, x, y - 5);

    // Store the detection in the detectedObjects array
    detectedObjects.push({
        type: type,
        boundingBox: { x, y, width, height },
        label: label,
        descriptions: info.descriptions
    });
}

function drawObjectDetections(detections) {
    detections.forEach(detection => {
        const objectInfo = getObjectData(detection.class);
        if (objectInfo) {
            drawDetection(detection, objectInfo, 'object');
        }
    });
}

function drawGenderDetection(detections) {
    detections.forEach(detection => {
        const { age, gender } = detection;
        let ageGroup;
        if (age < 18) ageGroup = 'child';
        else if (age >= 18 && age <= 50) ageGroup = 'adult';
        else ageGroup = 'senior';

        const identifier = `${gender.toLowerCase()}-${ageGroup}`;
        const faceInfo = getObjectData(identifier);

        if (faceInfo) {
            drawDetection(detection, faceInfo, 'face');
        }
    });
}

let clickPos = {};
// Update handleCanvasClick function to work with bounding boxes
function handleCanvasInteraction(event) {
    event.preventDefault(); // Prevent default behavior for touch events
    
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    
    let clientX, clientY;
    
    if (event.type === 'touchstart') {
        // Touch event
        clientX = event.touches[0].clientX;
        clientY = event.touches[0].clientY;
    } else {
        // Mouse event
        clientX = event.clientX;
        clientY = event.clientY;
    }
    
    clickPos.x = (clientX - rect.left) * scaleX;
    clickPos.y = (clientY - rect.top) * scaleY;
    
    isClicked = true;
    setTimeout(() => {
        isClicked = false;
    }, 1000);
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



    // Get the existing canvas element from the HTML
    canvas = document.getElementById('canvas')
    canvas.filter = "brightness(80%)";
    // Resize canvas to match video dimensions
    resizeCanvas();
    // Get the 2D rendering context for the canvas
    ctx = canvas.getContext('2d', { willReadFrequently: true })

    // Set canvas size to match the window size
    function resizeCanvas() {
        if (!canvas) return;
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
    }

    // Call resizeCanvas initially and add event listener for window resize
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    // Add click event listener to the canvas
    canvas.addEventListener('mousedown', handleCanvasInteraction);
    canvas.addEventListener('touchstart', handleCanvasInteraction);

    // Start the face detection process
    detectFrame()
}

// Call the main function to start the application
run()