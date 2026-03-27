/**
 * holiday router
 */

export default {
  routes: [
    {
      method: 'GET',
      path: '/holidays',
      handler: 'holiday.find',
      config: {
        auth: {
          scope: ['employee', 'manager', 'admin']
        }
      }
    },
    {
      method: 'POST',
      path: '/holidays',
      handler: 'holiday.create',
      config: {
        auth: {
          scope: ['manager', 'admin']
        }
      }
    },
    {
      method: 'PUT',
      path: '/holidays/:id',
      handler: 'holiday.update',
      config: {
        auth: {
          scope: ['manager', 'admin']
        }
      }
    },
    {
      method: 'DELETE',
      path: '/holidays/:id',
      handler: 'holiday.delete',
      config: {
        auth: {
          scope: ['manager', 'admin']
        }
      }
    },
    {
      method: 'GET',
      path: '/holidays/year/:year',
      handler: 'holiday.getByYear',
      config: {
        auth: {
          scope: ['employee', 'manager', 'admin']
        }
      }
    },
    {
      method: 'GET',
      path: '/holidays/next',
      handler: 'holiday.getNext',
      config: {
        auth: {
          scope: ['employee', 'manager', 'admin']
        }
      }
    },
    {
      method: 'GET',
      path: '/holidays/check/:date',
      handler: 'holiday.isHoliday',
      config: {
        auth: {
          scope: ['employee', 'manager', 'admin']
        }
      }
    },
    {
      method: 'POST',
      path: '/holidays/:id/users',
      handler: 'holiday.addUsers',
      config: {
        auth: {
          scope: ['manager', 'admin']
        }
      }
    },
    {
      method: 'DELETE',
      path: '/holidays/:id/users',
      handler: 'holiday.removeUsers',
      config: {
        auth: {
          scope: ['manager', 'admin']
        }
      }
    }
  ]
};