// Global variables
let historyData = [];

// Initialize when DOM is fully loaded
document.addEventListener('DOMContentLoaded', function() {
    console.log('History page: DOM fully loaded');
    
    // Load history items
    loadHistoryItems();
    
    // Set up event listeners
    setupEventListeners();
    
    // Set up mobile menu toggle
    setupMobileMenuToggle();
    
    // Add window resize handler
    window.addEventListener('resize', function() {
        // Any resize handlers if needed
    });
});

// Set up mobile menu toggle
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

// Set up event listeners
function setupEventListeners() {
    // Clear history button
    const clearHistoryBtn = document.getElementById('clear-history-btn');
    if (clearHistoryBtn) {
        clearHistoryBtn.addEventListener('click', function() {
            clearHistory();
        });
    }
    
    // Add event listeners for view toggle
    const viewButtons = document.querySelectorAll('.view-btn');
    const historyList = document.getElementById('history-list');

    if (viewButtons.length > 0 && historyList) {
        viewButtons.forEach(button => {
            button.addEventListener('click', function() {
                // Remove active class from all buttons
                viewButtons.forEach(btn => btn.classList.remove('active'));
                
                // Add active class to clicked button
                this.classList.add('active');
                
                // Update view
                const viewType = this.getAttribute('data-view');
                historyList.className = `results-container ${viewType}-view`;
            });
        });
    }
}

// Load history items from localStorage
function loadHistoryItems() {
    // Get history data from localStorage
    historyData = JSON.parse(localStorage.getItem('cafeFinderHistory')) || [];
    
    // Update counter
    updateHistoryCounter(historyData.length);
    
    const historyList = document.getElementById('history-list');
    if (!historyList) return;
    
    // If no history items
    if (historyData.length === 0) {
        historyList.innerHTML = `
            <div class="initial-message">
                <i class="fas fa-history"></i>
                <p>Belum ada riwayat pencarian</p>
                <p>Tempat yang Anda lihat detailnya akan muncul di sini</p>
                <a href="home.html" class="directions-btn" style="margin-top: 15px; display: inline-flex;">
                    <i class="fas fa-home"></i> Kembali ke Halaman Utama
                </a>
            </div>
        `;
        return;
    }
    
    // Clear existing content
    historyList.innerHTML = '';
    
    // Group by day for better organization
    const groupedByDay = groupHistoryByDay(historyData);
    
    // Process each day group
    Object.keys(groupedByDay).sort().reverse().forEach(day => {
        // Add day header
        const dayHeader = document.createElement('div');
        dayHeader.className = 'time-group';
        dayHeader.innerHTML = `<i class="fas fa-calendar-day"></i> ${formatDayHeader(day)}`;
        historyList.appendChild(dayHeader);
        
        // Sort items for this day by time (newest first)
        const dayItems = groupedByDay[day].sort((a, b) => 
            new Date(b.viewedAt) - new Date(a.viewedAt)
        );
        
        // Add items for this day
        dayItems.forEach((item, index) => {
            addHistoryItemToDOM(item, index, historyList);
        });
    });
}

// Group history by day
function groupHistoryByDay(historyItems) {
    const grouped = {};
    
    historyItems.forEach(item => {
        const date = new Date(item.viewedAt);
        const day = date.toISOString().split('T')[0]; // YYYY-MM-DD format
        
        if (!grouped[day]) {
            grouped[day] = [];
        }
        
        grouped[day].push(item);
    });
    
    return grouped;
}

// Format day header
function formatDayHeader(dateString) {
    const date = new Date(dateString);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    
    // Compare date ignoring time
    const isToday = date.toDateString() === today.toDateString();
    const isYesterday = date.toDateString() === yesterday.toDateString();
    
    if (isToday) {
        return 'Hari Ini';
    } else if (isYesterday) {
        return 'Kemarin';
    } else {
        // Format: "Senin, 01 Januari 2025"
        return date.toLocaleDateString('id-ID', { 
            weekday: 'long', 
            day: 'numeric', 
            month: 'long', 
            year: 'numeric' 
        });
    }
}

// Add history item to DOM
function addHistoryItemToDOM(item, index, container) {
    const historyItem = document.createElement('div');
    historyItem.className = 'result-item';
    historyItem.style.animationDelay = `${index * 50}ms`;
    
    // Default photo if none provided
    const photoUrl = item.photo || 'https://images.unsplash.com/photo-1501339847302-ac426a4a7cbb?ixlib=rb-1.2.1&auto=format&fit=crop&w=1350&q=80';
    
    // Format time
    const viewTime = formatTime(item.viewedAt);
    
    historyItem.innerHTML = `
        <div class="result-image" style="background-image: url('${photoUrl}')">
            <div class="result-actions">
                <button class="remove-btn" onclick="removeFromHistory('${item.id}')">
                    <i class="fas fa-times"></i>
                </button>
            </div>
        </div>
        <div class="result-details">
            <h3>${item.name}</h3>
            ${item.address ? `<p><i class="fas fa-map-marker-alt"></i> ${item.address}</p>` : ''}
            ${item.categories ? `<p><i class="fas fa-tags"></i> ${item.categories}</p>` : ''}
            <p class="visit-time"><i class="fas fa-clock"></i> ${viewTime}</p>
            <div class="result-footer">
                <button class="directions-btn" onclick="viewOnMap('${item.id}', ${item.lat}, ${item.lon}, '${item.name.replace(/'/g, "\\'").replace(/"/g, '\\"')}')">
                    <i class="fas fa-map"></i> Lihat di Peta
                </button>
            </div>
        </div>
    `;
    
    container.appendChild(historyItem);
}

