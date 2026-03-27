/**
 * time-log router
 */

export default {
  routes: [
    {
      method: 'GET',
      path: '/time-logs',
      handler: 'time-log.find',
      config: {
        auth: {
          enabled: true,
          strategies: ['jwt']
        }
      }
    },
    {
      method: 'POST',
      path: '/time-logs',
      handler: 'time-log.create',
      config: {
        auth: {
          enabled: true,
          strategies: ['jwt']
        }
      }
    },
    {
      method: 'PUT',
      path: '/time-logs/:id',
      handler: 'time-log.update',
      config: {
        auth:  {
          enabled: true,
          strategies: ['jwt']
        }
      }
    },
    {
      method: 'DELETE',
      path: '/time-logs/:id',
      handler: 'time-log.delete',
      config: {
        auth:  {
          enabled: true,
          strategies: ['jwt']
        }
      }
    },
    {
      method: 'POST',
      path: '/time-logs/start-session',
      handler: 'time-log.startSession',
      config: {
        auth:  {
          enabled: true,
          strategies: ['jwt']
        }
      }
    },
    {
      method: 'PUT',
      path: '/time-logs/:id/end-session',
      handler: 'time-log.endSession',
      config: {
        auth:  {
          enabled: true,
          strategies: ['jwt']
        }
      }
    },
    {
      method: 'GET',
      path: '/time-logs/active-session',
      handler: 'time-log.getActiveSession',
      config: {
        auth: {
          enabled: true,
          strategies: ['jwt']
        }
      }
    },
    {
      method: 'GET',
      path: '/time-logs/stats',
      handler: 'time-log.getStats',
      config: {
        auth: {
          enabled: true,
          strategies: ['jwt']
        }
      }
    }
  ]
};