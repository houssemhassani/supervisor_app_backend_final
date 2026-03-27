/**
 * project router
 */

export default {
  routes: [
    {
      method: 'GET',
      path: '/projects',
      handler: 'project.find',
      config: {
        auth: {
          enabled: true,
          strategies: ['jwt']
        }
      }
    },
    {
      method: 'POST',
      path: '/projects',
      handler: 'project.create',
      config: {
        auth:  {
          enabled: true,
          strategies: ['jwt']
        }
      }
    },
    {
      method: 'PUT',
      path: '/projects/:id',
      handler: 'project.update',
      config: {
        auth:  {
          enabled: true,
          strategies: ['jwt']
        }
      }
    },
    {
      method: 'DELETE',
      path: '/projects/:id',
      handler: 'project.delete',
      config: {
        auth:  {
          enabled: true,
          strategies: ['jwt']
        }
      }
    },
    {
      method: 'POST',
      path: '/projects/:id/members',
      handler: 'project.addMembers',
      config: {
        auth:  {
          enabled: true,
          strategies: ['jwt']
        }
      }
    },
    {
      method: 'DELETE',
      path: '/projects/:id/members',
      handler: 'project.removeMembers',
      config: {
        auth:  {
          enabled: true,
          strategies: ['jwt']
        }
      }
    },
    {
      method: 'GET',
      path: '/projects/user/:userId',
      handler: 'project.getUserProjects',
      config: {
        auth: {
          enabled: true,
          strategies: ['jwt']
        }
      }
    },
    {
      method: 'GET',
      path: '/projects/active',
      handler: 'project.getActiveProjects',
      config: {
        auth:  {
          enabled: true,
          strategies: ['jwt']
        }
      }
    },
    {
      method: 'GET',
      path: '/projects/stats',
      handler: 'project.getStats',
      config: {
        auth:  {
          enabled: true,
          strategies: ['jwt']
        }
      }
    }
  ]
};