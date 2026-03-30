// src/api/task/routes/task.ts
export default {
  routes: [
    {
      method: 'GET',
      path: '/tasks',
      handler: 'task.find',
      config: {
        auth: false/* {
          enabled: true,
          strategies: ['jwt']
        } */
      }
    },
    {
  method: 'GET',
  path: '/tasks/public',
  handler: 'task.publicFind',
  config: {
    auth: false
  }
},
// src/api/task/routes/task.ts
{
  method: 'GET',
  path: '/tasks/user',
  handler: 'task.getUserTasks',
  config: {
    auth: false
  }
},
    {
      method: 'POST',
      path: '/tasks',
      handler: 'task.create',
      config: {
        auth: false/* {
          enabled: true,
          strategies: ['jwt']
        } */
      }
    },
    {
      method: 'PUT',
      path: '/tasks/:id',
      handler: 'task.update',
      config: {
        auth: false/* {
          enabled: true,
          strategies: ['jwt']
        } */
      }
    },
    {
      method: 'DELETE',
      path: '/tasks/:id',
      handler: 'task.delete',
      config: {
        auth: false/* {
          enabled: true,
          strategies: ['jwt']
        } */
      }
    },
    {
      method: 'GET',
      path: '/tasks/my-tasks',
      handler: 'task.getMyTasks',
      config: {
        auth:false /* {
          enabled: true,
          strategies: ['jwt']
        } */
      }
    },
    {
      method: 'GET',
      path: '/tasks/project/:projectId',
      handler: 'task.getProjectTasks',
      config: {
        auth: false/* {
          enabled: true,
          strategies: ['jwt']
        } */
      }
    },
    {
      method: 'GET',
      path: '/tasks/my-stats',
      handler: 'task.getMyStats',
      config: {
        auth: false/* {
          enabled: true,
          strategies: ['jwt']
        } */
      }
    },
    {
      method: 'PUT',
      path: '/tasks/:id/status',
      handler: 'task.changeStatus',
      config: {
        auth: false/* {
          enabled: true,
          strategies: ['jwt']
        } */
      }
    }
  ]
};