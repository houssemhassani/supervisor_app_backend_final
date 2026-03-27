/**
 * overtime-request router
 */

export default {
  routes: [
    {
      method: 'GET',
      path: '/overtime-requests',
      handler: 'overtime-request.find',
      config: {
        auth: {
          enabled: true,
          strategies: ['jwt']
        }
      }
    },
    {
      method: 'POST',
      path: '/overtime-requests',
      handler: 'overtime-request.create',
      config: {
        auth: {
          enabled: true,
          strategies: ['jwt']
        }
      }
    },
    {
      method: 'PUT',
      path: '/overtime-requests/:id',
      handler: 'overtime-request.update',
      config: {
        auth: {
          enabled: true,
          strategies: ['jwt']
        }
      }
    },
    {
      method: 'DELETE',
      path: '/overtime-requests/:id',
      handler: 'overtime-request.delete',
      config: {
        auth: {
          enabled: true,
          strategies: ['jwt']
        }
      }
    },
    {
      method: 'POST',
      path: '/overtime-requests/:id/approve',
      handler: 'overtime-request.approve',
      config: {
        auth:  {
          enabled: true,
          strategies: ['jwt']
        }
      }
    },
    {
      method: 'POST',
      path: '/overtime-requests/:id/reject',
      handler: 'overtime-request.reject',
      config: {
        auth: {
          enabled: true,
          strategies: ['jwt']
        }
      }
    },
    {
      method: 'GET',
      path: '/overtime-requests/by-period',
      handler: 'overtime-request.getByPeriod',
      config: {
        auth: {
          enabled: true,
          strategies: ['jwt']
        }
      }
    },
    {
      method: 'GET',
      path: '/overtime-requests/monthly-total',
      handler: 'overtime-request.getMonthlyTotal',
      config: {
        auth: {
          enabled: true,
          strategies: ['jwt']
        }
      }
    },
    {
      method: 'GET',
      path: '/overtime-requests/remaining-hours',
      handler: 'overtime-request.getRemainingHours',
      config: {
        auth:  {
          enabled: true,
          strategies: ['jwt']
        }
      }
    }
  ]
};