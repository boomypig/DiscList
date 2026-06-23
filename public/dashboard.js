// VinylVault — Dashboard page.
// Standalone Vue app that reads the same /vinyls API as the main app.
// Everything shown here is derived from real catalog data — no invented
// metrics (prices, fake activity, etc.).

const API_URL = window.location.hostname === 'localhost'
    ? 'http://localhost:8080'
    : 'https://disklist-0c5x.onrender.com';

Vue.createApp({
    data: function () {
        return {
            vinyls: [],       // all records from the catalog
            user: null,       // current session user (for the sidebar name)
            isLoading: true
        };
    },

    computed: {
        // Name shown in the sidebar user card
        displayName: function () {
            return this.user ? this.user.firstName : 'The Vault';
        },

        // Total number of records in the catalog
        totalRecords: function () {
            return this.vinyls.length;
        },

        // Distinct artists across the catalog
        artistCount: function () {
            const set = new Set();
            this.vinyls.forEach(v => { if (v.artist) set.add(v.artist.trim().toLowerCase()); });
            return set.size;
        },

        // Newest-first ordering. MongoDB ObjectIds are time-ordered, so a
        // descending id sort approximates most-recently-added.
        sortedByNewest: function () {
            return [...this.vinyls].sort((a, b) => String(b._id).localeCompare(String(a._id)));
        },

        // The single record featured in the "Now Spinning" card
        featured: function () {
            return this.sortedByNewest[0] || null;
        },

        // Up to 5 most-recently-added records for the cover row
        recentlyAdded: function () {
            return this.sortedByNewest.slice(0, 5);
        },

        // Recent activity = the most recently added records, newest first.
        // Honest feed of real catalog additions, no fabricated timestamps.
        activity: function () {
            return this.sortedByNewest.slice(0, 4);
        }
    },

    methods: {
        loadVinyls: function () {
            this.isLoading = true;
            fetch(`${API_URL}/vinyls`, { credentials: 'include' })
                .then(res => res.json())
                .then(vinyls => { this.vinyls = Array.isArray(vinyls) ? vinyls : []; })
                .catch(err => { console.error('Error loading vinyls:', err); })
                .finally(() => { this.isLoading = false; });
        },

        // Best-effort session lookup so the sidebar can greet the user.
        // Silently ignores a missing session — the dashboard works logged out.
        checkSession: function () {
            fetch(`${API_URL}/session`, { credentials: 'include' })
                .then(res => res.ok ? res.json() : null)
                .then(user => { if (user) this.user = user; })
                .catch(() => { /* not logged in — fine */ });
        }
    },

    created: function () {
        this.checkSession();
        this.loadVinyls();
    }
}).mount('#dashboard');
