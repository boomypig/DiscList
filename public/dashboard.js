// DiscList — Dashboard page.
// Shared behavior (auth, catalog, collections, modals) lives in
// disclist-core.js; this file only adds the dashboard's derived views.

DiscList.createApp({
    computed: {
        // Featured record in "Now Spinning" = most recently added
        featured: function () {
            return this.sortedByNewest[0] || null;
        },

        // Cover row of the newest additions
        recentlyAdded: function () {
            return this.sortedByNewest.slice(0, 5);
        },

        // Recent activity = real most-recently-added records
        activity: function () {
            return this.sortedByNewest.slice(0, 4);
        }
    }
});
