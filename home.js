// Global variables - using window scope for better access
window.map = null;
window.userMarker = null;
window.markersLayer = null;
window.searchCircle = null;
window.userLocation = null;
window.watchId = null;
window.accuracyCircle = null;
window.positionHistory = [];
window.lastUpdateTime = null;
window.autoCenter = true;

// Foursquare API Key - In production, this should be handled server-side
const FOURSQUARE_API_KEY = 'fsq336jjzkttikrUNPGCg7pF9W5q6/at1MLNnObTbe/tMWU=';

// Initialize when DOM is fully loaded
document.addEventListener('DOMContentLoaded', function() {
    console.log('DOM fully loaded');
    
    // Initialize map
    try {
        initMap();
        console.log('Map initialized successfully');
    } catch (error) {
        console.error('Error initializing map:', error);
        showNotification('Error initializing map. Please refresh the page.', 'error');
    }
    
    // Load favorites
    try {
        loadFavorites();
        console.log('Favorites loaded successfully');
    } catch (error) {
        console.error('Error loading favorites:', error);
    }
    
    // Set up mobile menu toggle
    setupMobileMenuToggle();
    
    // Add window resize handler for map
    window.addEventListener('resize', function() {
        if (window.map) {
            window.map.invalidateSize();
        }
    });
});

function saveUserCoordinates(lat, lng, accuracy) {
    try {
      const locationData = {
        lat: lat,
        lng: lng,
        accuracy: accuracy || 0,
        timestamp: Date.now()
      };
      localStorage.setItem('cafeFinderUserCoordinates', JSON.stringify(locationData));
      console.log(`User coordinates saved: ${lat}, ${lng}`);
    } catch (error) {
      console.error("Error saving user coordinates:", error);
    }
}

// Get saved coordinates
function getSavedCoordinates() {
    try {
      const data = localStorage.getItem('cafeFinderUserCoordinates');
      if (!data) return null;
      
      const locationData = JSON.parse(data);
      // Check if coordinates are still fresh (last 30 minutes)
      if (Date.now() - locationData.timestamp > 30 * 60 * 1000) {
        console.log("Saved coordinates are too old, requesting fresh location");
        return null;
      }
      
      return {
        lat: locationData.lat,
        lng: locationData.lng,
        accuracy: locationData.accuracy
      };
    } catch (error) {
      console.error("Error retrieving saved coordinates:", error);
      return null;
    }
}

// Store the user's last known location in localStorage
function storeUserLocation(lat, lng, accuracy) {
    const locationData = {
        lat: lat,
        lng: lng,
        accuracy: accuracy,
        timestamp: new Date().getTime() // Store timestamp for freshness check
    };
    
    localStorage.setItem('cafeFinderUserLocation', JSON.stringify(locationData));
}

// Retrieve the user's last known location from localStorage
function getStoredUserLocation() {
    const locationJson = localStorage.getItem('cafeFinderUserLocation');
    if (!locationJson) return null;
    
    try {
        const locationData = JSON.parse(locationJson);
        const now = new Date().getTime();
        
        // Check if the stored location is fresh enough (less than 30 minutes old)
        if (now - locationData.timestamp < 30 * 60 * 1000) {
            return [locationData.lat, locationData.lng];
        }
    } catch (e) {
        console.error("Error parsing stored location:", e);
    }
    
    return null;
}

// Setup mobile menu toggle
function setupMobileMenuToggle() {
    const menuToggle = document.querySelector('.menu-toggle');
    const nav = document.querySelector('nav');
    
    if (menuToggle && nav) {
        menuToggle.addEventListener('click', function(e) {
            e.stopPropagation();
            nav.classList.toggle('active');
            menuToggle.classList.toggle('active');
        });
    }
    
    // Close menu when clicking outside
    document.addEventListener('click', function(event) {
        const nav = document.querySelector('nav');
        const menuToggle = document.querySelector('.menu-toggle');
        if (nav && menuToggle && !nav.contains(event.target) && !menuToggle.contains(event.target) && nav.classList.contains('active')) {
            nav.classList.remove('active');
            menuToggle.classList.remove('active');
        }
    });
    
    // For mobile: make dropdowns work with tap
    if (window.matchMedia('(max-width: 768px)').matches) {
        const dropdowns = document.querySelectorAll('.dropdown');
        
        dropdowns.forEach(dropdown => {
            const userIcon = dropdown.querySelector('.user-icon');
            const dropdownContent = dropdown.querySelector('.dropdown-content');
            
            if (userIcon && dropdownContent) {
                userIcon.addEventListener('click', function(e) {
                    e.stopPropagation();
                    // Close any open dropdowns
                    document.querySelectorAll('.dropdown-content').forEach(content => {
                        if (content !== dropdownContent) {
                            content.style.display = 'none';
                        }
                    });
                    // Toggle this dropdown
                    dropdownContent.style.display = dropdownContent.style.display === 'block' ? 'none' : 'block';
                });
            }
        });
    }
}

// Initialize the map
function initMap() {
    console.log('Initializing map...');
    
    try {
        // Check if map container exists
        const mapContainer = document.getElementById('map');
        if (!mapContainer) {
            console.error('Map container not found!');
            showNotification('Error: Map container not found!', 'error');
            return;
        }
        
        // Ensure the map container has proper size
        mapContainer.style.width = '100%';
        mapContainer.style.height = '100%';
        
        // Default center - Jakarta, Indonesia
        const defaultLocation = [-6.2088, 106.8456];
        
        // Initialize the map
        window.map = L.map('map', {
            zoomControl: false // We'll add zoom control in a custom position
        }).setView(defaultLocation, 12);
        
        // Add OpenStreetMap tile layer (FREE)
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
            maxZoom: 19
        }).addTo(window.map);
        
        // Add zoom control to the top-right
        L.control.zoom({
            position: 'topright'
        }).addTo(window.map);
        
        // Initialize marker cluster group for better performance with many markers
        window.markersLayer = L.markerClusterGroup({
            disableClusteringAtZoom: 16,
            spiderfyOnMaxZoom: true,
            showCoverageOnHover: false
        });
        
        window.map.addLayer(window.markersLayer);
        
        // Set up event listeners
        setupEventListeners();
        
        // Add location controls
        addLocationButton();
        addTrackingControl();
        addAutoCenterControl(); // Add auto-center toggle
        
        // Force map resize after initialization to ensure proper display
        setTimeout(function() {
            window.map.invalidateSize(true);
        }, 100);
        
        // Use stored location if available and get fresh location
        initializeUserLocation();
    } catch (error) {
        console.error("Error during map initialization:", error);
        showNotification("Could not initialize map: " + error.message, "error");
    }
}

// Improve the location initialization to use stored location first
function initializeUserLocation() {
    // Try to get stored location first
    const storedLocation = getStoredUserLocation();
    
    if (storedLocation) {
        // Use the stored location to immediately show something
        window.userLocation = storedLocation;
        
        // Show on map with estimated accuracy (since we don't store it)
        updateUserLocationOnMap(storedLocation[0], storedLocation[1], 500);
        
        // Still request fresh location, but don't show loading indicator
        getUserLocationHighAccuracy(false);
        
        // Automatically start tracking if we had a recent location
        // This ensures continuous tracking across page reloads
        if (window.trackingControl) {
            setTimeout(() => {
                toggleTracking(window.trackingControl);
            }, 2000); // Short delay to ensure map is fully loaded
        }
    } else {
        // No stored location, request with loading indicator
        getUserLocationHighAccuracy(true);
    }
}

