/**
 * leave-request router
 */

export default {
  routes: [
    {
      method: 'GET',
      path: '/leave-requests',
      handler: 'leave-request.find',
      config: {
        auth: {
          enabled: false  // Désactivé pour le test
        },
        policies: [],
        middlewares: []
      }
    },
    {
      method: 'GET',
      path: '/leave-requests/test',
      handler: 'leave-request.test',
      config: {
        auth: {
          enabled: false  // Désactivé pour le test
        },
        policies: [],
        middlewares: []
      }
    },
    {
      method: 'POST',
      path: '/leave-requests',
      handler: 'leave-request.create',
      config: {
        auth: {
          enabled: true  // ← Activé pour la création (nécessite token)
        },
        policies: [],
        middlewares: []
      }
    },
    {
      method: 'PUT',
      path: '/leave-requests/:id',
      handler: 'leave-request.update',
      config: {
        auth: {
          enabled: true  // Activé
        },
        policies: [],
        middlewares: []
      }
    },
    {
      method: 'DELETE',
      path: '/leave-requests/:id',
      handler: 'leave-request.delete',
      config: {
        auth: {
          enabled: false  // Activé
        }
      }
    },
    {
      method: 'POST',
      path: '/leave-requests/:id/approve',
      handler: 'leave-request.approve',
      config: {
        auth: {
          enabled: false  // Activé (seuls managers/admins)
        },
        policies: [],
        middlewares: []
      }
    },
    {
      method: 'POST',
      path: '/leave-requests/:id/reject',
      handler: 'leave-request.reject',
      config: {
        auth: {
          enabled: false  // Activé (seuls managers/admins)
        },
        policies: [],
        middlewares: []
      }
    }
  ]
};