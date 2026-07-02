// DiscList — My Collection page.
// Crate browser over the live catalog: search, artist/version filters and
// sorting are all derived from the /vinyls data. The "My Collection" tab
// shows the logged-in user's records (login-gated, like the original app).

DiscList.createApp({
    data: function () {
        return {
            activeTab: 'all',    // 'all' | 'mine'
            searchQuery: '',
            filterArtist: '',
            filterVersion: '',
            sortBy: 'newest'     // 'newest' | 'albumAsc' | 'artistAsc'
        };
    },

    computed: {
        // Distinct artists in the catalog (for the filter dropdown)
        uniqueArtists: function () {
            const seen = new Set();
            const artists = [];
            this.vinyls.forEach(v => {
                if (!v.artist) return;
                const key = v.artist.trim().toLowerCase();
                if (!seen.has(key)) { seen.add(key); artists.push(v.artist.trim()); }
            });
            return artists.sort((a, b) => a.localeCompare(b));
        },

        // Distinct versions in the catalog (for the filter dropdown)
        uniqueVersions: function () {
            const seen = new Set();
            const versions = [];
            this.vinyls.forEach(v => {
                if (!v.vinylVersion) return;
                const key = v.vinylVersion.trim().toLowerCase();
                if (!seen.has(key)) { seen.add(key); versions.push(v.vinylVersion.trim()); }
            });
            return versions.sort((a, b) => a.localeCompare(b));
        },

        hasActiveFilters: function () {
            return !!(this.searchQuery || this.filterArtist || this.filterVersion);
        },

        // Tab scope -> search -> dropdown filters -> sort
        displayedVinyls: function () {
            let list = this.vinyls;

            if (this.activeTab === 'mine') {
                list = list.filter(v => this.isInCollection(v));
            }

            if (this.searchQuery) {
                const q = this.searchQuery.toLowerCase();
                list = list.filter(v =>
                    (v.album && v.album.toLowerCase().includes(q)) ||
                    (v.artist && v.artist.toLowerCase().includes(q)) ||
                    (v.vinylVersion && v.vinylVersion.toLowerCase().includes(q))
                );
            }

            if (this.filterArtist) {
                const fa = this.filterArtist.toLowerCase();
                list = list.filter(v => v.artist && v.artist.trim().toLowerCase() === fa);
            }

            if (this.filterVersion) {
                const fv = this.filterVersion.toLowerCase();
                list = list.filter(v => v.vinylVersion && v.vinylVersion.trim().toLowerCase() === fv);
            }

            const sorted = [...list];
            if (this.sortBy === 'albumAsc') {
                sorted.sort((a, b) => (a.album || '').localeCompare(b.album || ''));
            } else if (this.sortBy === 'artistAsc') {
                sorted.sort((a, b) => (a.artist || '').localeCompare(b.artist || ''));
            } else {
                sorted.sort((a, b) => String(b._id).localeCompare(String(a._id)));
            }
            return sorted;
        }
    },

    methods: {
        // Switching to "My Collection" requires a login, same as before
        setTab: function (tab) {
            this.activeTab = tab;
            if (tab === 'mine' && !this.user) this.showLoginForm();
        }
    }
});
