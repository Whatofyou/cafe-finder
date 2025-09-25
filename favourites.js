// Global variables
let favorites = [];

// Foursquare API Key - In production, this should be handled server-side
const FOURSQUARE_API_KEY = 'fsq336jjzkttikrUNPGCg7pF9W5q6/at1MLNnObTbe/tMWU=';

// Initialize when DOM is fully loaded
document.addEventListener('DOMContentLoaded', function() {
    console.log('DOM fully loaded');
    
    // Load favorites
    loadFavorites();
    
    // Set up mobile menu toggle
    setupMobileMenuToggle();
    
    // Set up view toggle
    setupViewToggle();
});

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

// Set up view toggle
function setupViewToggle() {
    const viewButtons = document.querySelectorAll('.view-btn');
    const favoritesContainer = document.getElementById('favorites-list');

    if (viewButtons.length > 0 && favoritesContainer) {
        viewButtons.forEach(button => {
            button.addEventListener('click', function() {
                // Remove active class from all buttons
                viewButtons.forEach(btn => btn.classList.remove('active'));
                
                // Add active class to clicked button
                this.classList.add('active');
                
                // Update view
                const viewType = this.getAttribute('data-view');
                favoritesContainer.className = `results-container ${viewType}-view`;
            });
        });
    }
}

// Load favorites from localStorage
function loadFavorites() {
    const favoritesContainer = document.getElementById('favorites-list');
    if (!favoritesContainer) return;
    
    // Get favorites from localStorage
    favorites = JSON.parse(localStorage.getItem('cafeFinderFavorites')) || [];
    
    // Update favorites count with more descriptive text
    const favoritesCount = document.getElementById('favorites-count');
    if (favoritesCount) {
        if (favorites.length === 0) {
            favoritesCount.textContent = 'Tidak ada tempat favorit';
        } else if (favorites.length === 1) {
            favoritesCount.textContent = '1 tempat favorit';
        } else {
            favoritesCount.textContent = `${favorites.length} tempat favorit`;
        }
    }
    
    if (favorites.length === 0) {
        // Show initial message if no favorites
        favoritesContainer.innerHTML = `
            <div class="initial-message">
                <i class="far fa-heart"></i>
                <p>Belum ada tempat favorit</p>
                <p>Tambahkan tempat ke favorit dari halaman utama</p>
                <a href="home.html" class="directions-btn" style="margin-top: 15px; display: inline-flex;">
                    <i class="fas fa-home"></i> Kembali ke Halaman Utama
                </a>
            </div>
        `;
        return;
    }
    
    // Clear container
    favoritesContainer.innerHTML = '';
    
    // Sort favorites by date (newest first)
    favorites.sort((a, b) => new Date(b.date) - new Date(a.date));
    
    // Show loading indicator while we fetch details
    showLoading('Memuat tempat favorit...');
    
    // Create a promise for each favorite to get details
    const promises = favorites.map(favorite => fetchPlaceDetails(favorite.id));
    
    // Wait for all promises to resolve
    Promise.all(promises)
        .then(places => {
            // Filter out any null results
            const validPlaces = places.filter(place => place !== null);
            
            // If no valid places were found, show message
            if (validPlaces.length === 0) {
                favoritesContainer.innerHTML = `
                    <div class="initial-message">
                        <i class="fas fa-exclamation-circle"></i>
                        <p>Gagal memuat detail tempat favorit</p>
                        <p>Coba lagi nanti</p>
                    </div>
                `;
                hideLoading();
                return;
            }
            
            // Add favorite cards
            validPlaces.forEach((place, index) => {
                addFavoriteCard(place, index);
            });
            
            hideLoading();
        })
        .catch(error => {
            console.error("Error loading favorite details:", error);
            favoritesContainer.innerHTML = `
                <div class="initial-message">
                    <i class="fas fa-exclamation-circle"></i>
                    <p>Terjadi kesalahan saat memuat tempat favorit</p>
                    <p>${error.message}</p>
                </div>
            `;
            hideLoading();
        });
}