// Set up event listeners
function setupEventListeners() {
    const searchButton = document.getElementById("search-button");
    if (searchButton) {
        searchButton.addEventListener("click", handleSearch);
    }

    const quickSearchButton = document.getElementById("quick-search-button");
    if (quickSearchButton) {
        quickSearchButton.addEventListener("click", handleQuickSearch);
    }
    
    const searchInput = document.getElementById("search-input");
    if (searchInput) {
        searchInput.addEventListener("keypress", function(event) {
            if (event.key === "Enter") {
                event.preventDefault();
                handleQuickSearch();
            }
        });
    }
    
    // Add event listeners for view toggle
    const viewButtons = document.querySelectorAll('.view-btn');
    const resultsContainer = document.getElementById('results-container');

    if (viewButtons.length > 0 && resultsContainer) {
        viewButtons.forEach(button => {
            button.addEventListener('click', function() {
                // Remove active class from all buttons
                viewButtons.forEach(btn => btn.classList.remove('active'));
                
                // Add active class to clicked button
                this.classList.add('active');
                
                // Update view
                const viewType = this.getAttribute('data-view');
                resultsContainer.className = `results-container ${viewType}-view`;
            });
        });
    }
    
    // Add event listener for radius slider
    const radiusSlider = document.getElementById('radius');
    const radiusValue = document.getElementById('radius-value');
    if (radiusSlider && radiusValue) {
        radiusSlider.addEventListener('input', function() {
            radiusValue.textContent = this.value;
        });
    }
}

// Create a custom location button
function addLocationButton() {
    // Create custom control
    const locationControl = L.Control.extend({
        options: {
            position: 'bottomright'
        },
        
        onAdd: function(map) {
            const container = L.DomUtil.create('div', 'leaflet-bar leaflet-control leaflet-control-custom');
            container.style.backgroundColor = 'white';
            container.style.width = '34px';
            container.style.height = '34px';
            container.style.cursor = 'pointer';
            container.style.display = 'flex';
            container.style.alignItems = 'center';
            container.style.justifyContent = 'center';
            container.innerHTML = '<i class="fas fa-location-arrow" style="color: #FF8C00; font-size: 16px;"></i>';
            
            container.title = 'Lokasi Saya (Akurasi Tinggi)';
            
            container.onclick = function() {
                getUserLocationHighAccuracy(true);
            };
            
            return container;
        }
    });
    
    // Add the control to the map
    window.map.addControl(new locationControl());
}

window.isTrackingActive = false;  // Track whether location tracking is active

// Replace the addTrackingControl function with this enhanced version
function addTrackingControl() {
    const TrackingControl = L.Control.extend({
        options: {
            position: 'bottomright'
        },
        
        onAdd: function(map) {
            const container = L.DomUtil.create('div', 'leaflet-bar leaflet-control leaflet-control-custom');
            container.style.backgroundColor = 'white';
            container.style.width = '34px';
            container.style.height = '34px';
            container.style.cursor = 'pointer';
            container.style.display = 'flex';
            container.style.alignItems = 'center';
            container.style.justifyContent = 'center';
            container.title = 'Mulai pelacakan lokasi';
            
            // Initialize with tracking off
            container.setAttribute('data-tracking', 'off');
            container.innerHTML = '<i class="fas fa-crosshairs" style="color: #888; font-size: 16px;"></i>';
            
            // Store reference to control for access from other functions
            window.trackingControl = container;
            
            container.onclick = function() {
                toggleTracking(this);
            };
            
            return container;
        }
    });
    
    // Add the control to the map
    window.map.addControl(new TrackingControl());
}

// New function to toggle tracking from anywhere in the code
function toggleTracking(controlElement) {
    const isTracking = controlElement.getAttribute('data-tracking') === 'on';
    
    if (isTracking) {
        // Stop tracking
        if (window.watchId !== null) {
            navigator.geolocation.clearWatch(window.watchId);
            window.watchId = null;
        }
        controlElement.innerHTML = '<i class="fas fa-crosshairs" style="color: #888; font-size: 16px;"></i>';
        controlElement.setAttribute('data-tracking', 'off');
        controlElement.title = 'Mulai pelacakan lokasi';
        window.isTrackingActive = false;
        showNotification('Pelacakan lokasi dimatikan', 'info');
    } else {
        // Start enhanced tracking
        enhancedLocationTracking();
        controlElement.innerHTML = '<i class="fas fa-crosshairs" style="color: #4285F4; font-size: 16px;"></i>';
        controlElement.setAttribute('data-tracking', 'on');
        controlElement.title = 'Hentikan pelacakan lokasi';
        window.isTrackingActive = true;
        showNotification('Pelacakan lokasi diaktifkan', 'success');
        
        // Center map on user's location if available
        if (window.userLocation) {
            window.map.setView(window.userLocation, window.map.getZoom());
        }
    }
}

// Add auto-center toggle control to the map
function addAutoCenterControl() {
    // Default state is true (auto-center enabled)
    window.autoCenter = true;
    
    const AutoCenterControl = L.Control.extend({
        options: {
            position: 'bottomright'
        },
        
        onAdd: function(map) {
            const container = L.DomUtil.create('div', 'leaflet-bar leaflet-control leaflet-control-custom');
            container.style.backgroundColor = 'white';
            container.style.width = '34px';
            container.style.height = '34px';
            container.style.cursor = 'pointer';
            container.style.display = 'flex';
            container.style.alignItems = 'center';
            container.style.justifyContent = 'center';
            
            // Initialize with auto-center on
            container.innerHTML = '<i class="fas fa-location" style="color: #4285F4; font-size: 16px;"></i>';
            container.title = 'Matikan penjejakan otomatis';
            
            container.onclick = function() {
                // Toggle auto-center
                window.autoCenter = !window.autoCenter;
                
                if (window.autoCenter) {
                    // Auto-center ON
                    this.innerHTML = '<i class="fas fa-location" style="color: #4285F4; font-size: 16px;"></i>';
                    this.title = 'Matikan penjejakan otomatis';
                    
                    // Immediately center on user location if available
                    if (window.userLocation) {
                        window.map.panTo(window.userLocation);
                    }
                    
                    showNotification('Penjejakan otomatis aktif', 'info');
                } else {
                    // Auto-center OFF
                    this.innerHTML = '<i class="fas fa-location" style="color: #888; font-size: 16px;"></i>';
                    this.title = 'Aktifkan penjejakan otomatis';
                    showNotification('Penjejakan otomatis nonaktif', 'info');
                }
            };
            
            return container;
        }
    });
    
    // Add the control to the map
    window.map.addControl(new AutoCenterControl());
}

