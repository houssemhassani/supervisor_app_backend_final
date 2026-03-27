// src/api/dashboard/routes/dashboard.ts
export default {
  routes: [
    // Routes d'attendance
    {
      method: 'GET',
      path: '/dashboard/today',
      handler: 'dashboard.getToday',
      config: {
        auth: false
      }
    },
    {
      method: 'GET',
      path: '/dashboard/weekly-stats',
      handler: 'dashboard.getWeeklyStats',
      config: {
        auth: false
      }
    },
    {
      method: 'POST',
      path: '/dashboard/check-in',
      handler: 'dashboard.checkIn',
      config: {
        auth: false
      }
    },
    {
      method: 'PUT',
      path: '/dashboard/check-out',
      handler: 'dashboard.checkOut',
      config: {
        auth: false
      }
    },
    // Routes pour les pauses
    {
      method: 'POST',
      path: '/dashboard/break/start',
      handler: 'dashboard.startBreak',
      config: {
        auth: false
      }
    },
    {
      method: 'PUT',
      path: '/dashboard/break/end',
      handler: 'dashboard.endBreak',
      config: {
        auth: false
      }
    },
    {
      method: 'GET',
      path: '/dashboard/break/active',
      handler: 'dashboard.getActiveBreak',
      config: {
        auth: false
      }
    }
  ]
};