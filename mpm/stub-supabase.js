/* MasterPlanMapping: replaces the Supabase client that upstream's main.js expects.
 * Upstream's comments feature writes to the original author's database. This fork
 * has no backend of its own, so every call resolves to "no data" and nothing leaves the browser. */
(function () {
  function query() {
    var q = {
      select: function () { return q; },
      eq: function () { return q; },
      insert: function () { return q; },
      then: function (cb) { cb({ data: [], error: null }); return q; }
    };
    return q;
  }
  window.supabase = { createClient: function () { return { from: query }; } };
})();