// Enhanced real-time tracking with speed and heading information
function enhancedLocationTracking() {
    // If we already have a watch in progress, clear it first
    if (window.watchId !== null) {
        navigator.geolocation.clearWatch(window.watchId);
        window.watchId = null;
    }
    
    // Create a position history array to calculate heading and speed
    window.positionHistory = [];
    
    // Options for continuous tracking
    const options = {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0
    };
    
    // Start watching the user's position
    try {
        window.watchId = navigator.geolocation.watchPosition(
            // Success callback
            (position) => {
                const lat = position.coords.latitude;
                const lng = position.coords.longitude;
                const accuracy = position.coords.accuracy;
                const timestamp = position.timestamp;
                const speed = position.coords.speed || 0; // Speed in m/s, if available
                
                console.log(`Tracking update: ${lat}, ${lng} (accuracy: ${accuracy}m)`);
                
                // Store this position in the history (limit to last 5 positions)
                if (window.positionHistory.length >= 5) {
                    window.positionHistory.shift(); // Remove oldest
                }
                window.positionHistory.push({
                    lat, lng, accuracy, timestamp, speed
                });
                
                // Calculate heading from last two positions if available
                let heading = null;
                if (window.positionHistory.length >= 2) {
                    const current = window.positionHistory[window.positionHistory.length - 1];
                    const previous = window.positionHistory[window.positionHistory.length - 2];
                    
                    heading = calculateHeading(
                        previous.lat, previous.lng, 
                        current.lat, current.lng
                    );
                }
                
                // Calculate smoothed speed from history
                const calculatedSpeed = calculateAverageSpeed(window.positionHistory);
                
                // Only update if we have a significant position change or it's been a while
                let shouldUpdate = true;
                
                if (window.userLocation) {
                    const currentDistance = calculateDistance(
                        window.userLocation[0], window.userLocation[1], 
                        lat, lng
                    ) * 1000; // Convert km to meters
                    
                    // For very small movements, only update if accuracy is good
                    if (currentDistance < 5 && accuracy > 20) {
                        shouldUpdate = false;
                    }
                    
                    // If we haven't moved much but it's been 10+ seconds since last update
                    if (!shouldUpdate && window.lastUpdateTime) {
                        const timeSinceUpdate = Date.now() - window.lastUpdateTime;
                        if (timeSinceUpdate > 10000) { // 10 seconds
                            shouldUpdate = true;
                        }
                    }
                }
                
                if (shouldUpdate) {
                    // Record update time
                    window.lastUpdateTime = Date.now();
                    
                    // Update stored location
                    window.userLocation = [lat, lng];
                    storeUserLocation(lat, lng, accuracy);
                    
                    // Update marker on map with enhanced information
                    updateUserLocationOnMap(lat, lng, accuracy, {
                        heading: heading,
                        speed: calculatedSpeed || speed
                    });
                    
                    // Center map on user if tracking is active and auto-center is enabled
                    if (window.isTrackingActive && window.autoCenter) {
                        window.map.panTo([lat, lng]);
                    }
                }
            },
            // Error callback
            (error) => {
                console.error("Location tracking error:", error.message);
                
                // If this is a permission error, update the tracking button
                if (error.code === 1 && window.trackingControl) {
                    window.trackingControl.innerHTML = '<i class="fas fa-crosshairs" style="color: #888; font-size: 16px;"></i>';
                    window.trackingControl.setAttribute('data-tracking', 'off');
                    window.trackingControl.title = 'Mulai pelacakan lokasi';
                    window.isTrackingActive = false;
                    showNotification('Akses lokasi ditolak', 'error');
                }
            },
            // Options
            options
        );
        
        // If watchId is null after the call, something went wrong
        if (!window.watchId) {
            throw new Error("Failed to start location tracking");
        }
        
    } catch (error) {
        console.error("Error starting location tracking:", error);
        showNotification("Gagal memulai pelacakan lokasi", "error");
        
        // Reset tracking state
        if (window.trackingControl) {
            window.trackingControl.innerHTML = '<i class="fas fa-crosshairs" style="color: #888; font-size: 16px;"></i>';
            window.trackingControl.setAttribute('data-tracking', 'off');
            window.trackingControl.title = 'Mulai pelacakan lokasi';
        }
        window.isTrackingActive = false;
    }
}

// Calculate heading (bearing) between two points
function calculateHeading(lat1, lon1, lat2, lon2) {
    // Convert to radians
    const φ1 = lat1 * Math.PI / 180;
    const φ2 = lat2 * Math.PI / 180;
    const λ1 = lon1 * Math.PI / 180;
    const λ2 = lon2 * Math.PI / 180;
    
    // Calculate heading
    const y = Math.sin(λ2 - λ1) * Math.cos(φ2);
    const x = Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(λ2 - λ1);
    const θ = Math.atan2(y, x);
    
    // Convert to degrees
    let heading = (θ * 180 / Math.PI + 360) % 360;
    
    return heading;
}

// Calculate average speed from position history
function calculateAverageSpeed(positions) {
    if (positions.length < 2) return 0;
    
    // Get oldest and most recent positions
    const oldest = positions[0];
    const latest = positions[positions.length - 1];
    
    // Calculate total distance
    const distance = calculateDistance(
        oldest.lat, oldest.lng,
        latest.lat, latest.lng
    ) * 1000; // Convert km to meters
    
    // Calculate time difference in seconds
    const timeDiff = (latest.timestamp - oldest.timestamp) / 1000;
    
    // Calculate speed (m/s)
    if (timeDiff > 0) {
        return distance / timeDiff;
    }
    
    return 0;
}

// Modify getUserLocationHighAccuracy to accept a showLoading parameter
function getUserLocationHighAccuracy(showLoadingIndicator = true) {
    // Check if we already have stored location permission status
    const permissionStatus = localStorage.getItem('locationPermissionStatus');
    
    // If permission was denied previously, don't show loading and just use default location
    if (permissionStatus === 'denied') {
      console.log('Location permission was previously denied');
      showNotification('Akses lokasi telah ditolak sebelumnya. Gunakan menu pengaturan browser untuk mengizinkan lokasi.', 'warning');
      
      // Use default location (Jakarta)
      if (window.searchCircle && !window.userLocation) {
        searchFoursquare([-6.2088, 106.8456], 'cafe');
      }
      return;
    }
    
    // Check if we have a recent saved location we can use immediately
    const savedCoords = getSavedCoordinates();
    if (savedCoords) {
      console.log(`Using saved coordinates: ${savedCoords.lat}, ${savedCoords.lng}`);
      
      // Update location immediately from saved coordinates
      window.userLocation = [savedCoords.lat, savedCoords.lng];
      updateUserLocationOnMap(savedCoords.lat, savedCoords.lng, savedCoords.accuracy || 500);
      
      // We'll still try to get a fresh location in the background, but without loading indicator
      showLoadingIndicator = false;
    }
    
    if (showLoadingIndicator) {
      showLoading('Mencari lokasi Anda dengan akurasi tinggi...');
    }
    
    // Clear any existing geolocation watch
    if (window.watchId !== null) {
      navigator.geolocation.clearWatch(window.watchId);
      window.watchId = null;
    }
    
    if (navigator.geolocation) {
      // Options for high accuracy
      const options = {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 0
      };
      
      // Start watching position with continuous updates
      window.watchId = navigator.geolocation.watchPosition(
        // Success callback - store permission status
        function(position) {
          localStorage.setItem('locationPermissionStatus', 'granted');
          handlePositionSuccess(position);
        },
        // Error callback - store denied status if that's the reason
        function(error) {
          if (error.code === 1) { // Permission denied
            localStorage.setItem('locationPermissionStatus', 'denied');
          }
          handlePositionError(error);
        },
        options
      );
      
      // Also get a one-time position immediately
      navigator.geolocation.getCurrentPosition(
        function(position) {
          localStorage.setItem('locationPermissionStatus', 'granted');
          handlePositionSuccess(position);
        },
        function(error) {
          if (error.code === 1) { // Permission denied
            localStorage.setItem('locationPermissionStatus', 'denied');
          }
          handlePositionError(error);
        },
        options
      );
    } else {
      // Browser doesn't support Geolocation
      handlePositionError({
        code: 0,
        message: "Geolocation not supported by this browser"
      });
    }
}

