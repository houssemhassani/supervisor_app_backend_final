/**
 * break router
 */

export default {
  routes: [
    {
      method: 'GET',
      path: '/breaks',
      handler: 'break.find',
      config: {
        auth: {
          scope: ['employee', 'manager', 'admin']
        }
      }
    },
    {
      method: 'POST',
      path: '/breaks',
      handler: 'break.create',
      config: {
        auth: {
          scope: ['employee', 'manager', 'admin']
        }
      }
    },
    {
      method: 'PUT',
      path: '/breaks/:id',
      handler: 'break.update',
      config: {
        auth: {
          scope: ['employee', 'manager', 'admin']
        }
      }
    },
    {
      method: 'DELETE',
      path: '/breaks/:id',
      handler: 'break.delete',
      config: {
        auth: {
          scope: ['manager', 'admin']
        }
      }
    },
    {
      method: 'POST',
      path: '/breaks/start',
      handler: 'break.start',
      config: {
        auth: {
          scope: ['employee', 'manager', 'admin']
        }
      }
    },
    {
      method: 'PUT',
      path: '/breaks/end',
      handler: 'break.end',
      config: {
        auth: {
          scope: ['employee', 'manager', 'admin']
        }
      }
    },
    {
      method: 'GET',
      path: '/breaks/active',
      handler: 'break.getActive',
      config: {
        auth: {
          scope: ['employee', 'manager', 'admin']
        }
      }
    },
    {
      method: 'GET',
      path: '/breaks/today',
      handler: 'break.getToday',
      config: {
        auth: {
          scope: ['employee', 'manager', 'admin']
        }
      }
    }
  ]
};