// Format time function
function formatTime(dateString) {
    const date = new Date(dateString);
    
    // Format: "14:30"
    return date.toLocaleTimeString('id-ID', { 
        hour: '2-digit', 
        minute: '2-digit',
        hour12: false 
    });
}

// View item on map
function viewOnMap(id, lat, lon, name) {
    // First get the user's saved coordinates if available
    const savedCoords = getSavedCoordinates();
    
    // Encode name for URL
    const encodedName = encodeURIComponent(name);
    
    // Build URL with additional parameters for distance calculation
    let url = `home.html?view=place&id=${id}&lat=${lat}&lon=${lon}&name=${encodedName}`;
    
    // Add user coordinates if available for accurate distance calculation
    if (savedCoords) {
      url += `&userLat=${savedCoords.lat}&userLng=${savedCoords.lng}`;
    }
    
    // Navigate to home page with parameters
    window.location.href = url;
}

// Remove item from history
function removeFromHistory(id) {
    // Get current history
    let history = JSON.parse(localStorage.getItem('cafeFinderHistory')) || [];
    
    // Find the item
    const itemToRemove = history.find(item => item.id === id);
    if (!itemToRemove) return;
    
    // Get name for notification
    const itemName = itemToRemove.name;
    
    // Remove item
    history = history.filter(item => item.id !== id);
    
    // Save back to localStorage
    localStorage.setItem('cafeFinderHistory', JSON.stringify(history));
    
    // Show notification
    showNotification(`"${itemName}" dihapus dari riwayat`, "info");
    
    // Reload history items
    loadHistoryItems();
}

// Clear all history
function clearHistory() {
    // Show confirmation dialog
    if (confirm('Yakin ingin menghapus semua riwayat?')) {
        // Clear history in localStorage
        localStorage.removeItem('cafeFinderHistory');
        
        // Show notification
        showNotification('Riwayat berhasil dihapus', 'success');
        
        // Reload history items
        loadHistoryItems();
    }
}

// Update history counter
function updateHistoryCounter(count) {
    const historyCount = document.getElementById('history-count');
    if (historyCount) {
        historyCount.textContent = count > 0 ? `${count} tempat dikunjungi` : 'Belum ada riwayat';
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

// Function to show loading indicator
function showLoading(message = 'Loading') {
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

// Function to hide loading indicator
function hideLoading() {
    // Hide loading element
    const loadingElement = document.querySelector('.loading');
    if (loadingElement) {
        loadingElement.style.display = 'none';
    }
}

function handleUrlParameters() {
    console.log('Checking for URL parameters');
    
    // Get parameters from URL
    const urlParams = new URLSearchParams(window.location.search);
    const viewType = urlParams.get('view');
    
    if (viewType === 'place') {
      // Get place information
      const id = urlParams.get('id');
      const lat = parseFloat(urlParams.get('lat'));
      const lon = parseFloat(urlParams.get('lon'));
      const nameEncoded = urlParams.get('name');
      const name = nameEncoded ? decodeURIComponent(nameEncoded) : 'Lokasi';
      
      // Get user coordinates if provided in URL
      const userLat = parseFloat(urlParams.get('userLat'));
      const userLng = parseFloat(urlParams.get('userLng'));
      
      console.log(`Loading location from parameters: ${name} (${lat}, ${lon})`);
      
      // Wait until map is initialized
      const waitForMap = setInterval(function() {
        if (window.map) {
          clearInterval(waitForMap);
          
          // Center map on location
          window.map.setView([lat, lon], 17);
          
          // If we have user coordinates, store them for accurate distance calculation
          if (!isNaN(userLat) && !isNaN(userLng)) {
            window.userLocation = [userLat, userLng];
            console.log(`Using provided user coordinates: ${userLat}, ${userLng}`);
            
            // In case we need to update the user marker
            if (window.updateUserLocationOnMap) {
              updateUserLocationOnMap(userLat, userLng, 0, { isFromHistory: true });
            }
          }
          
          // Search for place by ID
          if (typeof searchFoursquareById === 'function' && id) {
            try {
              searchFoursquareById(id);
              showNotification(`Menampilkan lokasi: ${name}`, 'success');
            } catch (error) {
              console.error('Error loading location details:', error);
              // Fallback: add a simple marker
              addSimpleMarker(lat, lon, name);
            }
          } else {
            // If searchFoursquareById is not available
            console.warn('searchFoursquareById function not available');
            addSimpleMarker(lat, lon, name);
          }
        }
      }, 100); // Check every 100ms
    }
  }