function handlePositionSuccess(position) {
    // Parse coordinates from position
    const lat = position.coords.latitude;
    const lng = position.coords.longitude;
    const accuracy = position.coords.accuracy; // Accuracy in meters
    
    console.log(`Location received: ${lat}, ${lng} (accuracy: ${accuracy}m)`);
    
    // Only update if accuracy is reasonable (under 1000 meters)
    // This prevents using very inaccurate locations
    if (accuracy > 1000) {
      console.warn(`Low accuracy location detected (${accuracy}m), waiting for better signal...`);
      // Don't hide loading, keep waiting for better accuracy
      return;
    }
    
    // Save coordinates to localStorage for persistence
    saveUserCoordinates(lat, lng, accuracy);
    
    // Store user location for current session
    window.userLocation = [lat, lng];
    
    // Update map and marker
    updateUserLocationOnMap(lat, lng, accuracy);
    
    // Hide loading indicator
    hideLoading();
    
    // Only search for cafes when we first get location
    // This prevents multiple searches when position updates
    if (!window.searchCircle) {
      searchFoursquare(window.userLocation, 'cafe');
    }
  }

function handlePositionError(error) {
    console.error("Error getting location:", error.message);
    
    let errorMessage = "Gagal mendapatkan lokasi Anda.";
    
    switch(error.code) {
        case 1:
            errorMessage = "Akses lokasi ditolak. Mohon izinkan akses lokasi di pengaturan browser Anda.";
            break;
        case 2:
            errorMessage = "Lokasi tidak tersedia. Pastikan GPS Anda aktif dan coba lagi.";
            break;
        case 3:
            errorMessage = "Waktu pencarian lokasi habis. Coba lagi.";
            break;
    }
    
    showNotification(errorMessage, 'error');
    hideLoading();
    
    // Just use default location (Jakarta)
    searchFoursquare([-6.2088, 106.8456], 'cafe');
}

// Enhanced marker update with heading and speed
function updateUserLocationOnMap(lat, lng, accuracy, extras = {}) {
    if (!window.map) {
        console.error("Map not initialized in updateUserLocationOnMap");
        return;
    }
    
    // Set default zoom only if map is at default zoom level (don't override user zooming)
    const currentZoom = window.map.getZoom();
    const defaultZoom = 15;
    
    // Only set the view if tracking is enabled or we don't have a marker yet
    if (window.autoCenter || !window.userMarker) {
        if (currentZoom < defaultZoom) {
            window.map.setView([lat, lng], defaultZoom);
        } else {
            window.map.panTo([lat, lng]);
        }
    }
    
    // Clear any existing user marker
    if (window.userMarker) {
        window.map.removeLayer(window.userMarker);
    }
    
    // Clear any existing accuracy circle
    if (window.accuracyCircle) {
        window.map.removeLayer(window.accuracyCircle);
    }
    
    // Create accuracy circle
    window.accuracyCircle = L.circle([lat, lng], {
        radius: accuracy,  // Use the accuracy value in meters
        color: '#4285F4',
        fillColor: '#4285F4',
        fillOpacity: 0.15,
        weight: 1
    }).addTo(window.map);
    
    // Create HTML for the location marker including optional heading indicator
    let markerHtml = `
        <div style="
            background-color: #4285F4;
            width: 16px;
            height: 16px;
            border-radius: 50%;
            border: 3px solid white;
            box-shadow: 0 0 10px rgba(0, 0, 0, 0.5);
        "></div>
        <div style="
            background-color: rgba(66, 133, 244, 0.3);
            width: 40px;
            height: 40px;
            border-radius: 50%;
            position: absolute;
            top: -15px;
            left: -15px;
            animation: pulse 2s infinite;
        "></div>
    `;
    
    // Add heading indicator if available
    if (extras.heading !== null && extras.heading !== undefined) {
        markerHtml += `
            <div style="
                position: absolute;
                width: 0; 
                height: 0;
                top: -30px;
                left: 0;
                border-left: 8px solid transparent;
                border-right: 8px solid transparent;
                border-bottom: 16px solid #4285F4;
                transform: rotate(${extras.heading}deg);
                transform-origin: center 24px;
            "></div>
        `;
    }
    
    // Add a marker at the user's location with a pulsing blue dot
    const locationIcon = L.divIcon({
        className: 'user-location-marker',
        html: markerHtml,
        iconSize: [40, 40],
        iconAnchor: [20, 20]
    });
    
    window.userMarker = L.marker([lat, lng], {
        icon: locationIcon
    }).addTo(window.map);
    
    // Format speed for display if available
    let speedText = '';
    if (extras.speed && extras.speed > 0) {
        // Convert m/s to km/h
        const speedKmh = (extras.speed * 3.6).toFixed(1);
        speedText = `<p><i class="fas fa-tachometer-alt"></i> Kecepatan: ${speedKmh} km/h</p>`;
    }
    
    // Add a popup on the marker
    window.userMarker.bindPopup(`
        <div class="popup-content">
            <strong>Lokasi Anda</strong><br>
            Akurasi: ${Math.round(accuracy)} meter
            ${speedText}
            <p><small>Koordinat: ${lat.toFixed(6)}, ${lng.toFixed(6)}</small></p>
        </div>
    `);
}

function handleQuickSearch() {
    const searchInput = document.getElementById("search-input");
    if (!searchInput) return;

    const searchValue = searchInput.value;
    
    // Only proceed if something was entered
    if (!searchValue.trim()) {
        showNotification("Silakan masukkan kata kunci pencarian", "warning");
        return;
    }
    
    // Clear previous results
    clearResults();
    
    showLoading('Mencari...');
    
    // Try to geocode the search input first
    geocodeAndSearch(searchValue);
}

function handleSearch() {
    const searchInput = document.getElementById("search-input");
    const category = document.getElementById("category");
    const location = document.getElementById("location");
    
    if (!searchInput || !category || !location) return;

    const searchValue = searchInput.value;
    const categoryValue = category.value;
    const locationValue = location.value;
    
    // Clear previous results
    clearResults();
    
    showLoading('Mencari...');
    
    // If search input is provided, use it as a query
    if (searchValue) {
        geocodeAndSearch(searchValue, categoryValue, locationValue);
    } else {
        // If no search input, use the selected location
        const searchLocation = getLocationCoordinates(locationValue);
        searchFoursquare(searchLocation, categoryValue !== 'all' ? categoryValue : 'cafe');
    }
}

