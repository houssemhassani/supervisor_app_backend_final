// src/api/task/routes/task.ts
export default {
  routes: [
    {
      method: 'GET',
      path: '/tasks',
      handler: 'task.find',
      config: {
        auth: {
          enabled: true,
          strategies: ['jwt']
        }
      }
    },
    {
      method: 'POST',
      path: '/tasks',
      handler: 'task.create',
      config: {
        auth: {
          enabled: true,
          strategies: ['jwt']
        }
      }
    },
    {
      method: 'PUT',
      path: '/tasks/:id',
      handler: 'task.update',
      config: {
        auth: {
          enabled: true,
          strategies: ['jwt']
        }
      }
    },
    {
      method: 'DELETE',
      path: '/tasks/:id',
      handler: 'task.delete',
      config: {
        auth: {
          enabled: true,
          strategies: ['jwt']
        }
      }
    },
    {
      method: 'GET',
      path: '/tasks/my-tasks',
      handler: 'task.getMyTasks',
      config: {
        auth: {
          enabled: true,
          strategies: ['jwt']
        }
      }
    },
    {
      method: 'GET',
      path: '/tasks/project/:projectId',
      handler: 'task.getProjectTasks',
      config: {
        auth: {
          enabled: true,
          strategies: ['jwt']
        }
      }
    },
    {
      method: 'GET',
      path: '/tasks/my-stats',
      handler: 'task.getMyStats',
      config: {
        auth: {
          enabled: true,
          strategies: ['jwt']
        }
      }
    },
    {
      method: 'PUT',
      path: '/tasks/:id/status',
      handler: 'task.changeStatus',
      config: {
        auth: {
          enabled: true,
          strategies: ['jwt']
        }
      }
    }
  ]
};