// Declare variables that will be used across functions
let video, canvas, ctx, cocoSsdModel;
let objectData; // Variable to store the loaded JSON data
let isClicked = false;

let guideElement;
let loadingElement;

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
    try {
        // Check if video is ready
        if (video.readyState !== 4) {
            requestAnimationFrame(detectFrame);
            return;
        }

        const faceAIData = await faceapi.detectAllFaces(video).withFaceLandmarks().withFaceDescriptors().withAgeAndGender()

        // Clear the canvas before drawing new results
        ctx.clearRect(0, 0, canvas.width, canvas.height)

        // Detect objects
        if (cocoSsdModel) {
            const objectDetections = await cocoSsdModel.detect(video);
            const resizedObjectDetections = resizeDetections(objectDetections, { width: canvas.width, height: canvas.height });
            drawObjectDetections(resizedObjectDetections);
        }

        // Resize face detections to match canvas size
        const resizedResults = faceapi.resizeResults(faceAIData, { width: canvas.width, height: canvas.height })

        // Track faces between frames
        trackFaces(resizedResults);

        drawGenderDetection(resizedResults)
    } catch (error) {
        console.error('Error in detectFrame:', error);
    }
    // Request the next animation frame to continue face detection
    requestAnimationFrame(detectFrame)
}

function trackFaces(currentDetections) {
    console.log('trackFaces called with', currentDetections.length, 'detections');
    currentDetections.forEach(detection => {
        const matchingPrevious = previousFaceDetections.find(prev =>
            isSameFace(prev, detection)
        );

        if (matchingPrevious) {
            // This is likely the same face
            detection.id = matchingPrevious.id;
            detection.label = matchingPrevious.label; // Preserve the label
        } else {
            // This is a new face
            detection.id = generateUniqueId();
            // The label will be generated in drawDetection
        }
    });

    // Update previous detections for the next frame
    previousFaceDetections = currentDetections;
}

function isSameFace(prev, current) {
    // Check if the gender is the same
    if (prev.gender !== current.gender) {
        return false;
    }

    // Use face descriptor distance as a similarity metric
    const distance = faceapi.euclideanDistance(prev.descriptor, current.descriptor);
    return distance < 0.6; // Adjust threshold as needed
}

function generateUniqueId() {
    return Math.random().toString(36).substr(2, 9);
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
    console.log('drawDetection called for', type, 'with label:', info.identifier);
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

        // Increase the size of the face bounding box
        const scaleFactor = 3; // Adjust this value to make the box bigger or smaller
        const widthIncrease = (width * scaleFactor - width) / 2;
        const heightIncrease = (height * scaleFactor - height) / 2;

        x -= widthIncrease;
        y -= (heightIncrease / 2);
        width *= scaleFactor;
        height *= scaleFactor;

        // Use the tracked label if available, otherwise generate a new one
        if (!detection.label) {
            const randomItem = info.descriptions[Math.floor(Math.random() * info.descriptions.length)];
            detection.label = randomItem[0]; // Assuming the first element is the label
        }
        label = detection.label;
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
        if (clickPos.x >= x * scaleX && clickPos.x <= x * scaleX + width * scaleX &&
            clickPos.y >= y * scaleY && clickPos.y <= y * scaleY + height * scaleY) {
            displayDescription(label, info);
            isClicked = false;
        }
    }

    // Apply filter only for female faces
    if (type === 'face' && detection.gender === 'female') {
        // Create a temporary canvas for the detection area
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = width;
        tempCanvas.height = height;
        // tempCanvas.filter="grayscale(100%)";
        const tempCtx = tempCanvas.getContext('2d', { willReadFrequently: true });

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

        // Create pixelation effect
        const pixelSize = 7; // Adjust this value to change the pixelation level
        for (let y = 0; y < height; y += pixelSize) {
            for (let x = 0; x < width; x += pixelSize) {
                const pixelData = tempCtx.getImageData(x, y, 1, 1).data;
                // tempCtx.fillStyle = `rgba(${pixelData[0]}, ${pixelData[1]}, ${pixelData[2]}, ${pixelData[3] / 255})`;
                // Convert to grayscale
                const grayValue = Math.round(0.299 * pixelData[0] + 0.587 * pixelData[1] + 0.114 * pixelData[2]);
                tempCtx.fillStyle = `rgba(${grayValue}, ${grayValue}, ${grayValue}, ${pixelData[3] / 255})`;
                tempCtx.fillRect(x, y, pixelSize, pixelSize);
            }
        }

        // Draw the pixelated area back onto the main canvas
        ctx.drawImage(tempCanvas, x, y);
    }

    // Draw bounding box for all detections
    ctx.strokeStyle = info.color;
    ctx.lineWidth = 2;
    ctx.strokeRect(x, y, width, height);

    // Add fill with alpha, but not for female faces
    if (!(type === 'face' && detection.gender === 'female')) {
        ctx.fillStyle = `${info.color}33`; // 33 is 20% opacity in hex
        ctx.fillRect(x, y, width, height);
    }

    // Draw label background
    ctx.fillStyle = info.color;
    const labelWidth = ctx.measureText(label).width + 10; // Add some padding
    const labelHeight = 20; // Adjust as needed
    ctx.fillRect(x, y - labelHeight, labelWidth, labelHeight);

    // Draw label text
    ctx.fillStyle = 'white';
    ctx.font = '16px Arial';
    ctx.fillText(label, x + 5, y - 5);
}