function geocodeAndSearch(searchInput, category = 'cafe', locationValue = 'all') {
    // Try to geocode the search input
    fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(searchInput)}&limit=1`)
        .then(response => {
            if (!response.ok) {
                throw new Error(`Geocoding request failed with status ${response.status}`);
            }
            return response.json();
        })
        .then(data => {
            if (data && data.length > 0) {
                const searchLocation = [parseFloat(data[0].lat), parseFloat(data[0].lon)];
                
                // Search Foursquare using the geocoded location
                searchFoursquare(searchLocation, category !== 'all' ? category : 'cafe');
            } else {
                // If geocoding fails, try searching by query
                const defaultLocation = window.userLocation || getLocationCoordinates(locationValue);
                searchFoursquareByQuery(searchInput, defaultLocation);
            }
        })
        .catch(error => {
            console.error("Error with geocoding:", error);
            showNotification("Error during location search: " + error.message, "error");
            hideLoading();
            
            // If there's an error, fall back to searching by query
            const defaultLocation = window.userLocation || getLocationCoordinates(locationValue);
            searchFoursquareByQuery(searchInput, defaultLocation);
        });
}

function getLocationCoordinates(locationValue) {
    // Return coordinates based on the selected location (major cities in Java Island)
    switch (locationValue) {
        // DKI Jakarta & surrounding areas
        case 'jakarta':
            return [-6.2088, 106.8456]; // Jakarta
        case 'bekasi':
            return [-6.2382, 106.9756]; // Bekasi
        case 'bogor':
            return [-6.5944, 106.7892]; // Bogor
        case 'depok':
            return [-6.4025, 106.7942]; // Depok
        case 'tangerang':
            return [-6.1783, 106.6319]; // Tangerang
            
        // West Java
        case 'bandung':
            return [-6.9175, 107.6191]; // Bandung
        case 'cirebon':
            return [-6.7320, 108.5523]; // Cirebon
            
        // Central Java
        case 'semarang':
            return [-7.0051, 110.4381]; // Semarang
        case 'solo':
            return [-7.5695, 110.8271]; // Solo/Surakarta
            
        // DIY
        case 'yogyakarta':
            return [-7.7956, 110.3695]; // Yogyakarta
            
        // East Java
        case 'surabaya':
            return [-7.2575, 112.7521]; // Surabaya
        case 'malang':
            return [-7.9797, 112.6304]; // Malang
            
        default:
            return window.userLocation || [-6.2088, 106.8456]; // Default to Jakarta if no user location
    }
}

function searchFoursquare(location, category) {
    if (!window.map) {
        console.error("Map not initialized in searchFoursquare");
        return;
    }
    
    // Center map on the search location
    window.map.setView(location, 14);
    
    const radius = getSearchRadius(); // Get radius from slider, default to 5000m
    const limit = 20; // Number of results to return
    
    // Add search radius circle
    if (window.searchCircle) {
        window.map.removeLayer(window.searchCircle);
    }
    
    window.searchCircle = L.circle(location, {
        radius: radius,
        color: '#FF8C00',
        fillColor: '#FF8C00',
        fillOpacity: 0.05,
        weight: 1
    }).addTo(window.map);
    
    // Foursquare API call
    const url = 'https://api.foursquare.com/v3/places/search';
    const params = new URLSearchParams({
        ll: `${location[0]},${location[1]}`,
        radius: radius,
        categories: getCategoryId(category),
        limit: limit,
        sort: 'DISTANCE'
    });
    
    fetch(`${url}?${params}`, {
        method: 'GET',
        headers: {
            Accept: 'application/json',
            Authorization: FOURSQUARE_API_KEY
        }
    })
        .then(response => {
            if (!response.ok) {
                throw new Error(`Foursquare API request failed with status ${response.status}`);
            }
            return response.json();
        })
        .then(data => {
            if (data.results && data.results.length > 0) {
                processFoursquareResults(data.results, location);
                updateResultCount(data.results.length);
                showNotification(`${data.results.length} tempat ditemukan!`, "success");
            } else {
                const resultsContainer = document.getElementById("results-container");
                if (resultsContainer) {
                    resultsContainer.innerHTML = `
                        <div class="no-results">
                            <p>Tidak ada hasil ditemukan. Coba kriteria pencarian yang berbeda.</p>
                        </div>
                    `;
                }
                updateResultCount(0);
                showNotification("Tidak ada hasil ditemukan", "warning");
                hideLoading();
            }
        })
        .catch(error => {
            console.error("Error fetching from Foursquare:", error);
            const resultsContainer = document.getElementById("results-container");
            if (resultsContainer) {
                resultsContainer.innerHTML = `
                    <div class="no-results">
                        <p>Terjadi kesalahan saat mencari. Silakan coba lagi nanti.</p>
                    </div>
                `;
            }
            updateResultCount(0);
            showNotification("Error saat mencari: " + error.message, "error");
            hideLoading();
        });
}

function getSearchRadius() {
    const radiusSlider = document.getElementById('radius');
    if (radiusSlider) {
        // Convert km to meters
        return parseInt(radiusSlider.value) * 1000;
    }
    return 5000; // Default 5km
}

function updateResultCount(count) {
    const resultsCount = document.getElementById('results-count');
    if (resultsCount) {
        resultsCount.textContent = count > 0 ? `${count} tempat ditemukan` : 'Tidak ada hasil';
    }
}

function searchFoursquareByQuery(query, defaultLocation) {
    // Foursquare API call with query
    const url = 'https://api.foursquare.com/v3/places/search';
    const radius = getSearchRadius();
    const params = new URLSearchParams({
        query: query,
        ll: `${defaultLocation[0]},${defaultLocation[1]}`,
        radius: radius,
        limit: 20,
        sort: 'RELEVANCE'
    });
    
    // Add search radius circle
    if (window.searchCircle) {
        window.map.removeLayer(window.searchCircle);
    }
    
    window.searchCircle = L.circle(defaultLocation, {
        radius: radius,
        color: '#FF8C00',
        fillColor: '#FF8C00',
        fillOpacity: 0.05,
        weight: 1
    }).addTo(window.map);
    
    fetch(`${url}?${params}`, {
        method: 'GET',
        headers: {
            Accept: 'application/json',
            Authorization: FOURSQUARE_API_KEY
        }
    })
        .then(response => {
            if (!response.ok) {
                throw new Error(`Foursquare API request failed with status ${response.status}`);
            }
            return response.json();
        })
        .then(data => {
            if (data.results && data.results.length > 0) {
                processFoursquareResults(data.results, defaultLocation);
                updateResultCount(data.results.length);
                showNotification(`${data.results.length} tempat ditemukan!`, "success");
            } else {
                const resultsContainer = document.getElementById("results-container");
                if (resultsContainer) {
                    resultsContainer.innerHTML = `
                        <div class="no-results">
                            <p>Tidak ada hasil ditemukan. Coba kriteria pencarian yang berbeda.</p>
                        </div>
                    `;
                }
                updateResultCount(0);
                showNotification("Tidak ada hasil ditemukan", "warning");
                hideLoading();
            }
        })
        .catch(error => {
            console.error("Error fetching from Foursquare:", error);
            const resultsContainer = document.getElementById("results-container");
            if (resultsContainer) {
                resultsContainer.innerHTML = `
                    <div class="no-results">
                        <p>Terjadi kesalahan saat mencari. Silakan coba lagi nanti.</p>
                    </div>
                `;
            }
            updateResultCount(0);
            showNotification("Error saat mencari: " + error.message, "error");
            hideLoading();
        });
}

// Search by ID for favorites
function searchFoursquareById(id) {
    showLoading('Mencari tempat...');
    
    // Foursquare API call with place ID
    const url = `https://api.foursquare.com/v3/places/${id}`;
    
    fetch(url, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        Authorization: FOURSQUARE_API_KEY
      }
    })
      .then(response => {
        if (!response.ok) {
          throw new Error(`Foursquare API request failed with status ${response.status}`);
        }
        return response.json();
      })
      .then(place => {
        if (place) {
          // Clear previous results
          clearResults();
          
          // Get location and center map
          const placeLocation = [place.geocodes.main.latitude, place.geocodes.main.longitude];
          window.map.setView(placeLocation, 17);
          
          // Calculate distance if user location is available
          let distance = 0;
          if (window.userLocation) {
            distance = calculateDistance(
              window.userLocation[0], window.userLocation[1],
              placeLocation[0], placeLocation[1]
            );
          }
          
          // Create place object
          const placeData = {
            id: place.fsq_id,
            name: place.name,
            lat: placeLocation[0],
            lon: placeLocation[1],
            address: formatAddress(place.location),
            categories: place.categories ? place.categories.map(c => c.name).join(', ') : '',
            distance: distance // Use calculated distance
          };
          
          // Get photos
          getPlacePhotos(place.fsq_id, placeData, function(updatedPlace) {
            // Add to history when viewing place details
            addToHistory(updatedPlace);

            addMarker(updatedPlace).openPopup();

            // Scroll to map section
            const mapSection = document.querySelector('.map-section');
            if (mapSection) {
              mapSection.scrollIntoView({ behavior: 'smooth' });
            }
          });
          
          showNotification(`Tempat "${place.name}" ditemukan!`, "success");
        } else {
          showNotification("Tempat tidak ditemukan", "error");
        }
        hideLoading();
      })
      .catch(error => {
        console.error("Error fetching place details:", error);
        showNotification("Error saat mencari tempat: " + error.message, "error");
        hideLoading();
      });
  }

