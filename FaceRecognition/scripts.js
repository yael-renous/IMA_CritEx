// Declare variables that will be used across functions
let video, canvas, ctx, cocoSsdModel;


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


    // Resize the detection results to match the canvas size
    const resizedResults = faceapi.resizeResults(faceAIData, { width: canvas.width, height: canvas.height })

    // Custom drawing function (you'll implement this)
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
        const label = `${detection.class} (${Math.round(detection.score * 100)}%)`;

        // Draw detection box
        ctx.strokeStyle = '#ff0000' // Red color for object boxes
        ctx.lineWidth = 2
        ctx.strokeRect(x, y, width, height);

        // Draw label background
        ctx.fillStyle = 'rgba(255, 0, 0, 0.7)'
        ctx.fillRect(x, y - 30, ctx.measureText(label).width + 10, 30)

        // Draw label text
        ctx.fillStyle = '#fff'
        ctx.font = '12px Arial'
        ctx.fillText(label, x + 5, y - 10)
    });
}

// Custom function to draw face detection boxes and information
function drawCustomDetections(detections) {
    detections.forEach(detection => {
        const { age, gender, genderProbability, detection: faceDetection } = detection
        const { box } = faceDetection

        // Draw detection box
        ctx.strokeStyle = '#00ff00' // Green color for the box
        ctx.lineWidth = 2
        ctx.strokeRect(box.x, box.y, box.width, box.height);

        // Prepare text to display
        const genderText = `${gender} (${(genderProbability * 100).toFixed(1)}%)`
        const ageText = `Age: ${Math.round(age)}`

        // Draw text background
        ctx.fillStyle = 'rgba(0, 0, 0, 0.7)'
        ctx.fillRect(box.x, box.y - 30, box.width, 30)

        // Draw text
        ctx.fillStyle = '#fff'
        ctx.font = '12px Arial'
        ctx.fillText(genderText, box.x + 5, box.y - 15)
        ctx.fillText(ageText, box.x + 5, box.y - 3)
    })
}

// Main function to run the facial detection
const run = async () => {
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

    // Start the face detection process
    detectFrame()
}

// Call the main function to start the application
run()