function drawObjectDetections(detections) {
    console.log('drawObjectDetections called with', detections.length, 'detections');
    detections.forEach(detection => {
        const objectInfo = getObjectData(detection.class);
        if (objectInfo) {
            console.log('Drawing object:', detection.class);
            drawDetection(detection, objectInfo, 'object');
        } else {
            console.log('No object info found for:', detection.class);
        }
    });
}

function drawGenderDetection(detections) {
    console.log('drawGenderDetection called with', detections.length, 'detections');
    detections.forEach(detection => {
        const { age, gender } = detection;
        const faceInfo = getObjectData(gender.toLowerCase());

        if (faceInfo) {
            console.log('Drawing face:', gender, 'Age:', age);
            drawDetection(detection, faceInfo, 'face');
        } else {
            console.log('No face info found for:', gender);
        }
    });
}

let clickPos = {};
let previousFaceDetections = [];

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
    console.log('Starting run function');

    // Load JSON data
    console.log('Loading JSON data...');
    await loadObjectData();
    console.log('JSON data loaded successfully');

    // Load required face-api.js models
    console.log('Loading face-api.js models...');
    await Promise.all([
        faceapi.nets.ssdMobilenetv1.loadFromUri('./models'),
        faceapi.nets.faceLandmark68Net.loadFromUri('./models'),
        faceapi.nets.faceRecognitionNet.loadFromUri('./models'),
        faceapi.nets.ageGenderNet.loadFromUri('./models'),
    ]);
    console.log('face-api.js models loaded successfully');

    // Load COCO-SSD model
    console.log('Loading COCO-SSD model...');
    try {
        cocoSsdModel = await cocoSsd.load();
        console.log('COCO-SSD model loaded successfully');
    } catch (error) {
        console.error('Failed to load COCO-SSD model:', error);
        cocoSsdModel = null;
    }

    // Create a video element to display the camera feed
    console.log('Setting up video element...');
    video = document.createElement('video');
    video.id = 'video';
    video.setAttribute('autoplay', '');
    video.setAttribute('muted', '');
    video.setAttribute('playsinline', '')
    document.body.appendChild(video);

    console.log('Attempting to access camera...');
    try {
        const constraints = {
            video: {
                audio:false,
                facingMode: "environment" 
            }
        };

      navigator.mediaDevices.getUserMedia(constraints).then(function success(stream) {
            video.srcObject = stream;
          });
        // video.srcObject = stream;

        // // Wait for the video to be ready
        // await new Promise((resolve) => {
        //     video.onloadedmetadata = () => {
        //         resolve();
        //     };
        // });

        // Attempt to play the video
        // try {
        //     await video.play();
        // } catch (playError) {
        //     console.warn('Failed to start the camera stream:', playError);
            // // Create a retry button
            // const retryButton = document.createElement('button');
            // retryButton.textContent = 'Retry Camera Access';
            // retryButton.onclick = async () => {
            //     try {
            //         await video.play();
            //         retryButton.remove();
            //     } catch (retryError) {
            //         console.error('Failed to start camera on retry:', retryError);
            //         alert('Unable to access the camera. Please check your camera permissions and try again.');
            //     }
            // };
            // document.body.appendChild(retryButton);
        // }
    } catch (error) {
        console.error('Error accessing camera:', error);
        alert('Unable to access the camera. Please ensure you have given permission and try again.');
    }

    //-------For uploading prerecording ----

    // // Set the source of the video
    // video.src = 'Untitled.mp4'; // Replace with your video file path
    // video.loop = true; // Optional: loop the video

    //-----------------------------


    loadingElement = document.getElementById('loading')
    guideElement = document.getElementById('guide');
    // Get the existing canvas element from the HTML
    canvas = document.getElementById('canvas')
    // canvas.filter = "brightness(80%)";
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

    // Remove loading element after everything is loaded
    removeLoadingElement();
    setTimeout(() => {
        playGuide("instructions.mp4");
    }, 8000);

    console.log('Setup complete, starting face detection');
    // Start the face detection process
    detectFrame();
}

function removeLoadingElement() {
    ;
    if (loadingElement) {
        loadingElement.style.display = 'none';
    }
}

function playGuide(filename) {
    console.log(filename);
    let videosrc = `./Videos/${filename}`;
    console.log(videosrc);
    if (videosrc) {
        guideElement.src = videosrc;
        guideElement.setAttribute('muted', '');
        guideElement.setAttribute('playsinline', '')
        guideElement.play();
    }
}

function displayDescription(label, info) {
    // Remove existing popup if present
    const existingPopup = document.querySelector('.description-popup');
    if (existingPopup) {
        existingPopup.remove();
    }

    let descriptionIndex = Math.floor(Math.random() * info.descriptions.length);
    const randomDescription = info.descriptions[descriptionIndex][1];

    // Create new popup element
    const popup = document.createElement('div');
    popup.className = 'description-popup';
    popup.innerHTML = `
        <span class="close-btn">&times;</span>
        <strong>${label}:</strong> ${randomDescription}
    `;

    // Add popup to the body
    document.body.appendChild(popup);
    console.log(info.descriptions[descriptionIndex]);
    playGuide(info.descriptions[descriptionIndex][2]);

    // Close button functionality
    const closeBtn = popup.querySelector('.close-btn');
    closeBtn.addEventListener('click', () => {
        popup.remove();
    });

    // Remove popup after 5 seconds if not closed manually
    setTimeout(() => {
        if (document.body.contains(popup)) {
            popup.remove();
        }
    }, 10000);
}

// Call run when the DOM is loaded
document.addEventListener('DOMContentLoaded', run);