function getCategoryId(category) {
    // Foursquare category IDs
    // Full list: https://developer.foursquare.com/docs/categories
    const categoryMap = {
        'cafe': '13032', // Coffee Shop
        'restaurant': '13065', // Restaurant
        'fast_food': '13145', // Fast Food Restaurant
        'bar': '13003', // Bar
        'pub': '13066', // Pub
        'ice_cream': '13079', // Ice Cream Shop
        'bakery': '13072' // Bakery
    };
    
    return categoryMap[category] || '13032'; // Default to coffee shop
}

function processFoursquareResults(results, searchLocation) {
    // Keep track of processed places to avoid duplicates
    const processedPlaces = new Set();
    
    // Process results and add to map
    results.forEach((place, index) => {
        // Skip if we've already processed this place
        if (processedPlaces.has(place.fsq_id)) return;
        
        // Mark as processed
        processedPlaces.add(place.fsq_id);
        
        // Skip if place doesn't have valid coordinates
        if (!place.geocodes || !place.geocodes.main) return;
        
        // Calculate distance from search location
        const placeLocation = [place.geocodes.main.latitude, place.geocodes.main.longitude];
        const distance = calculateDistance(
            searchLocation[0], searchLocation[1],
            placeLocation[0], placeLocation[1]
        );
        
        // Create place object with formatted data
        const placeData = {
            id: place.fsq_id,
            name: place.name,
            lat: placeLocation[0],
            lon: placeLocation[1],
            address: formatAddress(place.location),
            distance: distance,
            categories: place.categories ? place.categories.map(c => c.name).join(', ') : '',
            photos: place.photos || [],
            // Add a delay to stagger the animations
            animationDelay: index * 100
        };
        
        // If available, get photos for this place
        if (place.fsq_id) {
            getPlacePhotos(place.fsq_id, placeData, function(updatedPlace) {
                addMarker(updatedPlace);
                addResultItem(updatedPlace);
            });
        } else {
            addMarker(placeData);
            addResultItem(placeData);
        }
    });
    
    hideLoading();
}

function getPlacePhotos(placeId, placeData, callback) {
    // Foursquare API call to get place photos
    const url = `https://api.foursquare.com/v3/places/${placeId}/photos`;
    
    fetch(url, {
        method: 'GET',
        headers: {
            Accept: 'application/json',
            Authorization: FOURSQUARE_API_KEY
        }
    })
        .then(response => {
            if (!response.ok) {
                throw new Error(`Foursquare photos API request failed with status ${response.status}`);
            }
            return response.json();
        })
        .then(data => {
            // If we have photos, add the first one to our place data
            if (data && data.length > 0) {
                placeData.photo = `${data[0].prefix}300x200${data[0].suffix}`;
            } else {
                // Use a default image if no photos available
                placeData.photo = 'https://images.unsplash.com/photo-1501339847302-ac426a4a7cbb?ixlib=rb-1.2.1&auto=format&fit=crop&w=1350&q=80';
            }
            
            // Call the callback with updated place data
            callback(placeData);
        })
        .catch(error => {
            console.error("Error fetching photos:", error);
            // Use a default image if there's an error
            placeData.photo = 'https://images.unsplash.com/photo-1501339847302-ac426a4a7cbb?ixlib=rb-1.2.1&auto=format&fit=crop&w=1350&q=80';
            callback(placeData);
        });
}

function formatAddress(location) {
    if (!location) return '';
    
    const addressParts = [];
    
    if (location.address) addressParts.push(location.address);
    if (location.locality) addressParts.push(location.locality);
    if (location.postcode) addressParts.push(location.postcode);
    
    return addressParts.join(', ');
}


// Modified addMarker function
function addMarker(place) {
    // Create custom marker icon
    const markerIcon = L.divIcon({
        className: 'custom-marker',
        html: `<div class="marker-pin"></div>`,
        iconSize: [30, 42],
        iconAnchor: [15, 42]
    });
    
    const marker = L.marker([place.lat, place.lon], {
        icon: markerIcon,
        title: place.name
    });
    
    // Check if this place is a favorite
    const favorites = JSON.parse(localStorage.getItem('cafeFinderFavorites')) || [];
    const isFavorite = favorites.some(fav => fav.id === place.id);
    const favoriteIcon = isFavorite ? 'fas fa-heart' : 'far fa-heart';
    const favoriteColor = isFavorite ? 'color: #FF8C00;' : '';
    
    // Create popup content
    let popupContent = `
        <div class="popup-content">
            <h3>${place.name}</h3>
            ${place.address ? `<p><i class="fas fa-map-marker-alt"></i> ${place.address}</p>` : ''}
            ${place.categories ? `<p><i class="fas fa-tags"></i> ${place.categories}</p>` : ''}
            <p><i class="fas fa-walking"></i> ${place.distance.toFixed(2)} km</p>
            <div class="popup-actions">
                <button class="directions-btn" onclick="getDirections(${place.lat}, ${place.lon}, '${place.name.replace(/'/g, "\\'").replace(/"/g, '\\"')}')">
                    <i class="fas fa-directions"></i> Rute
                </button>
                <button class="favorite-btn" onclick="addToFavorites('${place.id}', '${place.name.replace(/'/g, "\\'").replace(/"/g, '\\"')}')">
                    <i class="${favoriteIcon}" style="${favoriteColor}"></i> Favorit
                </button>
            </div>
        </div>
    `;
    
    // Bind popup to marker
    marker.bindPopup(popupContent);
    
    // Add event handler to add to history when marker is clicked
    marker.on('click', function() {
        addToHistory(place);
    });
    
    // Add marker to layer
    window.markersLayer.addLayer(marker);
    
    return marker;
}

