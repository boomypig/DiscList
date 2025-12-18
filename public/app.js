const API_URL = window.location.hostname === 'localhost' 
    ? 'http://localhost:8080' 
    : 'https://disklist-0c5x.onrender.com';
Vue.createApp({
    data: function() {
        return {
            // View management - controls which screen is shown
            currentView: 'main', // Options: 'login', 'signup', 'main'
            activeTab: 'all',    // Options: 'all', 'collection', 'wantlist'
            
            // Vinyl collection data
            vinyls: [],          // Array to store all vinyl records from the database
            selectedVinyl: null, // Currently selected vinyl for details view
            searchQuery: '',     // Search input for filtering records
            
            // Store banner image URL
            storeImage: 'record-store-background.jpeg', // Path to record store image
            
            // Admin edit mode state
            editMode: false,         // Whether we're editing an existing vinyl
            vinylToDelete: null,     // Vinyl record to be deleted (for confirmation)
            showDeleteConfirm: false, // Show delete confirmation dialog
            
            // User collections (stored locally)
            userCollection: [], // Array of vinyl IDs that the user has in collection
            userWantList: [],   // Array of vinyl IDs that the user wants
            userRatings: {},    // Object with vinyl IDs as keys and ratings (1-5) as values
            
            // Form data for new/edited vinyl records
            newVinyl: {
                vinylVersion: "",
                album: "",
                artist: "",
                upc: "",
                songs: 0,
                vinylCover: ""
            },
            selectedFile: null,  // File selected for upload
            isUploading: false,  // Whether an upload is in progress
            imagePreview: null,  // Data URL for image preview
            
            // User authentication state
            user: null,      // Current user object (null if not logged in)
            isAdmin: false,  // Whether the current user has admin privileges
            loginData: {     // Form data for login
                email: '',
                password: ''
            },
            signupData: {    // Form data for registration
                firstName: '',
                lastName: '',
                userName: '',
                email: '',
                password: '',
                confirmPassword: ''
            },
            
            // UI state
            showMenu: false,       // Whether side menu is visible
            showAdminPanel: false, // Whether admin panel is visible
            
            // Notification messages
            errorMessage: '',   // Current error message to display
            successMessage: '', // Current success message to display
            loginError: '',     // Login form error
            signupError: ''     // Signup form error
        };
    },
    
    // Computed properties - reactive data that depends on other reactive data
    computed: {
        // Filters vinyls based on search query
        filteredVinyls: function() {
            if (!this.searchQuery) {
                return this.vinyls; // Return all records if no search query
            }
            
            // Case-insensitive search across multiple fields
            const query = this.searchQuery.toLowerCase();
            return this.vinyls.filter(vinyl => 
                vinyl.album.toLowerCase().includes(query) || 
                vinyl.artist.toLowerCase().includes(query) ||
                (vinyl.vinylVersion && vinyl.vinylVersion.toLowerCase().includes(query))
            );
        },
        
        // Returns vinyls to be displayed based on active tab and filter
        displayedVinyls: function() {
            if (this.activeTab === 'all') {
                return this.filteredVinyls;
            } else if (this.activeTab === 'collection') {
                // Only show vinyls in user's collection
                return this.filteredVinyls.filter(vinyl => this.isInCollection(vinyl));
            } else if (this.activeTab === 'wantlist') {
                // Only show vinyls in user's want list
                return this.filteredVinyls.filter(vinyl => this.isInWantList(vinyl));
            }
            return [];
        }
    },
    
    methods: {
        // ---------- VIEW MANAGEMENT ----------
        
        // Sets the active tab and handles login requirements
        setActiveTab: function(tab) {
            this.activeTab = tab;
            this.showMenu = false;
            
            // If trying to access collection or want list without login, show login form
            if ((tab === 'collection' || tab === 'wantlist') && !this.user) {
                this.showLoginForm();
            }
        },
        
        // Shows the login form if user isn't logged in
        showLoginForm: function() {
            if (!this.user) {
                this.currentView = 'login';
            }
        },
        
        // ---------- COLLECTION MANAGEMENT ----------
        
        // Toggles a vinyl in/out of the user's collection
        toggleCollection: function(vinyl) {
            // Require login
            if (!this.user) {
                this.showLoginForm();
                return;
            }
            
            const isInCollection = this.isInCollection(vinyl);
            
            if (isInCollection) {
                // Remove from collection
                const index = this.userCollection.indexOf(vinyl._id);
                if (index !== -1) {
                    this.userCollection.splice(index, 1);
                    
                    // Clear the rating
                    if (this.userRatings[vinyl._id]) {
                        delete this.userRatings[vinyl._id];
                    }
                    
                    this.showSuccess('Removed from your collection');
                }
            } else {
                // Add to collection
                this.userCollection.push(vinyl._id);
                
                // If it's in the want list, remove it (can't be in both)
                if (this.isInWantList(vinyl)) {
                    this.toggleWantList(vinyl);
                }
                
                this.showSuccess('Added to your collection');
            }
            
            // Save changes to local storage
            this.saveUserCollections();
        },
        
        // Toggles a vinyl in/out of the user's want list
        toggleWantList: function(vinyl) {
            // Require login
            if (!this.user) {
                this.showLoginForm();
                return;
            }
            
            const isInWantList = this.isInWantList(vinyl);
            
            if (isInWantList) {
                // Remove from want list
                const index = this.userWantList.indexOf(vinyl._id);
                if (index !== -1) {
                    this.userWantList.splice(index, 1);
                    this.showSuccess('Removed from your want list');
                }
            } else {
                // Add to want list
                this.userWantList.push(vinyl._id);
                
                // If it's in the collection, remove it (can't be in both)
                if (this.isInCollection(vinyl)) {
                    this.toggleCollection(vinyl);
                }
                
                this.showSuccess('Added to your want list');
            }
            
            // Save changes to local storage
            this.saveUserCollections();
        },
        
        // Rates a vinyl (ratings feature is currently disabled)
        rateVinyl: function(vinyl, rating) {
            // This method is intentionally non-functional
            console.log('Rating feature is disabled');
        },
        
        // Checks if a vinyl is in the user's collection
        isInCollection: function(vinyl) {
            return this.userCollection.includes(vinyl._id);
        },
        
        // Checks if a vinyl is in the user's want list
        isInWantList: function(vinyl) {
            return this.userWantList.includes(vinyl._id);
        },
        
        // Saves user collections to local storage
        saveUserCollections: function() {
            if (this.user) {
                // Save each collection type with a user-specific key
                localStorage.setItem(`disclist_collection_${this.user._id}`, JSON.stringify(this.userCollection));
                localStorage.setItem(`disclist_wantlist_${this.user._id}`, JSON.stringify(this.userWantList));
                localStorage.setItem(`disclist_ratings_${this.user._id}`, JSON.stringify(this.userRatings));
            }
        },
        
        // Loads user collections from local storage
        loadUserCollections: function() {
            if (this.user) {
                // Get saved data from local storage
                const collection = localStorage.getItem(`disclist_collection_${this.user._id}`);
                const wantList = localStorage.getItem(`disclist_wantlist_${this.user._id}`);
                const ratings = localStorage.getItem(`disclist_ratings_${this.user._id}`);
                
                // Parse JSON or initialize empty if nothing saved
                this.userCollection = collection ? JSON.parse(collection) : [];
                this.userWantList = wantList ? JSON.parse(wantList) : [];
                this.userRatings = ratings ? JSON.parse(ratings) : {};
                
                // Apply ratings to vinyl objects
                this.applyRatingsToVinyls();
            }
        },
        
        // Applies saved ratings to vinyl objects
        applyRatingsToVinyls: function() {
            this.vinyls.forEach(vinyl => {
                if (this.userRatings[vinyl._id]) {
                    // Add userRating property to vinyl objects
                    vinyl.userRating = this.userRatings[vinyl._id];
                }
            });
        },
        
        // ---------- VINYL DETAILS ----------
        
        // Opens the vinyl details modal
        viewVinylDetails: function(vinyl) {
            // Create a copy of the vinyl to avoid direct mutation
            this.selectedVinyl = {...vinyl};
            
            // Add rating if present
            if (this.userRatings[vinyl._id]) {
                this.selectedVinyl.userRating = this.userRatings[vinyl._id];
            }
        },
        
        // Show vinyl options (currently just opens details)
        showVinylOptions: function(vinyl) {
            this.viewVinylDetails(vinyl);
        },
        
        // ---------- ADMIN FUNCTIONALITY ----------
        
        // Opens the edit form for a vinyl
        editVinyl: function(vinyl) {
            // Check admin permission
            if (!this.isAdmin) {
                this.showError('Admin privileges required to edit vinyl records');
                return;
            }
            
            // Close detail view if open
            this.selectedVinyl = null;
            
            // Set edit mode and load vinyl data to form
            this.editMode = true;
            this.newVinyl = {
                _id: vinyl._id,
                vinylVersion: vinyl.vinylVersion || "",
                album: vinyl.album || "",
                artist: vinyl.artist || "",
                upc: vinyl.upc || "",
                songs: vinyl.songs || 0,
                vinylCover: vinyl.vinylCover || ""
            };
            
            // Reset file selection
            this.selectedFile = null;
            this.imagePreview = null;
            
            // Show admin panel with form
            this.showAdminPanel = true;
            
            // Scroll to admin panel (smooth scrolling)
            setTimeout(() => {
                document.querySelector('.admin-panel').scrollIntoView({ behavior: 'smooth' });
            }, 100);
        },
        
        // Cancels edit mode and resets form
        cancelEdit: function() {
            this.resetVinylForm();
            this.editMode = false;
        },
        
        // Resets the vinyl form to default values
        resetVinylForm: function() {
            this.newVinyl = {
                vinylVersion: "",
                album: "",
                artist: "",
                upc: "",
                songs: 0,
                vinylCover: ""
            };
            this.selectedFile = null;
            this.imagePreview = null;
        },
        
        // Shows delete confirmation dialog
        confirmDeleteVinyl: function(vinyl) {
            // Check admin permission
            if (!this.isAdmin) {
                this.showError('Admin privileges required to delete vinyl records');
                return;
            }
            
            // Store reference to vinyl to delete
            this.vinylToDelete = vinyl;
            this.showDeleteConfirm = true;
            
            // Close detail view if open
            this.selectedVinyl = null;
        },
        
        // Deletes a vinyl after confirmation
        deleteVinyl: function() {
            // Additional safety check
            if (!this.isAdmin || !this.vinylToDelete) {
                return;
            }
            
            // Send delete request to API
            fetch(`${API_URL}/vinyls/${this.vinylToDelete._id}`, {
                method: 'DELETE',
                credentials: 'include' // Includes cookies for authentication
            })
            .then(response => {
                if (!response.ok) {
                    if (response.status === 401) {
                        throw new Error('Authentication required');
                    } else if (response.status === 403) {
                        throw new Error('Admin privileges required');
                    } else {
                        throw new Error('Failed to delete vinyl record');
                    }
                }
                return response;
            })
            .then(() => {
                // Remove from local array for immediate UI update
                const index = this.vinyls.findIndex(v => v._id === this.vinylToDelete._id);
                if (index !== -1) {
                    this.vinyls.splice(index, 1);
                }
                
                // Close confirmation dialog
                this.showDeleteConfirm = false;
                this.vinylToDelete = null;
                
                this.showSuccess('Vinyl deleted successfully');
            })
            .catch(error => {
                console.error('Error deleting vinyl:', error);
                this.showError(error.message);
            });
        },
        
        // Updates an existing vinyl record
        updateVinyl: function() {
            // Check admin permission and vinyl ID
            if (!this.isAdmin || !this.newVinyl._id) {
                this.showError('Admin privileges required to update vinyl records');
                return;
            }
            
            // Basic validation
            if (!this.newVinyl.album || !this.newVinyl.artist) {
                this.showError('Album and artist are required fields');
                return;
            }
            
            // First upload new image if selected
            let savePromise = Promise.resolve();
            
            if (this.selectedFile) {
                savePromise = this.uploadImage();
            }
            
            // Then update the vinyl record
            savePromise.then(() => {
                fetch(`${API_URL}/vinyls/${this.newVinyl._id}`, {
                    method: 'PUT',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    credentials: 'include',
                    body: JSON.stringify(this.newVinyl)
                })
                .then(response => {
                    if (!response.ok) {
                        if (response.status === 401) {
                            throw new Error('Authentication required');
                        } else if (response.status === 403) {
                            throw new Error('Admin privileges required');
                        } else {
                            throw new Error('Failed to update vinyl record');
                        }
                    }
                    return response.json();
                })
                .then(result => {
                    console.log('Vinyl updated:', result);
                    
                    // Update local array for immediate UI update
                    const index = this.vinyls.findIndex(v => v._id === this.newVinyl._id);
                    if (index !== -1) {
                        this.vinyls[index] = result.vinyl || result;
                    }
                    
                    // Reset form and exit edit mode
                    this.resetVinylForm();
                    this.editMode = false;
                    
                    this.showSuccess('Vinyl updated successfully');
                })
                .catch(error => {
                    console.error('Error updating vinyl:', error);
                    this.showError(error.message);
                });
            })
            .catch(error => {
                console.error('Error in update vinyl flow:', error);
            });
        },
        
        // ---------- AUTHENTICATION ----------
        
        // Handles user login
        login: function() {
            this.loginError = '';
            
            // Validate inputs
            if (!this.loginData.email || !this.loginData.password) {
                this.loginError = 'Please fill in all fields';
                return;
            }
            
            // Send login request to API
            fetch(`${API_URL}/session`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                credentials: 'include', // Includes cookies for session
                body: JSON.stringify({
                    email: this.loginData.email,
                    plainPass: this.loginData.password // Server expects 'plainPass'
                })
            })
            .then(response => {
                if (!response.ok) {
                    throw new Error('Login failed. Please check your credentials.');
                }
                return response;
            })
            .then(() => {
                // After successful login, get user info
                this.checkSession();
                this.loginData = { email: '', password: '' }; // Clear form
                this.showSuccess('Logged in successfully');
            })
            .catch(error => {
                console.error('Login error:', error);
                this.loginError = error.message;
            });
        },
        
        // Handles user registration
        signup: function() {
            this.signupError = '';
            
            // Validate all required inputs
            if (!this.signupData.firstName || !this.signupData.lastName || 
                !this.signupData.userName || !this.signupData.email || 
                !this.signupData.password || !this.signupData.confirmPassword) {
                this.signupError = 'Please fill in all fields';
                return;
            }
            
            // Validate email format with regex
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(this.signupData.email)) {
                this.signupError = 'Please enter a valid email address';
                return;
            }
            
            // Check if passwords match
            if (this.signupData.password !== this.signupData.confirmPassword) {
                this.signupError = 'Passwords do not match';
                return;
            }
            
            // Validate password strength
            if (this.signupData.password.length < 8) {
                this.signupError = 'Password must be at least 8 characters long';
                return;
            }
            
            // Send registration request to API
            fetch(`${API_URL}/users`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    firstName: this.signupData.firstName,
                    lastName: this.signupData.lastName,
                    userName: this.signupData.userName,
                    email: this.signupData.email,
                    plainPass: this.signupData.password // Server expects 'plainPass'
                })
            })
            .then(response => {
                if (!response.ok) {
                    // Handle different error types
                    if (response.status === 409) {
                        throw new Error('Email or username already exists');
                    } else if (response.status === 422) {
                        throw new Error('Invalid data provided');
                    } else {
                        throw new Error('Registration failed. Please try again later.');
                    }
                }
                return response;
            })
            .then(() => {
                // Switch to login view on successful registration
                this.currentView = 'login';
                this.showSuccess('Account created successfully. Please log in.');
                
                // Reset signup form
                this.signupData = {
                    firstName: '',
                    lastName: '',
                    userName: '',
                    email: '',
                    password: '',
                    confirmPassword: ''
                };
            })
            .catch(error => {
                console.error('Registration error:', error);
                this.signupError = error.message;
            });
        },
        
        // Logs out the current user
        logout: function() {
            fetch(`${API_URL}/session`, {
                method: 'DELETE',
                credentials: 'include'
            })
            .then(() => {
                // Clear user data and collections
                this.user = null;
                this.isAdmin = false;
                this.showMenu = false;
                this.userCollection = [];
                this.userWantList = [];
                this.userRatings = {};
                this.activeTab = 'all';
                this.showSuccess('Logged out successfully');
            })
            .catch(error => {
                console.error("Logout error:", error);
                this.showError('Failed to log out');
            });
        },
        
        // Checks for active session (already logged in)
        checkSession: function() {
            fetch(`${API_URL}/session`, {
                credentials: 'include'
            })
            .then(response => {
                if (!response.ok) {
                    throw new Error('Not authenticated');
                }
                return response.json();
            })
            .then(user => {
                console.log("User session info:", user);
                this.user = user;
                this.isAdmin = user.isAdmin || false;
                this.currentView = 'main';
                
                // Load user collections from local storage
                this.loadUserCollections();
            })
            .catch(error => {
                this.user = null;
                this.isAdmin = false;
                console.log("Session check error:", error);
            });
        },
        
        // ---------- DATA LOADING & IMAGE HANDLING ----------
        
        // Loads vinyl records from the API
        loadVinyls: function() {
            fetch(`${API_URL}/vinyls`, {
                credentials: 'include'
            }).then(response => {
                response.json().then((vinyls) => {
                    console.log("Loaded vinyls:", vinyls);
                    this.vinyls = vinyls;
                    
                    // Apply user ratings if logged in
                    if (this.user) {
                        this.applyRatingsToVinyls();
                    }
                });
            })
            .catch(error => {
                console.error("Error loading vinyls:", error);
                this.showError('Failed to load vinyl collection');
            });
        },
        
        // Handles file selection for image upload
        selectFile: function(event) {
            this.selectedFile = event.target.files[0];
            
            // Create a preview of the selected image
            if (this.selectedFile) {
                const reader = new FileReader();
                reader.onload = (e) => {
                    this.imagePreview = e.target.result; // Base64 data URL
                };
                reader.readAsDataURL(this.selectedFile);
            }
        },
        
        // Uploads image to server
        uploadImage: function() {
            if (!this.selectedFile) {
                this.showError('Please select an image first');
                return Promise.reject("No file selected");
            }
            
            this.isUploading = true;
            
            // Create FormData for file upload
            const formData = new FormData();
            formData.append("image", this.selectedFile);
            
            return fetch(`${API_URL}/upload-image`, {
                method: "POST",
                body: formData,
                credentials: 'include'
            })
            .then(response => {
                if (!response.ok) {
                    // Handle different error types
                    if (response.status === 401) {
                        throw new Error("Authentication required");
                    } else if (response.status === 403) {
                        throw new Error("Admin privileges required");
                    } else {
                        throw new Error(`Server error: ${response.status}`);
                    }
                }
                return response.json();
            })
            .then(result => {
                this.isUploading = false;
                if (result.imageUrl) {
                    this.newVinyl.vinylCover = result.imageUrl;
                    return result.imageUrl;
                } else {
                    throw new Error("Failed to get image URL");
                }
            })
            .catch(error => {
                this.isUploading = false;
                console.error("Error uploading image:", error);
                this.showError(error.message);
                throw error; 
            });
        },
        
        // Creates a new vinyl record
        createVinyl: function() {
            // Check admin permission
            if (!this.isAdmin) {
                this.showError('Admin privileges required to add vinyl records');
                return;
            }
            
            // Basic validation
            if (!this.newVinyl.album || !this.newVinyl.artist) {
                this.showError('Album and artist are required fields');
                return;
            }
            
            // First upload the image if available
            let savePromise = Promise.resolve();
            
            if (this.selectedFile) {
                savePromise = this.uploadImage();
            } else if (!this.newVinyl.vinylCover) {
                this.showError('Album cover is required');
                return;
            }
            
            // Then create the vinyl record
            savePromise.then(() => {
                fetch(`${API_URL}/vinyls`, {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json"
                    },
                    credentials: 'include',
                    body: JSON.stringify(this.newVinyl)
                })
                .then(response => {
                    if (!response.ok) {
                        // Handle different error types
                        if (response.status === 401) {
                            throw new Error("Authentication required");
                        } else if (response.status === 403) {
                            throw new Error("Admin privileges required");
                        } else {
                            throw new Error("Failed to create vinyl record");
                        }
                    }
                    return response.json();
                })
                .then(result => {
                    console.log("Vinyl created:", result);
                    
                    // Add to local array for immediate UI update
                    this.vinyls.push(result.vinyl || result);
                    
                    // Reset form
                    this.resetVinylForm();
                    
                    this.showSuccess('Vinyl added successfully');
                })
                .catch(error => {
                    console.error("Error creating vinyl:", error);
                    this.showError(error.message);
                });
            })
            .catch(error => {
                console.error("Error in create vinyl flow:", error);
            });
        },
        
        // ---------- UI INTERACTIONS ----------
        
        // Toggles the admin panel visibility
        toggleAdminPanel: function() {
            // Reset form when toggling panel
            if (!this.showAdminPanel) {
                this.resetVinylForm();
                this.editMode = false;
            }
            
            this.showAdminPanel = !this.showAdminPanel;
            this.showMenu = false;
        },
        
        // ---------- NOTIFICATIONS ----------
        
        // Shows an error message toast
        showError: function(message) {
            this.errorMessage = message;
            // Auto-clear after 5 seconds
            setTimeout(() => {
                if (this.errorMessage === message) {
                    this.errorMessage = '';
                }
            }, 5000);
        },
        
        // Shows a success message toast
        showSuccess: function(message) {
            this.successMessage = message;
            // Auto-clear after 5 seconds
            setTimeout(() => {
                if (this.successMessage === message) {
                    this.successMessage = '';
                }
            }, 5000);
        }
    },
    
    // Mounted lifecycle hook - called after DOM is mounted
    mounted: function() {
        // Handle clicks outside the menu to close it
        document.addEventListener('click', (event) => {
            if (this.showMenu && 
                !event.target.closest('.side-menu') && 
                !event.target.closest('#menuButton')) {
                this.showMenu = false;
            }
        });
    },
    
    created: function() {
        // Check if we have an active session
        this.checkSession();
        
        // Load vinyl collection
        this.loadVinyls();
    }
}).mount('#app'); 