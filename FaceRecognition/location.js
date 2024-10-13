// Global variable to store the current city
let currentCity = null;

async function getLocation() {
    return new Promise((resolve, reject) => {
        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(resolve, reject);
        } else {
            reject(new Error("Geolocation not supported"));
        }
    });
}

async function fetchCity(latitude, longitude) {
    try {
        const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}`);
        const data = await response.json();
        if (data.address) {
            return data.address.city || data.address.town || data.address.village || 'Unknown City';
        } else {
            return "City not found";
        }
    } catch (error) {
        console.error("Error fetching location details:", error);
        return "Error fetching city";
    }
}

async function initializeCity() {
    try {
        const position = await getLocation();
        const { latitude, longitude } = position.coords;
        currentCity = await fetchCity(latitude, longitude);
        updateCityHeader(currentCity);
    } catch (error) {
        showError(error);
    }
}

function getCity() {
    return currentCity;
}

function updateCityHeader(message) {
    const cityHeader = document.querySelector('.cityName');
    if (cityHeader) {
        cityHeader.textContent = message;
    } else {
        console.warn("Element with class 'cityName' not found");
    }
}

function showError(error) {
    switch(error.code) {
        case error.PERMISSION_DENIED:
            updateCityHeader("User denied geolocation");
            break;
        case error.POSITION_UNAVAILABLE:
            updateCityHeader("Location information unavailable");
            break;
        case error.TIMEOUT:
            updateCityHeader("Request for location timed out");
            break;
        case error.UNKNOWN_ERROR:
            updateCityHeader("An unknown error occurred");
            break;
    }
}

// Change the window.onload to use the new initializeCity function
window.onload = initializeCity;
