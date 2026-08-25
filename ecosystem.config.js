// One process, no cluster. pm2's default exec_mode is "fork" and it is stated
// explicitly here because it is the point of this file: a single process on a
// single core. The other apps on this box run a Master/Slave pair, where the
// cluster-mode Slave is exactly why a separate Master has to exist — every
// cluster worker would otherwise start its own copy of the background timers.
// This site has no timers, no cron and no sockets to coordinate, so one
// process is the whole app.
//
// Port is pinned to 1437 — slou's own slot on this box. The neighbours:
//   1337        chess game Master/Slave
//   1339        chessarena Master
//   1429        gridess
//   4005/4006   matchess MK_Slave / MK_Master
// Sails reads PORT from the environment on its own (sails/lib/app/configuration/
// load.js), so this works on a fresh clone even though config/local.js — which
// also sets a port — is gitignored and not deployed with the repo.
//
// The process is named for the project: pm2 names are global on the machine,
// and the neighbouring apps have already taken Master/Slave.
//
// Start with:
//   pm2 startOrReload ecosystem.config.js
// Never `pm2 start all` / `pm2 stop all` — those would take the neighbouring
// production apps down with this one.

module.exports = {
  apps: [
    {
      name: 'slou',
      script: 'app.js',
      log_date_format: 'YYYY-MM-DD HH:mm Z',

      // Kept for consistency with the other apps on this box, which key their
      // scheduled work off argv[2] === 'master'. Nothing in slou reads it
      // today — there is no cron and no background job — so it is a label
      // rather than a switch, and the flag to reach for if one is ever added.
      args: ['master'],

      // One instance, fork mode: one core, one process, one set of logs.
      instances: 1,
      exec_mode: 'fork',

      autorestart: true,
      watch: false,

      // Generous for what this is — a static-config site with no database.
      // Set as a runaway backstop, not as an expected working set.
      max_memory_restart: '1G',

      env: {
        PORT: 1437,
        NODE_ENV: 'production',
      },
    },
  ],
};
