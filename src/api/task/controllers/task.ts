// src/api/task/controllers/task.ts
import { factories } from '@strapi/strapi';

export default factories.createCoreController('api::task.task', ({ strapi }) => ({
  /**
   * Récupérer les tâches (sans authentification requise)
   */
// src/api/task/controllers/task.ts
async find(ctx) {
  // Récupérer l'utilisateur
  let user = ctx.state.user;
  
  if (!user) {
    const authHeader = ctx.request.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      try {
        const jwt = require('jsonwebtoken');
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'my-secret-key');
        user = await strapi.db.query('plugin::users-permissions.user').findOne({
          where: { id: decoded.id }
        });
      } catch (error) {
        console.log('Token invalide ou expiré');
      }
    }
  }
  
  if (!user) {
    console.log('📋 [Task find] Aucun utilisateur trouvé');
    return ctx.send({ data: [] });
  }
  
  console.log('📋 [Task find] Utilisateur:', user.id);
  
  // Utiliser findMany au lieu de super.find pour éviter les doublons
  const tasks = await strapi.db.query('api::task.task').findMany({
    where: {
      assigned_to: { id: user.id }
    },
    populate: {
      assigned_to: {
        select: ['id', 'username', 'email']
      },
      project: {
        select: ['id', 'name', 'description']
      }
    },
    orderBy: { due_date: 'asc' }
  });
  
  return ctx.send({
    data: tasks,
    meta: {
      pagination: {
        page: 1,
        pageSize: tasks.length,
        pageCount: 1,
        total: tasks.length
      }
    }
  });
},
// src/api/task/controllers/task.ts
async publicFind(ctx) {
  try {
    // Récupérer toutes les tâches sans authentification
    const tasks = await strapi.db.query('api::task.task').findMany({
      populate: {
        assigned_to: true,
        project: true
      },
      orderBy: { due_date: 'asc' }
    });
    
    return ctx.send({
      data: tasks,
      meta: { count: tasks.length }
    });
  } catch (error) {
    console.error('Erreur publicFind:', error);
    return ctx.badRequest('Erreur lors de la récupération des tâches');
  }
},
  
  /**
   * Créer une tâche
   */
  async create(ctx) {
    // Récupérer l'utilisateur
    let user = ctx.state.user;
    
    if (!user) {
      const authHeader = ctx.request.headers.authorization;
      if (authHeader && authHeader.startsWith('Bearer ')) {
        const token = authHeader.substring(7);
        try {
          const jwt = require('jsonwebtoken');
          const decoded = jwt.verify(token, process.env.JWT_SECRET || 'my-secret-key');
          user = await strapi.db.query('plugin::users-permissions.user').findOne({
            where: { id: decoded.id }
          });
        } catch (error) {
          console.log('Token invalide ou expiré');
        }
      }
    }
    
    if (!user) {
      return ctx.unauthorized('Vous devez être connecté');
    }
    
    const requestData = ctx.request.body?.data || {};
    
    // Forcer l'assignation à l'utilisateur connecté
    requestData.assigned_to = user.id;
    
    ctx.request.body = { data: requestData };
    
    const response = await super.create(ctx);
    return response;
  },
  
  /**
   * Mettre à jour une tâche
   */
  async update(ctx) {
    // Récupérer l'utilisateur
    let user = ctx.state.user;
    
    if (!user) {
      const authHeader = ctx.request.headers.authorization;
      if (authHeader && authHeader.startsWith('Bearer ')) {
        const token = authHeader.substring(7);
        try {
          const jwt = require('jsonwebtoken');
          const decoded = jwt.verify(token, process.env.JWT_SECRET || 'my-secret-key');
          user = await strapi.db.query('plugin::users-permissions.user').findOne({
            where: { id: decoded.id }
          });
        } catch (error) {
          console.log('Token invalide ou expiré');
        }
      }
    }
    
    if (!user) {
      return ctx.unauthorized('Vous devez être connecté');
    }
    
    const { id } = ctx.params;
    
    // Vérifier si la tâche existe
    const task = await strapi.db.query('api::task.task').findOne({
      where: { id },
      populate: { assigned_to: true }
    });
    
    if (!task) {
      return ctx.notFound('Tâche non trouvée');
    }
    
    // Vérifier les permissions
    if (task.assigned_to?.id !== user.id) {
      return ctx.forbidden('Vous ne pouvez pas modifier cette tâche');
    }
    
    const response = await super.update(ctx);
    return response;
  },
  
  /**
   * Supprimer une tâche
   */
  async delete(ctx) {
    let user = ctx.state.user;
    
    if (!user) {
      const authHeader = ctx.request.headers.authorization;
      if (authHeader && authHeader.startsWith('Bearer ')) {
        const token = authHeader.substring(7);
        try {
          const jwt = require('jsonwebtoken');
          const decoded = jwt.verify(token, process.env.JWT_SECRET || 'my-secret-key');
          user = await strapi.db.query('plugin::users-permissions.user').findOne({
            where: { id: decoded.id }
          });
        } catch (error) {
          console.log('Token invalide ou expiré');
        }
      }
    }
    
    if (!user) {
      return ctx.unauthorized('Vous devez être connecté');
    }
    
    const { id } = ctx.params;
    
    // Vérifier si la tâche existe
    const task = await strapi.db.query('api::task.task').findOne({
      where: { id },
      populate: { assigned_to: true }
    });
    
    if (!task) {
      return ctx.notFound('Tâche non trouvée');
    }
    
    // Vérifier les permissions
    if (task.assigned_to?.id !== user.id) {
      return ctx.forbidden('Vous ne pouvez pas supprimer cette tâche');
    }
    
    const response = await super.delete(ctx);
    return response;
  },
  // src/api/task/controllers/task.ts
// src/api/task/controllers/task.ts
// src/api/task/controllers/task.ts
// src/api/task/controllers/task.ts
/* async getUserTasks(ctx) {
  try {
    console.log('🔍 [getUserTasks] Début');
    
    // Récupérer l'utilisateur
    let user = ctx.state.user;
    
    if (!user) {
      const authHeader = ctx.request.headers.authorization;
      if (authHeader && authHeader.startsWith('Bearer ')) {
        const token = authHeader.substring(7);
        try {
          const jwt = require('jsonwebtoken');
          const decoded = jwt.verify(token, process.env.JWT_SECRET || 'my-secret-key');
          user = await strapi.db.query('plugin::users-permissions.user').findOne({
            where: { id: decoded.id }
          });
        } catch (error) {
          console.log('Token invalide ou expiré:', error.message);
        }
      }
    }
    
    if (!user) {
      console.log('❌ Aucun utilisateur trouvé');
      return ctx.send({ data: [] });
    }
    
    console.log('✅ Utilisateur trouvé:', user.id);
    
    // Requête simple sans populate pour éviter les erreurs
    const tasks = await strapi.db.query('api::task.task').findMany({
      where: {
        assigned_to: user.id
      },
      orderBy: { due_date: 'asc' }
    });
    
    console.log(`📋 ${tasks.length} tâches trouvées`);
    
    // Retourner les tâches sans essayer de charger les relations
    return ctx.send({
      data: tasks,
      meta: { count: tasks.length }
    });
    
  } catch (error) {
    console.error('❌ Erreur dans getUserTasks:', error);
    return ctx.internalServerError('Erreur lors de la récupération des tâches');
  }
}, */
// src/api/task/controllers/task.ts
async getUserTasks(ctx) {
  try {
    console.log('🔍 [getUserTasks] Début');
    
    // Récupérer l'utilisateur
    let user = ctx.state.user;
    
    if (!user) {
      const authHeader = ctx.request.headers.authorization;
      if (authHeader && authHeader.startsWith('Bearer ')) {
        const token = authHeader.substring(7);
        try {
          const jwt = require('jsonwebtoken');
          const decoded = jwt.verify(token, process.env.JWT_SECRET || 'my-secret-key');
          user = await strapi.db.query('plugin::users-permissions.user').findOne({
            where: { id: decoded.id }
          });
        } catch (error) {
          console.log('Token invalide ou expiré:', error.message);
        }
      }
    }
    
    if (!user) {
      console.log('❌ Aucun utilisateur trouvé');
      return ctx.send({ data: [] });
    }
    
    console.log('✅ Utilisateur trouvé:', user.id);
    
    // Récupérer les tâches avec les relations
    const tasks = await strapi.db.query('api::task.task').findMany({
      where: {
        assigned_to: user.id
      },
      populate: {
        assigned_to: true,
        project: true
      },
      orderBy: { due_date: 'asc' }
    });
    
    console.log(`📋 ${tasks.length} tâches trouvées avec relations`);
    
    return ctx.send({
      data: tasks,
      meta: { count: tasks.length }
    });
    
  } catch (error) {
    console.error('❌ Erreur dans getUserTasks:', error);
    return ctx.internalServerError('Erreur lors de la récupération des tâches');
  }
},  
/**
   * Récupérer les tâches de l'utilisateur connecté
   */
  async getMyTasks(ctx) {
    let user = ctx.state.user;
    
    if (!user) {
      const authHeader = ctx.request.headers.authorization;
      if (authHeader && authHeader.startsWith('Bearer ')) {
        const token = authHeader.substring(7);
        try {
          const jwt = require('jsonwebtoken');
          const decoded = jwt.verify(token, process.env.JWT_SECRET || 'my-secret-key');
          user = await strapi.db.query('plugin::users-permissions.user').findOne({
            where: { id: decoded.id }
          });
        } catch (error) {
          console.log('Token invalide ou expiré');
        }
      }
    }
    
    if (!user) {
      return ctx.send({
        success: true,
        data: []
      });
    }
    
    console.log('📋 [getMyTasks] Utilisateur:', user.id);
    
    const tasks = await strapi.db.query('api::task.task').findMany({
      where: {
        assigned_to: { id: user.id }
      },
      populate: ['assigned_to', 'project'],
      orderBy: { due_date: 'asc' }
    });
    
    return ctx.send({
      success: true,
      data: tasks
    });
  },
  
  /**
   * Récupérer les tâches d'un projet spécifique
   */
  async getProjectTasks(ctx) {
    let user = ctx.state.user;
    
    if (!user) {
      const authHeader = ctx.request.headers.authorization;
      if (authHeader && authHeader.startsWith('Bearer ')) {
        const token = authHeader.substring(7);
        try {
          const jwt = require('jsonwebtoken');
          const decoded = jwt.verify(token, process.env.JWT_SECRET || 'my-secret-key');
          user = await strapi.db.query('plugin::users-permissions.user').findOne({
            where: { id: decoded.id }
          });
        } catch (error) {
          console.log('Token invalide ou expiré');
        }
      }
    }
    
    if (!user) {
      return ctx.send({
        success: true,
        data: []
      });
    }
    
    const { projectId } = ctx.params;
    
    console.log('📋 [getProjectTasks] Projet:', projectId);
    
    const tasks = await strapi.db.query('api::task.task').findMany({
      where: {
        project: { id: projectId }
      },
      populate: ['assigned_to', 'project'],
      orderBy: { due_date: 'asc' }
    });
    
    return ctx.send({
      success: true,
      data: tasks
    });
  },
  
  /**
   * Statistiques des tâches pour l'utilisateur connecté
   */
  async getMyStats(ctx) {
    let user = ctx.state.user;
    
    if (!user) {
      const authHeader = ctx.request.headers.authorization;
      if (authHeader && authHeader.startsWith('Bearer ')) {
        const token = authHeader.substring(7);
        try {
          const jwt = require('jsonwebtoken');
          const decoded = jwt.verify(token, process.env.JWT_SECRET || 'my-secret-key');
          user = await strapi.db.query('plugin::users-permissions.user').findOne({
            where: { id: decoded.id }
          });
        } catch (error) {
          console.log('Token invalide ou expiré');
        }
      }
    }
    
    if (!user) {
      return ctx.send({
        success: true,
        data: {
          total: 0,
          completed: 0,
          inProgress: 0,
          todo: 0,
          completionRate: 0
        }
      });
    }
    
    console.log('📊 [getMyStats] Utilisateur:', user.id);
    
    const tasks = await strapi.db.query('api::task.task').findMany({
      where: {
        assigned_to: { id: user.id }
      }
    });
    
    const total = tasks.length;
    const completed = tasks.filter(t => t.statuts === 'DONE').length;
    const inProgress = tasks.filter(t => t.statuts === 'IN_PROGRESS').length;
    const todo = tasks.filter(t => t.statuts === 'TODO').length;
    
    const completionRate = total > 0 ? Math.round((completed / total) * 100) : 0;
    
    return ctx.send({
      success: true,
      data: {
        total,
        completed,
        inProgress,
        todo,
        completionRate
      }
    });
  },
  
  /**
   * Changer le statut d'une tâche
   */
  async changeStatus(ctx) {
    let user = ctx.state.user;
    
    if (!user) {
      const authHeader = ctx.request.headers.authorization;
      if (authHeader && authHeader.startsWith('Bearer ')) {
        const token = authHeader.substring(7);
        try {
          const jwt = require('jsonwebtoken');
          const decoded = jwt.verify(token, process.env.JWT_SECRET || 'my-secret-key');
          user = await strapi.db.query('plugin::users-permissions.user').findOne({
            where: { id: decoded.id }
          });
        } catch (error) {
          console.log('Token invalide ou expiré');
        }
      }
    }
    
    if (!user) {
      return ctx.unauthorized('Vous devez être connecté');
    }
    
    const { id } = ctx.params;
    const { status } = ctx.request.body;
    
    if (!status) {
      return ctx.badRequest('Le statut est requis');
    }
    
    console.log('🔄 [changeStatus] Tâche:', id, 'Nouveau statut:', status);
    
    // Vérifier si la tâche existe
    const task = await strapi.db.query('api::task.task').findOne({
      where: { id },
      populate: { assigned_to: true }
    });
    
    if (!task) {
      return ctx.notFound('Tâche non trouvée');
    }
    
    // Vérifier les permissions
    if (task.assigned_to?.id !== user.id) {
      return ctx.forbidden('Vous ne pouvez pas modifier cette tâche');
    }
    
    // Mettre à jour le statut
    const updatedTask = await strapi.db.query('api::task.task').update({
      where: { id },
      data: { statuts: status }
    });
    
    return ctx.send({
      success: true,
      message: 'Statut mis à jour avec succès',
      data: updatedTask
    });
  }
}));