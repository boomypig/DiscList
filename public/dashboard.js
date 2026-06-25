// DiscList — Dashboard page.
// Self-contained Vue app for the dashboard. Reads the same /vinyls API and
// reuses the same auth + collection behavior as the original app, so every
// control here actually works (no static mockups). Stats and feeds are
// derived from real catalog data.

const API_URL = window.location.hostname === 'localhost'
    ? 'http://localhost:8080'
    : 'https://disklist-0c5x.onrender.com';

Vue.createApp({
    data: function () {
        return {
            // View: 'main' shows the dashboard, 'login'/'signup' show auth screens
            currentView: 'main',

            // Catalog + loading
            vinyls: [],
            isLoading: true,

            // Auth / user
            user: null,
            isAdmin: false,
            loginData: { email: '', password: '' },
            signupData: { firstName: '', lastName: '', userName: '', email: '', password: '', confirmPassword: '' },
            loginError: '',
            signupError: '',
            isLoggingIn: false,
            isSigningUp: false,

            // Per-user collections (stored in local storage, same as before)
            userCollection: [],
            userWantList: [],
            userRatings: {},

            // Detail modal
            selectedVinyl: null,

            // Admin add/edit
            showAddForm: false,
            editMode: false,
            newVinyl: { vinylVersion: '', album: '', artist: '', upc: '', songs: 0, vinylCover: '' },
            selectedFile: null,
            isUploading: false,
            imagePreview: null,
            showDeleteConfirm: false,
            vinylToDelete: null,

            // Toasts
            errorMessage: '',
            successMessage: ''
        };
    },

    computed: {
        // Sidebar name
        displayName: function () {
            return this.user ? this.user.firstName : 'Guest';
        },

        // Total records in the catalog
        totalRecords: function () {
            return this.vinyls.length;
        },

        // Distinct artists
        artistCount: function () {
            const set = new Set();
            this.vinyls.forEach(v => { if (v.artist) set.add(v.artist.trim().toLowerCase()); });
            return set.size;
        },

        // Newest-first ordering (ObjectIds are time-ordered)
        sortedByNewest: function () {
            return [...this.vinyls].sort((a, b) => String(b._id).localeCompare(String(a._id)));
        },

        // Featured record in "Now Spinning"
        featured: function () {
            return this.sortedByNewest[0] || null;
        },

        // Cover row
        recentlyAdded: function () {
            return this.sortedByNewest.slice(0, 5);
        },

        // Recent activity = real most-recently-added records
        activity: function () {
            return this.sortedByNewest.slice(0, 4);
        }
    },

    methods: {
        // ---------- VIEW / AUTH NAV ----------
        showLoginForm: function () {
            this.currentView = 'login';
        },
        backToBrowsing: function () {
            this.currentView = 'main';
            this.loginError = '';
            this.signupError = '';
        },

        // ---------- COLLECTION / WANT LIST ----------
        toggleCollection: function (vinyl) {
            if (!this.user) { this.showLoginForm(); return; }

            if (this.isInCollection(vinyl)) {
                const i = this.userCollection.indexOf(vinyl._id);
                if (i !== -1) {
                    this.userCollection.splice(i, 1);
                    if (this.userRatings[vinyl._id]) delete this.userRatings[vinyl._id];
                    this.showSuccess('Removed from your collection');
                }
            } else {
                this.userCollection.push(vinyl._id);
                if (this.isInWantList(vinyl)) {
                    const j = this.userWantList.indexOf(vinyl._id);
                    if (j !== -1) this.userWantList.splice(j, 1);
                }
                this.showSuccess('Added to your collection');
            }
            this.saveUserCollections();
        },

        toggleWantList: function (vinyl) {
            if (!this.user) { this.showLoginForm(); return; }

            if (this.isInWantList(vinyl)) {
                const i = this.userWantList.indexOf(vinyl._id);
                if (i !== -1) {
                    this.userWantList.splice(i, 1);
                    this.showSuccess('Removed from your wantlist');
                }
            } else {
                this.userWantList.push(vinyl._id);
                if (this.isInCollection(vinyl)) {
                    const j = this.userCollection.indexOf(vinyl._id);
                    if (j !== -1) this.userCollection.splice(j, 1);
                }
                this.showSuccess('Added to your wantlist');
            }
            this.saveUserCollections();
        },

        rateVinyl: function (vinyl, rating) {
            if (!this.user) { this.showLoginForm(); return; }
            if (rating === this.userRatings[vinyl._id]) rating = 0;

            if (rating > 0) this.userRatings[vinyl._id] = rating;
            else delete this.userRatings[vinyl._id];

            if (this.selectedVinyl && this.selectedVinyl._id === vinyl._id) {
                this.selectedVinyl.userRating = rating || undefined;
            }
            this.saveUserCollections();
        },

        isInCollection: function (vinyl) { return this.userCollection.includes(vinyl._id); },
        isInWantList: function (vinyl) { return this.userWantList.includes(vinyl._id); },

        saveUserCollections: function () {
            if (!this.user) return;
            localStorage.setItem(`disclist_collection_${this.user._id}`, JSON.stringify(this.userCollection));
            localStorage.setItem(`disclist_wantlist_${this.user._id}`, JSON.stringify(this.userWantList));
            localStorage.setItem(`disclist_ratings_${this.user._id}`, JSON.stringify(this.userRatings));
        },
        loadUserCollections: function () {
            if (!this.user) return;
            const c = localStorage.getItem(`disclist_collection_${this.user._id}`);
            const w = localStorage.getItem(`disclist_wantlist_${this.user._id}`);
            const r = localStorage.getItem(`disclist_ratings_${this.user._id}`);
            this.userCollection = c ? JSON.parse(c) : [];
            this.userWantList = w ? JSON.parse(w) : [];
            this.userRatings = r ? JSON.parse(r) : {};
        },

        // ---------- DETAIL MODAL ----------
        viewVinylDetails: function (vinyl) {
            this.selectedVinyl = { ...vinyl };
            if (this.userRatings[vinyl._id]) this.selectedVinyl.userRating = this.userRatings[vinyl._id];
        },

        // ---------- ADD NEW VINYL ----------
        handleAddVinyl: function () {
            if (!this.user) { this.showLoginForm(); return; }
            if (!this.isAdmin) { this.showError('Admin privileges are required to add records'); return; }
            this.resetVinylForm();
            this.editMode = false;
            this.showAddForm = true;
        },

        editVinyl: function (vinyl) {
            if (!this.isAdmin) { this.showError('Admin privileges required to edit records'); return; }
            this.selectedVinyl = null;
            this.editMode = true;
            this.newVinyl = {
                _id: vinyl._id,
                vinylVersion: vinyl.vinylVersion || '',
                album: vinyl.album || '',
                artist: vinyl.artist || '',
                upc: vinyl.upc || '',
                songs: vinyl.songs || 0,
                vinylCover: vinyl.vinylCover || ''
            };
            this.selectedFile = null;
            this.imagePreview = null;
            this.showAddForm = true;
        },

        closeAddForm: function () {
            this.showAddForm = false;
            this.editMode = false;
            this.resetVinylForm();
        },

        resetVinylForm: function () {
            this.newVinyl = { vinylVersion: '', album: '', artist: '', upc: '', songs: 0, vinylCover: '' };
            this.selectedFile = null;
            this.imagePreview = null;
        },

        selectFile: function (event) {
            this.selectedFile = event.target.files[0];
            if (this.selectedFile) {
                const reader = new FileReader();
                reader.onload = e => { this.imagePreview = e.target.result; };
                reader.readAsDataURL(this.selectedFile);
            }
        },

        uploadImage: function () {
            if (!this.selectedFile) {
                this.showError('Please select an image first');
                return Promise.reject('No file selected');
            }
            this.isUploading = true;
            const formData = new FormData();
            formData.append('image', this.selectedFile);
            return fetch(`${API_URL}/upload-image`, { method: 'POST', body: formData, credentials: 'include' })
                .then(res => {
                    if (!res.ok) throw new Error(res.status === 403 ? 'Admin privileges required' : `Server error: ${res.status}`);
                    return res.json();
                })
                .then(result => {
                    this.isUploading = false;
                    if (!result.imageUrl) throw new Error('Failed to get image URL');
                    this.newVinyl.vinylCover = result.imageUrl;
                    return result.imageUrl;
                })
                .catch(err => { this.isUploading = false; this.showError(err.message); throw err; });
        },

        submitVinyl: function () {
            if (this.editMode) this.updateVinyl();
            else this.createVinyl();
        },

        createVinyl: function () {
            if (!this.isAdmin) { this.showError('Admin privileges required'); return; }
            if (!this.newVinyl.album || !this.newVinyl.artist) { this.showError('Album and artist are required'); return; }

            let savePromise = Promise.resolve();
            if (this.selectedFile) savePromise = this.uploadImage();
            else if (!this.newVinyl.vinylCover) { this.showError('Album cover is required'); return; }

            savePromise.then(() => {
                fetch(`${API_URL}/vinyls`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    credentials: 'include',
                    body: JSON.stringify(this.newVinyl)
                })
                .then(res => {
                    if (!res.ok) throw new Error(res.status === 403 ? 'Admin privileges required' : 'Failed to create record');
                    return res.json();
                })
                .then(result => {
                    this.vinyls.push(result.vinyl || result);
                    this.closeAddForm();
                    this.showSuccess('Vinyl added successfully');
                })
                .catch(err => this.showError(err.message));
            }).catch(() => { /* upload failed, already surfaced */ });
        },

        updateVinyl: function () {
            if (!this.isAdmin || !this.newVinyl._id) { this.showError('Admin privileges required'); return; }
            if (!this.newVinyl.album || !this.newVinyl.artist) { this.showError('Album and artist are required'); return; }

            let savePromise = Promise.resolve();
            if (this.selectedFile) savePromise = this.uploadImage();

            savePromise.then(() => {
                fetch(`${API_URL}/vinyls/${this.newVinyl._id}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    credentials: 'include',
                    body: JSON.stringify(this.newVinyl)
                })
                .then(res => {
                    if (!res.ok) throw new Error(res.status === 403 ? 'Admin privileges required' : 'Failed to update record');
                    return res.json();
                })
                .then(result => {
                    const i = this.vinyls.findIndex(v => v._id === this.newVinyl._id);
                    if (i !== -1) this.vinyls[i] = result.vinyl || result;
                    this.closeAddForm();
                    this.showSuccess('Vinyl updated successfully');
                })
                .catch(err => this.showError(err.message));
            }).catch(() => { /* upload failed, already surfaced */ });
        },

        confirmDeleteVinyl: function (vinyl) {
            if (!this.isAdmin) { this.showError('Admin privileges required to delete records'); return; }
            this.vinylToDelete = vinyl;
            this.showDeleteConfirm = true;
            this.selectedVinyl = null;
        },

        deleteVinyl: function () {
            if (!this.isAdmin || !this.vinylToDelete) return;
            fetch(`${API_URL}/vinyls/${this.vinylToDelete._id}`, { method: 'DELETE', credentials: 'include' })
                .then(res => { if (!res.ok) throw new Error('Failed to delete record'); })
                .then(() => {
                    const i = this.vinyls.findIndex(v => v._id === this.vinylToDelete._id);
                    if (i !== -1) this.vinyls.splice(i, 1);
                    this.showDeleteConfirm = false;
                    this.vinylToDelete = null;
                    this.showSuccess('Vinyl deleted successfully');
                })
                .catch(err => this.showError(err.message));
        },

        // ---------- AUTHENTICATION ----------
        login: function () {
            this.loginError = '';
            if (!this.loginData.email || !this.loginData.password) { this.loginError = 'Please fill in all fields'; return; }
            if (this.isLoggingIn) return;
            this.isLoggingIn = true;

            fetch(`${API_URL}/session`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ email: this.loginData.email, plainPass: this.loginData.password })
            })
            .then(res => { if (!res.ok) throw new Error('Login failed. Please check your credentials.'); })
            .then(() => {
                this.checkSession();
                this.loginData = { email: '', password: '' };
                this.currentView = 'main';
                this.showSuccess('Logged in successfully');
            })
            .catch(err => { this.loginError = err.message; })
            .finally(() => { this.isLoggingIn = false; });
        },

        signup: function () {
            this.signupError = '';
            const s = this.signupData;
            if (!s.firstName || !s.lastName || !s.userName || !s.email || !s.password || !s.confirmPassword) {
                this.signupError = 'Please fill in all fields'; return;
            }
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(s.email)) { this.signupError = 'Please enter a valid email address'; return; }
            if (s.password !== s.confirmPassword) { this.signupError = 'Passwords do not match'; return; }
            if (s.password.length < 8) { this.signupError = 'Password must be at least 8 characters long'; return; }
            if (this.isSigningUp) return;
            this.isSigningUp = true;

            fetch(`${API_URL}/users`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    firstName: s.firstName, lastName: s.lastName, userName: s.userName,
                    email: s.email, plainPass: s.password
                })
            })
            .then(res => {
                if (!res.ok) {
                    if (res.status === 409) throw new Error('Email or username already exists');
                    throw new Error('Registration failed. Please try again later.');
                }
            })
            .then(() => {
                this.currentView = 'login';
                this.showSuccess('Account created. Please log in.');
                this.signupData = { firstName: '', lastName: '', userName: '', email: '', password: '', confirmPassword: '' };
            })
            .catch(err => { this.signupError = err.message; })
            .finally(() => { this.isSigningUp = false; });
        },

        logout: function () {
            fetch(`${API_URL}/session`, { method: 'DELETE', credentials: 'include' })
                .then(() => {
                    this.user = null;
                    this.isAdmin = false;
                    this.userCollection = [];
                    this.userWantList = [];
                    this.userRatings = {};
                    this.showSuccess('Logged out successfully');
                })
                .catch(() => this.showError('Failed to log out'));
        },

        checkSession: function () {
            fetch(`${API_URL}/session`, { credentials: 'include' })
                .then(res => { if (!res.ok) throw new Error('Not authenticated'); return res.json(); })
                .then(user => {
                    this.user = user;
                    this.isAdmin = user.isAdmin || false;
                    this.loadUserCollections();
                })
                .catch(() => { this.user = null; this.isAdmin = false; });
        },

        // ---------- DATA ----------
        loadVinyls: function () {
            this.isLoading = true;
            fetch(`${API_URL}/vinyls`, { credentials: 'include' })
                .then(res => res.json())
                .then(vinyls => { this.vinyls = Array.isArray(vinyls) ? vinyls : []; })
                .catch(err => { console.error('Error loading vinyls:', err); this.showError('Failed to load collection'); })
                .finally(() => { this.isLoading = false; });
        },

        // ---------- TOASTS ----------
        showError: function (message) {
            this.errorMessage = message;
            setTimeout(() => { if (this.errorMessage === message) this.errorMessage = ''; }, 5000);
        },
        showSuccess: function (message) {
            this.successMessage = message;
            setTimeout(() => { if (this.successMessage === message) this.successMessage = ''; }, 5000);
        }
    },

    mounted: function () {
        // Escape backs out of the topmost layer
        document.addEventListener('keydown', (e) => {
            if (e.key !== 'Escape') return;
            if (this.selectedVinyl) this.selectedVinyl = null;
            else if (this.showDeleteConfirm) this.showDeleteConfirm = false;
            else if (this.showAddForm) this.closeAddForm();
            else if (this.currentView === 'login' || this.currentView === 'signup') this.backToBrowsing();
        });
    },

    created: function () {
        this.checkSession();
        this.loadVinyls();
    }
}).mount('#dashboard');