// Modified addResultItem function
function addResultItem(place) {
    const resultsContainer = document.getElementById("results-container");
    if (!resultsContainer) return;
    
    // Check if initial message exists and remove it
    const initialMessage = resultsContainer.querySelector('.initial-message');
    if (initialMessage) {
        resultsContainer.innerHTML = '';
    }
    
    const resultItem = document.createElement("div");
    resultItem.className = "result-item";
    resultItem.style.animationDelay = `${place.animationDelay || 0}ms`;
    
    // Check if this place is a favorite
    const favorites = JSON.parse(localStorage.getItem('cafeFinderFavorites')) || [];
    const isFavorite = favorites.some(fav => fav.id === place.id);
    const favoriteIcon = isFavorite ? 'fas fa-heart' : 'far fa-heart';
    const favoriteColor = isFavorite ? 'color: #FF8C00;' : '';
    
    // Default photo if none provided
    const photoUrl = place.photo || 'https://images.unsplash.com/photo-1501339847302-ac426a4a7cbb?ixlib=rb-1.2.1&auto=format&fit=crop&w=1350&q=80';
    
    resultItem.innerHTML = `
        <div class="result-image" style="background-image: url('${photoUrl}')">
            <div class="result-actions">
                <button class="favorite-btn" onclick="addToFavorites('${place.id}', '${place.name.replace(/'/g, "\\'").replace(/"/g, '\\"')}')">
                    <i class="${favoriteIcon}" style="${favoriteColor}"></i>
                </button>
            </div>
        </div>
        <div class="result-details">
            <h3>${place.name}</h3>
            ${place.address ? `<p><i class="fas fa-map-marker-alt"></i> ${place.address}</p>` : ''}
            ${place.categories ? `<p><i class="fas fa-tags"></i> ${place.categories}</p>` : ''}
            <div class="result-footer">
                <p class="distance"><i class="fas fa-walking"></i> ${place.distance.toFixed(2)} km</p>
                <button class="directions-btn" onclick="getDirections(${place.lat}, ${place.lon}, '${place.name.replace(/'/g, "\\'").replace(/"/g, '\\"')}')">
                    <i class="fas fa-directions"></i> Rute
                </button>
            </div>
        </div>
    `;
    
    resultItem.addEventListener("click", function(e) {
        // Don't trigger if clicking on a button
        if (e.target.tagName === 'BUTTON' || e.target.tagName === 'I') {
            return;
        }
        
        // Add to history when clicking on a result item
        addToHistory(place);
        
        window.map.setView([place.lat, place.lon], 17);
        
        // Find marker and open popup
        window.markersLayer.eachLayer(function(layer) {
            const latlng = layer.getLatLng();
            if (latlng.lat === place.lat && latlng.lng === place.lon) {
                layer.openPopup();
            }
        });
    });
    
    resultsContainer.appendChild(resultItem);
}

// Function to get directions
function getDirections(lat, lon, placeName) {
    // Check if we have user location
    if (!window.userLocation) {
        showNotification("Lokasi Anda diperlukan untuk mendapatkan rute", "warning");
        getUserLocationHighAccuracy(true);
        return;
    }
    
    // Open Google Maps directions in a new tab
    const url = `https://www.google.com/maps/dir/${window.userLocation[0]},${window.userLocation[1]}/${lat},${lon}`;
    window.open(url, '_blank');
}

// Function to add place to favorites
function addToFavorites(placeId, placeName) {
    // Get existing favorites from localStorage
    let favorites = JSON.parse(localStorage.getItem('cafeFinderFavorites')) || [];
    
    // Check if already a favorite
    const existingIndex = favorites.findIndex(fav => fav.id === placeId);
    
    if (existingIndex >= 0) {
        // Already a favorite, remove it
        favorites.splice(existingIndex, 1);
        showNotification(`"${placeName}" dihapus dari favorit!`, "info");
    } else {
        // Add to favorites
        favorites.push({
            id: placeId,
            name: placeName,
            date: new Date().toISOString()
        });
        showNotification(`"${placeName}" ditambahkan ke favorit!`, "success");
    }
    
    // Save back to localStorage
    localStorage.setItem('cafeFinderFavorites', JSON.stringify(favorites));
    
    // Update icons if needed
    updateFavoriteIcons();
    
    // Reload favorites section if it exists
    loadFavorites();
}

// Function to update favorite icons
function updateFavoriteIcons() {
    // Get all favorite buttons and update their icons
    document.querySelectorAll('.favorite-btn').forEach(btn => {
        const onclickAttr = btn.getAttribute('onclick');
        if (!onclickAttr) return;
        
        const placeId = onclickAttr.split("'")[1];
        const favorites = JSON.parse(localStorage.getItem('cafeFinderFavorites')) || [];
        const isFavorite = favorites.some(fav => fav.id === placeId);
        
        // Update icon
        const icon = btn.querySelector('i');
        if (icon) {
            if (isFavorite) {
                icon.classList.remove('far');
                icon.classList.add('fas');
                icon.style.color = '#FF8C00';
            } else {
                icon.classList.remove('fas');
                icon.classList.add('far');
                icon.style.color = '';
            }
        }
    });
}

// Load favorites from localStorage
function loadFavorites() {
    const favoritesContainer = document.getElementById('favorites-container');
    if (!favoritesContainer) return;
    
    const favorites = JSON.parse(localStorage.getItem('cafeFinderFavorites')) || [];
    
    if (favorites.length === 0) {
        // Show initial message if no favorites
        favoritesContainer.innerHTML = `
            <div class="initial-message">
                <i class="far fa-heart"></i>
                <p>Tambahkan tempat ke favorit untuk melihatnya di sini</p>
            </div>
        `;
        return;
    }
    
    // Clear container
    favoritesContainer.innerHTML = '';
    
    // Sort favorites by date (newest first)
    favorites.sort((a, b) => new Date(b.date) - new Date(a.date));
    
    // Add favorites to container
    favorites.forEach(favorite => {
        const favoriteItem = document.createElement('div');
        favoriteItem.className = 'favorite-item';
        favoriteItem.innerHTML = `
            <div class="favorite-details">
                <h3>${favorite.name}</h3>
                <p class="favorite-date">Ditambahkan: ${formatDate(favorite.date)}</p>
            </div>
            <div class="favorite-actions">
                <button class="favorite-view-btn" onclick="viewFavorite('${favorite.id}')">
                    <i class="fas fa-map-marker-alt"></i> Lihat
                </button>
                <button class="favorite-remove-btn" onclick="removeFavorite('${favorite.id}', '${favorite.name.replace(/'/g, "\\'").replace(/"/g, '\\"')}')">
                    <i class="fas fa-trash-alt"></i>
                </button>
            </div>
        `;
        favoritesContainer.appendChild(favoriteItem);
    });
}

// Format date for favorites
function formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString('id-ID', { 
        year: 'numeric', 
        month: 'short', 
        day: 'numeric' 
    });
}

// View favorite on map
function viewFavorite(id) {
    searchFoursquareById(id);
}

// Remove favorite
function removeFavorite(id, name) {
    let favorites = JSON.parse(localStorage.getItem('cafeFinderFavorites')) || [];
    
    // Remove from favorites
    favorites = favorites.filter(fav => fav.id !== id);
    
    // Save back to localStorage
    localStorage.setItem('cafeFinderFavorites', JSON.stringify(favorites));
    
    // Show notification
    showNotification(`"${name}" dihapus dari favorit`, "info");
    
    // Reload favorites
    loadFavorites();
    
    // Update favorite icons
    updateFavoriteIcons();
}