// Fetch place details from Foursquare
function fetchPlaceDetails(placeId) {
    const url = `https://api.foursquare.com/v3/places/${placeId}`;
    
    return fetch(url, {
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
        if (!place || !place.geocodes || !place.geocodes.main) {
            return null;
        }
        
        // Create place object
        const placeData = {
            id: place.fsq_id,
            name: place.name,
            lat: place.geocodes.main.latitude,
            lon: place.geocodes.main.longitude,
            address: formatAddress(place.location),
            categories: place.categories ? place.categories.map(c => c.name).join(', ') : ''
        };
        
        // Get photos - wrap in promise
        return new Promise((resolve) => {
            getPlacePhotos(place.fsq_id, placeData, function(updatedPlace) {
                resolve(updatedPlace);
            });
        });
    })
    .catch(error => {
        console.error(`Error fetching details for place ${placeId}:`, error);
        return null;
    });
}

// Get place photos from Foursquare API
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

// Format address from location object
function formatAddress(location) {
    if (!location) return '';
    
    const addressParts = [];
    
    if (location.address) addressParts.push(location.address);
    if (location.locality) addressParts.push(location.locality);
    if (location.postcode) addressParts.push(location.postcode);
    
    return addressParts.join(', ');
}

// Add a favorite card to the container
function addFavoriteCard(place, index) {
    const favoritesContainer = document.getElementById('favorites-list');
    if (!favoritesContainer) return;
    
    const favoriteItem = document.createElement('div');
    favoriteItem.className = 'result-item';
    favoriteItem.style.animationDelay = `${index * 100}ms`;
    
    // Get date added from favorites array
    const favorite = favorites.find(f => f.id === place.id);
    const dateAdded = favorite ? formatDate(favorite.date) : '';
    
    // Default photo if none provided
    const photoUrl = place.photo || 'https://images.unsplash.com/photo-1501339847302-ac426a4a7cbb?ixlib=rb-1.2.1&auto=format&fit=crop&w=1350&q=80';
    
    favoriteItem.innerHTML = `
        <div class="result-image" style="background-image: url('${photoUrl}')">
            <div class="result-actions">
                <button class="favorite-btn" onclick="removeFavorite('${place.id}', '${place.name.replace(/'/g, "\\'").replace(/"/g, '\\"')}')">
                    <i class="fas fa-trash-alt"></i>
                </button>
            </div>
        </div>
        <div class="result-details">
            <h3>${place.name}</h3>
            ${place.address ? `<p><i class="fas fa-map-marker-alt"></i> ${place.address}</p>` : ''}
            ${place.categories ? `<p><i class="fas fa-tags"></i> ${place.categories}</p>` : ''}
            <p><i class="far fa-calendar-alt"></i> Ditambahkan: ${dateAdded}</p>
            <div class="result-footer">
                <button class="directions-btn" onclick="openMap(${place.lat}, ${place.lon}, '${place.name.replace(/'/g, "\\'").replace(/"/g, '\\"')}')">
                    <i class="fas fa-directions"></i> Lihat di Peta
                </button>
            </div>
        </div>
    `;
    
    favoritesContainer.appendChild(favoriteItem);
}

// Format date for display
function formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString('id-ID', { 
        year: 'numeric', 
        month: 'short', 
        day: 'numeric' 
    });
}

// Open location in Google Maps
function openMap(lat, lon, placeName) {
    const url = `https://www.google.com/maps/search/?api=1&query=${lat},${lon}&query_place_id=${placeName}`;
    window.open(url, '_blank');
}

// Remove favorite
function removeFavorite(id, name) {
    // Get current favorites
    let favorites = JSON.parse(localStorage.getItem('cafeFinderFavorites')) || [];
    
    // Remove from favorites
    favorites = favorites.filter(fav => fav.id !== id);
    
    // Save back to localStorage
    localStorage.setItem('cafeFinderFavorites', JSON.stringify(favorites));
    
    // Show notification
    showNotification(`"${name}" dihapus dari favorit`, "info");
    
    // Reload favorites
    loadFavorites();
}

// Show loading indicator
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

// Hide loading indicator
function hideLoading() {
    // Hide loading element
    const loadingElement = document.querySelector('.loading');
    if (loadingElement) {
        loadingElement.style.display = 'none';
    }
}

// Show notification
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

// Add CSS for animations
const style = document.createElement('style');
style.innerHTML = `
    @keyframes fadeInUp {
        to {
            opacity: 1;
            transform: translateY(0);
        }
    }
    
    .notification.hide {
        animation: slideOutRight 0.3s forwards;
    }
    
    @keyframes slideOutRight {
        from { transform: translateX(0); opacity: 0.95; }
        to { transform: translateX(100%); opacity: 0; }
    }
`;
document.head.appendChild(style);