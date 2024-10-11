// Declare variables that will be used across functions
let video, cocoSsdModel;
let detectedObjects = []; // Array to store detected objects and faces
let objectData; // Variable to store the loaded JSON data

function preload() {
  // Load the JSON data
  objectData = loadJSON('JSON/Objects.json');
}

function setup() {
  createCanvas(windowWidth, windowHeight);
  
  // Create a video element to display the camera feed
  video = createCapture(VIDEO);
  video.size(width, height);
  video.hide(); // Hide the video element
  
  // Load required face-api.js models
  Promise.all([
    faceapi.nets.ssdMobilenetv1.loadFromUri('./models'),
    faceapi.nets.faceLandmark68Net.loadFromUri('./models'),
    faceapi.nets.faceRecognitionNet.loadFromUri('./models'),
    faceapi.nets.ageGenderNet.loadFromUri('./models'),
  ]).then(startDetection);
  
  // Load COCO-SSD model
  cocoSsd.load().then(model => {
    cocoSsdModel = model;
  }).catch(error => {
    console.error('Failed to load COCO-SSD model:', error);
    cocoSsdModel = null;
  });
}

function draw() {
  // Clear the canvas before drawing new results
  clear();

  // Draw the video feed on the canvas
  image(video, 0, 0, width, height);

  // Detect and draw objects
  if (cocoSsdModel) {
    cocoSsdModel.detect(video.elt).then(objectDetections => {
      drawObjectDetections(objectDetections);
    });
  }

  // Detect and draw faces
  faceapi.detectAllFaces(video.elt)
    .withFaceLandmarks()
    .withFaceDescriptors()
    .withAgeAndGender()
    .then(faceAIData => {
      const resizedResults = faceapi.resizeResults(faceAIData, { width, height });
      drawGenderDetection(resizedResults);
    });
}

function startDetection() {
  detectFrame();
}

// Function to get object data by identifier
function getObjectData(identifier) {
  return objectData.find(obj => obj.identifier === identifier);
}

// Function to detect faces and provide results
async function detectFrame() {   
  // Detect faces, landmarks, descriptors, age, and gender from the video feed
  const faceAIData = await faceapi.detectAllFaces(video.elt).withFaceLandmarks().withFaceDescriptors().withAgeAndGender()
  
  // Clear the canvas before drawing new results
  clear();

  // Draw the video feed on the canvas
  image(video, 0, 0, width, height);

  // Detect objects
  if (cocoSsdModel) {
    const objectDetections = await cocoSsdModel.detect(video.elt);
    const resizedObjectDetections = resizeDetections(objectDetections, { width, height });
    drawObjectDetections(resizedObjectDetections);
  }

  // Detect faces
  const resizedResults = faceapi.resizeResults(faceAIData, { width, height })
  drawGenderDetection(resizedResults)

  // Request the next animation frame to continue detection
  requestAnimationFrame(detectFrame)
}

// ... (keep the resizeDetections, drawObjectDetections, and drawCustomDetections functions as they are)

function mousePressed() {
  handleCanvasClick(mouseX, mouseY);
}

function handleCanvasClick(x, y) {
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

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
}

// Update drawObjectDetections to handle resizing internally
function drawObjectDetections(detections) {
  for (let i = 0; i < detections.length; i++) {
    const object = detections[i];
    const [x, y, objectWidth, objectHeight] = object.bbox;
    
    // Resize the bounding box to match the canvas size
    const resizedX = x * width / video.width;
    const resizedY = y * height / video.height;
    const resizedWidth = objectWidth * width / video.width;
    const resizedHeight = objectHeight * height / video.height;

    // Draw bounding box
    noFill();
    stroke(0, 255, 0);
    strokeWeight(2);
    rect(resizedX, resizedY, resizedWidth, resizedHeight);

    // Draw label
    fill(0, 255, 0);
    noStroke();
    textSize(16);
    text(object.class, resizedX, resizedY - 5);

    // Store detected object for interaction
    const centerX = resizedX + resizedWidth / 2;
    const centerY = resizedY + resizedHeight / 2;
    const radius = Math.max(resizedWidth, resizedHeight) / 2;
    detectedObjects.push({
      label: object.class,
      center: [centerX, centerY],
      radius: radius,
      descriptions: getObjectData(object.class)?.descriptions || ["No description available"]
    });
  }
}