function calculateDistance(lat1, lon1, lat2, lon2) {
    // Implementation of the Haversine formula for accurate Earth distance
    const R = 6371; // Radius of the Earth in kilometers
    const dLat = deg2rad(lat2 - lat1);
    const dLon = deg2rad(lon2 - lon1);
    
    const a = 
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) * 
      Math.sin(dLon/2) * Math.sin(dLon/2);
    
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    const distance = R * c; // Distance in kilometers
    
    return distance;
  }
  
  function deg2rad(deg) {
    return deg * (Math.PI/180);
  }

function clearResults() {
    // Clear markers
    window.markersLayer.clearLayers();
    
    // Clear search circle
    if (window.searchCircle) {
        window.map.removeLayer(window.searchCircle);
        window.searchCircle = null;
    }
    
    // Reset result count
    updateResultCount(0);
    
    // Clear results list and show initial message
    const resultsContainer = document.getElementById("results-container");
    if (resultsContainer) {
        resultsContainer.innerHTML = `
            <div class="initial-message">
                <i class="fas fa-search"></i>
                <p>Cari café atau restoran untuk melihat hasilnya di sini</p>
            </div>
        `;
    }
}

function showLoading(message = 'Mencari') {
    // Check if loading element exists
    let loadingElement = document.querySelector('.loading');
    
    // If not, create it
    if (!loadingElement) {
        loadingElement = document.createElement('div');
        loadingElement.className = 'loading';
        document.body.appendChild(loadingElement);
    }
    
    // Update message and show loading element
    loadingElement.textContent = message;
    loadingElement.style.display = 'block';
}

function hideLoading() {
    // Hide loading element
    const loadingElement = document.querySelector('.loading');
    if (loadingElement) {
        loadingElement.style.display = 'none';
    }
}

// Add notification system
function showNotification(message, type = 'info') {
    // Create notification container if it doesn't exist
    let notifContainer = document.querySelector('.notification-container');
    if (!notifContainer) {
        notifContainer = document.createElement('div');
        notifContainer.className = 'notification-container';
        document.body.appendChild(notifContainer);
    }
    
    // Create notification element
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    
    // Add icon based on type
    let icon = '';
    switch(type) {
        case 'success':
            icon = '<i class="fas fa-check-circle"></i>';
            break;
        case 'error':
            icon = '<i class="fas fa-exclamation-circle"></i>';
            break;
        case 'warning':
            icon = '<i class="fas fa-exclamation-triangle"></i>';
            break;
        default:
            icon = '<i class="fas fa-info-circle"></i>';
    }
    
    notification.innerHTML = `
        ${icon}
        <span>${message}</span>
    `;
    
    // Add to container
    notifContainer.appendChild(notification);
    
    // Remove after delay
    setTimeout(() => {
        notification.classList.add('hide');
        setTimeout(() => {
            notification.remove();
        }, 300);
    }, 3000);
}

// Add CSS to animate the location marker
const style = document.createElement('style');
style.innerHTML = `
    @keyframes pulse {
        0% {
            transform: scale(0.5);
            opacity: 1;
        }
        100% {
            transform: scale(1.5);
            opacity: 0;
        }
    }
`;
document.head.appendChild(style);

// Function untuk menangani parameter dari halaman history
document.addEventListener('DOMContentLoaded', function() {
    console.log('Checking for history parameters');
    
    // Ambil parameter dari URL
    const urlParams = new URLSearchParams(window.location.search);
    const viewType = urlParams.get('view');
    
    if (viewType === 'place') {
        // Dapatkan informasi lokasi
        const id = urlParams.get('id');
        const lat = parseFloat(urlParams.get('lat'));
        const lon = parseFloat(urlParams.get('lon'));
        const nameEncoded = urlParams.get('name');
        const name = nameEncoded ? decodeURIComponent(nameEncoded) : 'Lokasi';
        
        console.log(`Loading location from history: ${name} (${lat}, ${lon})`);
        
        // Tunggu sampai map selesai diinisialisasi
        const waitForMap = setInterval(function() {
            if (window.map) {
                clearInterval(waitForMap);
                
                // Pusatkan peta ke lokasi
                window.map.setView([lat, lon], 17);
                
                // Cari tempat berdasarkan ID jika fungsi tersedia
                if (typeof searchFoursquareById === 'function') {
                    try {
                        searchFoursquareById(id);
                        showNotification(`Menampilkan lokasi dari riwayat: ${name}`, 'success');
                    } catch (error) {
                        console.error('Error loading location details:', error);
                        // Fallback: tambahkan marker sederhana
                        addSimpleMarker(lat, lon, name);
                    }
                } else {
                    // Jika fungsi searchFoursquareById tidak tersedia
                    console.warn('searchFoursquareById function not available');
                    addSimpleMarker(lat, lon, name);
                }
            }
        }, 500); // Periksa setiap 500ms
    }
    handleUrlParameters();
});

// Fungsi untuk menambahkan marker sederhana jika searchFoursquareById tidak tersedia
function addSimpleMarker(lat, lon, name) {
    if (window.map && window.markersLayer) {
        // Bersihkan marker yang ada
        window.markersLayer.clearLayers();
        
        // Tambahkan marker baru
        const marker = L.marker([lat, lon]).addTo(window.markersLayer);
        marker.bindPopup(`<div class="popup-content"><h3>${name}</h3></div>`).openPopup();
        
        // Tampilkan notifikasi
        showNotification(`Menampilkan lokasi: ${name}`, 'info');
    } else {
        console.error('Map or markers layer not initialized');
    }
}

function addToHistory(place) {
    // Ambil history yang ada dari localStorage
    let history = JSON.parse(localStorage.getItem('cafeFinderHistory')) || [];
    
    // Periksa apakah tempat ini sudah ada di history
    const existingIndex = history.findIndex(item => item.id === place.id);
    
    if (existingIndex >= 0) {
        // Jika sudah ada, hapus dan akan ditambahkan sebagai yang terbaru
        history.splice(existingIndex, 1);
    }
    
    // Tambahkan tempat dengan timestamp terbaru
    history.unshift({
        id: place.id,
        name: place.name,
        address: place.address || '',
        categories: place.categories || '',
        photo: place.photo || '',
        lat: place.lat,
        lon: place.lon,
        viewedAt: new Date().toISOString()
    });
    
    // Batasi history untuk 50 tempat terakhir saja
    if (history.length > 50) {
        history = history.slice(0, 50);
    }
    
    // Simpan kembali ke localStorage
    localStorage.setItem('cafeFinderHistory', JSON.stringify(history));
    
    console.log(`Added "${place.name}" to history`);
}

// Function to add a place to history
function addToHistory(place) {
    // Get history that exists from localStorage
    let history = JSON.parse(localStorage.getItem('cafeFinderHistory')) || [];
    
    // Check if this place already exists in history
    const existingIndex = history.findIndex(item => item.id === place.id);
    
    if (existingIndex >= 0) {
        // If it exists, remove it so we can add it as the most recent
        history.splice(existingIndex, 1);
    }
    
    // Add place with current timestamp
    history.unshift({
        id: place.id,
        name: place.name,
        address: place.address || '',
        categories: place.categories || '',
        photo: place.photo || '',
        lat: place.lat,
        lon: place.lon,
        viewedAt: new Date().toISOString()
    });
    
    // Limit history to 50 most recent places
    if (history.length > 50) {
        history = history.slice(0, 50);
    }
    
    // Save back to localStorage
    localStorage.setItem('cafeFinderHistory', JSON.stringify(history));
    
    console.log(`Added "${place.name}" to history`);
}
