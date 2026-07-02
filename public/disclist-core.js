// DiscList — shared core for all pages (Dashboard, Collection, Wantlist).
// Holds the auth flow, catalog loading, per-user collection/wantlist/rating
// persistence, the detail + admin modals, and toasts, plus the shared UI
// pieces (sidebar, auth screens, modals) as Vue components so every page
// behaves identically. Pages call DiscList.createApp({...}) with their own
// computed/methods and provide their main content in HTML.

const API_URL = window.location.hostname === 'localhost'
    ? 'http://localhost:8080'
    : 'https://disklist-0c5x.onrender.com';

const DiscList = (function () {

    // ---------- shared reactive state ----------
    function baseData() {
        return {
            // 'main' shows the page, 'login'/'signup' show auth screens
            currentView: 'main',

            // Catalog
            vinyls: [],
            isLoading: true,

            // Auth
            user: null,
            isAdmin: false,
            loginData: { email: '', password: '' },
            signupData: { firstName: '', lastName: '', userName: '', email: '', password: '', confirmPassword: '' },
            loginError: '',
            signupError: '',
            isLoggingIn: false,
            isSigningUp: false,

            // Per-user lists (localStorage, same keys as the original app)
            userCollection: [],
            userWantList: [],
            userRatings: {},
            userPriority: [],   // wantlist ids the user starred as high priority

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
    }

    // ---------- shared computed ----------
    const baseComputed = {
        displayName: function () {
            return this.user ? this.user.firstName : 'Guest';
        },
        totalRecords: function () {
            return this.vinyls.length;
        },
        artistCount: function () {
            const set = new Set();
            this.vinyls.forEach(v => { if (v.artist) set.add(v.artist.trim().toLowerCase()); });
            return set.size;
        },
        // Newest-first (ObjectIds are time-ordered)
        sortedByNewest: function () {
            return [...this.vinyls].sort((a, b) => String(b._id).localeCompare(String(a._id)));
        }
    };

    // ---------- shared methods ----------
    const baseMethods = {
        // ----- view / auth nav -----
        showLoginForm: function () { this.currentView = 'login'; },
        backToBrowsing: function () {
            this.currentView = 'main';
            this.loginError = '';
            this.signupError = '';
        },

        // ----- collection / wantlist -----
        isInCollection: function (vinyl) { return this.userCollection.includes(vinyl._id); },
        isInWantList: function (vinyl) { return this.userWantList.includes(vinyl._id); },
        isPriority: function (vinyl) { return this.userPriority.includes(vinyl._id); },

        // Remove an id from the wantlist (and its priority flag with it)
        _removeWant: function (id) {
            const i = this.userWantList.indexOf(id);
            if (i !== -1) this.userWantList.splice(i, 1);
            const p = this.userPriority.indexOf(id);
            if (p !== -1) this.userPriority.splice(p, 1);
        },

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
                if (this.isInWantList(vinyl)) this._removeWant(vinyl._id);
                this.showSuccess('Added to your collection');
            }
            this.saveUserCollections();
        },

        toggleWantList: function (vinyl) {
            if (!this.user) { this.showLoginForm(); return; }

            if (this.isInWantList(vinyl)) {
                this._removeWant(vinyl._id);
                this.showSuccess('Removed from your wantlist');
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

        // Star / unstar a wantlist record as high priority
        togglePriority: function (vinyl) {
            if (!this.user) { this.showLoginForm(); return; }
            const i = this.userPriority.indexOf(vinyl._id);
            if (i !== -1) {
                this.userPriority.splice(i, 1);
            } else {
                this.userPriority.push(vinyl._id);
                this.showSuccess('Marked as high priority');
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

        saveUserCollections: function () {
            if (!this.user) return;
            localStorage.setItem(`disclist_collection_${this.user._id}`, JSON.stringify(this.userCollection));
            localStorage.setItem(`disclist_wantlist_${this.user._id}`, JSON.stringify(this.userWantList));
            localStorage.setItem(`disclist_ratings_${this.user._id}`, JSON.stringify(this.userRatings));
            localStorage.setItem(`disclist_priority_${this.user._id}`, JSON.stringify(this.userPriority));
        },
        loadUserCollections: function () {
            if (!this.user) return;
            const c = localStorage.getItem(`disclist_collection_${this.user._id}`);
            const w = localStorage.getItem(`disclist_wantlist_${this.user._id}`);
            const r = localStorage.getItem(`disclist_ratings_${this.user._id}`);
            const p = localStorage.getItem(`disclist_priority_${this.user._id}`);
            this.userCollection = c ? JSON.parse(c) : [];
            this.userWantList = w ? JSON.parse(w) : [];
            this.userRatings = r ? JSON.parse(r) : {};
            this.userPriority = p ? JSON.parse(p) : [];
        },

        // ----- detail modal -----
        viewVinylDetails: function (vinyl) {
            this.selectedVinyl = { ...vinyl };
            if (this.userRatings[vinyl._id]) this.selectedVinyl.userRating = this.userRatings[vinyl._id];
        },

        // ----- admin: add / edit / delete -----
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

        // ----- authentication -----
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
                    this.userPriority = [];
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

        // ----- data -----
        loadVinyls: function () {
            this.isLoading = true;
            fetch(`${API_URL}/vinyls`, { credentials: 'include' })
                .then(res => res.json())
                .then(vinyls => { this.vinyls = Array.isArray(vinyls) ? vinyls : []; })
                .catch(err => { console.error('Error loading vinyls:', err); this.showError('Failed to load collection'); })
                .finally(() => { this.isLoading = false; });
        },

        // ----- toasts -----
        showError: function (message) {
            this.errorMessage = message;
            setTimeout(() => { if (this.errorMessage === message) this.errorMessage = ''; }, 5000);
        },
        showSuccess: function (message) {
            this.successMessage = message;
            setTimeout(() => { if (this.successMessage === message) this.successMessage = ''; }, 5000);
        }
    };

    // ---------- shared UI components ----------
    // Templates reach the page state through $root (aliased as `r`).
    const rootAlias = { computed: { r: function () { return this.$root; } } };

    function registerComponents(app) {

        // Login + signup screens
        app.component('dl-auth', Object.assign({}, rootAlias, {
            template: `
    <div v-if="r.currentView === 'login'" class="auth-page">
        <div class="auth-box">
            <button type="button" class="auth-back" @click="r.backToBrowsing()"><i class="fas fa-arrow-left"></i> Back</button>
            <h1 class="brand auth-brand">DiscList</h1>
            <p class="auth-tagline">Find, collect and share your favorite vinyl records</p>

            <form @submit.prevent="r.login()" class="auth-form">
                <div class="form-group">
                    <label for="loginEmail">Email</label>
                    <input type="email" id="loginEmail" v-model="r.loginData.email" required>
                </div>
                <div class="form-group">
                    <label for="loginPassword">Password</label>
                    <input type="password" id="loginPassword" v-model="r.loginData.password" required>
                </div>
                <div v-if="r.loginError" class="error-message">{{ r.loginError }}</div>
                <button type="submit" class="auth-button" :disabled="r.isLoggingIn">
                    <span v-if="r.isLoggingIn"><i class="fas fa-circle-notch fa-spin"></i> Logging in...</span>
                    <span v-else>Log in</span>
                </button>
            </form>
            <p class="auth-redirect">Don't have an account?
                <a href="#" @click.prevent="r.currentView = 'signup'" class="auth-link">Sign up</a>
            </p>
        </div>
    </div>

    <div v-if="r.currentView === 'signup'" class="auth-page">
        <div class="auth-box">
            <button type="button" class="auth-back" @click="r.backToBrowsing()"><i class="fas fa-arrow-left"></i> Back</button>
            <h1 class="brand auth-brand">DiscList</h1>
            <p class="auth-tagline">Join the vinyl revolution</p>

            <form @submit.prevent="r.signup()" class="auth-form">
                <div class="form-group">
                    <label for="firstName">First Name</label>
                    <input type="text" id="firstName" v-model="r.signupData.firstName" required>
                </div>
                <div class="form-group">
                    <label for="lastName">Last Name</label>
                    <input type="text" id="lastName" v-model="r.signupData.lastName" required>
                </div>
                <div class="form-group">
                    <label for="userName">Username</label>
                    <input type="text" id="userName" v-model="r.signupData.userName" required>
                </div>
                <div class="form-group">
                    <label for="signupEmail">Email</label>
                    <input type="email" id="signupEmail" v-model="r.signupData.email" required>
                </div>
                <div class="form-group">
                    <label for="signupPassword">Password</label>
                    <input type="password" id="signupPassword" v-model="r.signupData.password" required>
                </div>
                <div class="form-group">
                    <label for="confirmPassword">Confirm Password</label>
                    <input type="password" id="confirmPassword" v-model="r.signupData.confirmPassword" required>
                </div>
                <div v-if="r.signupError" class="error-message">{{ r.signupError }}</div>
                <button type="submit" class="auth-button" :disabled="r.isSigningUp">
                    <span v-if="r.isSigningUp"><i class="fas fa-circle-notch fa-spin"></i> Creating...</span>
                    <span v-else>Create Account</span>
                </button>
            </form>
            <p class="auth-redirect">Already have an account?
                <a href="#" @click.prevent="r.currentView = 'login'" class="auth-link">Log in</a>
            </p>
        </div>
    </div>`
        }));

        // Sidebar. `active` marks the current page's nav item.
        app.component('dl-sidebar', Object.assign({ props: ['active'] }, rootAlias, {
            template: `
    <aside class="sidebar">
        <h1 class="brand">DiscList</h1>

        <div class="user-card">
            <div class="user-avatar"><i class="fas fa-record-vinyl"></i></div>
            <div class="user-meta">
                <span class="user-name">{{ r.displayName }}</span>
                <span class="user-count">{{ r.totalRecords }} Records</span>
            </div>
        </div>

        <nav class="nav">
            <a href="dashboard.html" class="nav-item" :class="{ active: active === 'dashboard' }">
                <i class="fas fa-table-cells-large"></i> Dashboard
            </a>
            <a href="collection.html" class="nav-item" :class="{ active: active === 'collection' }">
                <i class="far fa-circle-dot"></i> My Collection
            </a>
            <a href="wantlist.html" class="nav-item" :class="{ active: active === 'wantlist' }">
                <i class="far fa-heart"></i> Wantlist
            </a>
        </nav>

        <div class="sidebar-spacer"></div>

        <button class="add-vinyl-btn" @click="r.handleAddVinyl()">
            <i class="fas fa-plus"></i> Add New Vinyl
        </button>

        <div class="sidebar-footer">
            <a href="#" v-if="!r.user" class="footer-link" @click.prevent="r.showLoginForm()"><i class="fas fa-right-to-bracket"></i> Login</a>
            <a href="#" v-if="r.user" class="footer-link" @click.prevent="r.logout()"><i class="fas fa-right-from-bracket"></i> Logout</a>
            <a href="#" class="footer-link"><i class="fas fa-gear"></i> Settings</a>
            <a href="#" class="footer-link"><i class="fas fa-circle-question"></i> Support</a>
        </div>
    </aside>`
        }));

        // Detail modal + admin add/edit form + delete confirmation
        app.component('dl-modals', Object.assign({}, rootAlias, {
            template: `
    <transition name="modal">
    <div class="modal" v-if="r.selectedVinyl" @click.self="r.selectedVinyl = null">
        <div class="modal-content">
            <button class="close-modal" @click="r.selectedVinyl = null"><i class="fas fa-times"></i></button>
            <div class="detail-view">
                <div class="detail-cover">
                    <img v-if="r.selectedVinyl.vinylCover" :src="r.selectedVinyl.vinylCover" :alt="r.selectedVinyl.album">
                    <div v-else class="art-placeholder"><i class="fas fa-record-vinyl"></i></div>
                </div>
                <div class="detail-info">
                    <h2>{{ r.selectedVinyl.album }}</h2>
                    <p class="detail-artist">{{ r.selectedVinyl.artist }}</p>

                    <div class="tag-row" v-if="r.selectedVinyl.vinylVersion">
                        <span class="tag">{{ r.selectedVinyl.vinylVersion }}</span>
                    </div>

                    <div v-if="r.selectedVinyl.songs" class="detail-row"><span class="detail-label">Songs</span><span>{{ r.selectedVinyl.songs }}</span></div>
                    <div v-if="r.selectedVinyl.upc" class="detail-row"><span class="detail-label">UPC</span><span>{{ r.selectedVinyl.upc }}</span></div>

                    <div class="detail-actions">
                        <button class="detail-btn" :class="{ active: r.isInCollection(r.selectedVinyl) }" @click="r.toggleCollection(r.selectedVinyl)">
                            <i :class="['fas', r.isInCollection(r.selectedVinyl) ? 'fa-check-circle' : 'fa-plus-circle']"></i>
                            {{ r.isInCollection(r.selectedVinyl) ? 'In Collection' : 'Add to Collection' }}
                        </button>
                        <button class="detail-btn" :class="{ active: r.isInWantList(r.selectedVinyl) }" @click="r.toggleWantList(r.selectedVinyl)">
                            <i :class="[r.isInWantList(r.selectedVinyl) ? 'fas' : 'far', 'fa-heart']"></i>
                            {{ r.isInWantList(r.selectedVinyl) ? 'In Wantlist' : 'Add to Wantlist' }}
                        </button>
                    </div>

                    <div v-if="r.user && r.isInCollection(r.selectedVinyl)" class="rating-container">
                        <p class="rating-label">Your rating</p>
                        <div class="rating-stars">
                            <i v-for="n in 5" :key="n" class="fas fa-star"
                               :class="{ filled: n <= (r.userRatings[r.selectedVinyl._id] || 0) }"
                               @click="r.rateVinyl(r.selectedVinyl, n)"></i>
                        </div>
                    </div>

                    <div v-if="r.isAdmin" class="admin-detail-actions">
                        <button class="admin-btn edit" @click="r.editVinyl(r.selectedVinyl)"><i class="fas fa-edit"></i> Edit</button>
                        <button class="admin-btn delete" @click="r.confirmDeleteVinyl(r.selectedVinyl)"><i class="fas fa-trash"></i> Delete</button>
                    </div>
                </div>
            </div>
        </div>
    </div>
    </transition>

    <transition name="modal">
    <div class="modal" v-if="r.showAddForm" @click.self="r.closeAddForm()">
        <div class="modal-content form-modal">
            <button class="close-modal" @click="r.closeAddForm()"><i class="fas fa-times"></i></button>
            <h2 class="form-title">{{ r.editMode ? 'Edit Record' : 'Add New Record' }}</h2>

            <form @submit.prevent="r.submitVinyl()" class="vinyl-form">
                <div class="form-group">
                    <label for="album">Album <span class="required">*</span></label>
                    <input type="text" id="album" v-model="r.newVinyl.album" required>
                </div>
                <div class="form-group">
                    <label for="artist">Artist <span class="required">*</span></label>
                    <input type="text" id="artist" v-model="r.newVinyl.artist" required>
                </div>
                <div class="form-group">
                    <label for="vinylVersion">Version</label>
                    <input type="text" id="vinylVersion" v-model="r.newVinyl.vinylVersion">
                </div>
                <div class="form-row">
                    <div class="form-group">
                        <label for="upc">UPC</label>
                        <input type="number" id="upc" v-model="r.newVinyl.upc">
                    </div>
                    <div class="form-group">
                        <label for="songs">Songs</label>
                        <input type="number" id="songs" v-model="r.newVinyl.songs">
                    </div>
                </div>
                <div class="form-group">
                    <label for="cover">Album Cover <span v-if="!r.editMode" class="required">*</span></label>
                    <input type="file" id="cover" @change="r.selectFile($event)" accept="image/*" :required="!r.editMode && !r.newVinyl.vinylCover">
                    <div v-if="r.imagePreview" class="image-preview"><img :src="r.imagePreview" alt="Preview"></div>
                    <div v-else-if="r.newVinyl.vinylCover && !r.selectedFile" class="image-preview"><img :src="r.newVinyl.vinylCover" alt="Current cover"></div>
                </div>
                <div class="form-actions">
                    <button type="button" class="cancel-button" @click="r.closeAddForm()">Cancel</button>
                    <button type="submit" class="auth-button" :disabled="r.isUploading">
                        <span v-if="r.isUploading">Uploading...</span>
                        <span v-else>{{ r.editMode ? 'Update Record' : 'Add Record' }}</span>
                    </button>
                </div>
            </form>
        </div>
    </div>
    </transition>

    <transition name="modal">
    <div class="modal" v-if="r.showDeleteConfirm" @click.self="r.showDeleteConfirm = false">
        <div class="modal-content confirm-dialog">
            <h2>Confirm Delete</h2>
            <p>Delete "{{ r.vinylToDelete && r.vinylToDelete.album }}" by {{ r.vinylToDelete && r.vinylToDelete.artist }}?</p>
            <p class="warning">This action cannot be undone.</p>
            <div class="confirm-actions">
                <button class="cancel-button" @click="r.showDeleteConfirm = false">Cancel</button>
                <button class="admin-btn delete" @click="r.deleteVinyl()">Delete</button>
            </div>
        </div>
    </div>
    </transition>`
        }));

        // Toast notifications
        app.component('dl-toasts', Object.assign({}, rootAlias, {
            template: `
    <transition name="toast">
    <div v-if="r.errorMessage" class="toast error-toast">
        {{ r.errorMessage }}
        <button @click="r.errorMessage = ''"><i class="fas fa-times"></i></button>
    </div>
    </transition>
    <transition name="toast">
    <div v-if="r.successMessage" class="toast success-toast">
        {{ r.successMessage }}
        <button @click="r.successMessage = ''"><i class="fas fa-times"></i></button>
    </div>
    </transition>`
        }));
    }

    // ---------- app factory ----------
    function createApp(page) {
        page = page || {};

        const options = {
            data: function () {
                return Object.assign(baseData(), page.data ? page.data() : {});
            },
            computed: Object.assign({}, baseComputed, page.computed || {}),
            methods: Object.assign({}, baseMethods, page.methods || {}),
            mounted: function () {
                // Escape backs out of the topmost layer
                document.addEventListener('keydown', (e) => {
                    if (e.key !== 'Escape') return;
                    if (this.selectedVinyl) this.selectedVinyl = null;
                    else if (this.showDeleteConfirm) this.showDeleteConfirm = false;
                    else if (this.showAddForm) this.closeAddForm();
                    else if (this.currentView === 'login' || this.currentView === 'signup') this.backToBrowsing();
                });
                if (page.mounted) page.mounted.call(this);
            },
            created: function () {
                this.checkSession();
                this.loadVinyls();
                if (page.created) page.created.call(this);
            }
        };

        const app = Vue.createApp(options);
        registerComponents(app);
        app.mount('#app');
        return app;
    }

    return { createApp: createApp, API_URL: API_URL };
})();
