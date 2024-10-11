async function getLocation() {
    return new Promise((resolve, reject) => {
        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(resolve, reject);
        } else {
            reject(new Error("Geolocation not supported"));
        }
    });
}

async function showPosition(position) {
    const { latitude, longitude } = position.coords;
    
    try {
        // Use OpenStreetMap's Nominatim service for reverse geocoding
        const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}`);
        const data = await response.json();
        if (data.address) {
            const city = data.address.city || data.address.town || data.address.village || 'Unknown City';
            updateCityHeader(city);
        } else {
            updateCityHeader("City not found");
        }
    } catch (error) {
        console.error("Error fetching location details:", error);
        updateCityHeader("Error fetching city");
    }
}

async function displayLocation() {
    try {
        const position = await getLocation();
        await showPosition(position);
    } catch (error) {
        showError(error);
    }
}

function updateCityHeader(message) {
    const cityHeader = document.getElementById('cityHeader');
    cityHeader.textContent = message.toUpperCase() + " CITY TOUR";
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

window.onload = displayLocation;
