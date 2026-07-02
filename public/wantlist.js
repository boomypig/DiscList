// DiscList — Wantlist page.
// Everything here is the logged-in user's real wantlist (localStorage ids
// resolved against the live /vinyls catalog). "High priority" is a real,
// per-user starred flag persisted alongside the wantlist — nothing staged.

DiscList.createApp({
    computed: {
        // Wantlist ids resolved to vinyl records, preserving the order the
        // user added them (userWantList is insertion-ordered).
        wantlistVinyls: function () {
            const byId = {};
            this.vinyls.forEach(v => { byId[v._id] = v; });
            return this.userWantList.map(id => byId[id]).filter(Boolean);
        },

        // Last three records hearted, most recent first
        recentWants: function () {
            return [...this.wantlistVinyls].slice(-3).reverse();
        },

        // Starred records, in the order they were starred
        priorityWants: function () {
            return this.wantlistVinyls.filter(v => this.isPriority(v));
        },

        // The rest of the hunt
        otherWants: function () {
            return this.wantlistVinyls.filter(v => !this.isPriority(v));
        },

        // Featured grail = the first record the user starred
        featuredWant: function () {
            return this.priorityWants[0] || null;
        }
    }
});
