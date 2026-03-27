// src/api/task/controllers/task.ts
import { factories } from '@strapi/strapi';

export default factories.createCoreController('api::task.task', ({ strapi }) => ({
  /**
   * Récupérer les tâches de l'utilisateur connecté
   */
  async find(ctx) {
    const { user } = ctx.state;
    
    if (!user) {
      return ctx.unauthorized('Vous devez être connecté');
    }
    
    console.log('📋 [Task find] Utilisateur:', user.id);
    
    // Filtrer par utilisateur
    ctx.query = {
      ...ctx.query,
      filters: {
        assigned_to: { id: user.id }
      },
      populate: ['assigned_to', 'project']
    };
    
    const { data, meta } = await super.find(ctx);
    return { data, meta };
  },
  
  /**
   * Créer une tâche
   */
  async create(ctx) {
    const { user } = ctx.state;
    
    if (!user) {
      return ctx.unauthorized('Vous devez être connecté');
    }
    
    const requestData = ctx.request.body?.data || {};
    
    // Si l'utilisateur est employee, forcer l'assignation à lui-même
    const userRole = user.role?.name?.toLowerCase();
    if (userRole === 'employee') {
      requestData.assigned_to = user.id;
    }
    
    ctx.request.body = { data: requestData };
    
    const response = await super.create(ctx);
    return response;
  },
  
  /**
   * Mettre à jour une tâche
   */
  async update(ctx) {
    const { user } = ctx.state;
    const { id } = ctx.params;
    
    if (!user) {
      return ctx.unauthorized('Vous devez être connecté');
    }
    
    const userRole = user.role?.name?.toLowerCase();
    
    // Vérifier si la tâche existe
    const task = await strapi.db.query('api::task.task').findOne({
      where: { id },
      populate: { assigned_to: true }
    });
    
    if (!task) {
      return ctx.notFound('Tâche non trouvée');
    }
    
    // Employee ne peut modifier que ses propres tâches
    if (userRole === 'employee') {
      if (task.assigned_to?.id !== user.id) {
        return ctx.forbidden('Vous ne pouvez pas modifier cette tâche');
      }
    }
    
    const response = await super.update(ctx);
    return response;
  },
  
  /**
   * Supprimer une tâche
   */
  async delete(ctx) {
    const { user } = ctx.state;
    const { id } = ctx.params;
    
    if (!user) {
      return ctx.unauthorized('Vous devez être connecté');
    }
    
    const userRole = user.role?.name?.toLowerCase();
    
    // Employee ne peut pas supprimer
    if (userRole === 'employee') {
      return ctx.forbidden('Vous ne pouvez pas supprimer les tâches');
    }
    
    const response = await super.delete(ctx);
    return response;
  },
  
  /**
   * Récupérer les tâches de l'utilisateur connecté (alias pour find)
   */
  async getMyTasks(ctx) {
    const { user } = ctx.state;
    
    if (!user) {
      return ctx.unauthorized('Vous devez être connecté');
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
    const { user } = ctx.state;
    const { projectId } = ctx.params;
    
    if (!user) {
      return ctx.unauthorized('Vous devez être connecté');
    }
    
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
    const { user } = ctx.state;
    
    if (!user) {
      return ctx.unauthorized('Vous devez être connecté');
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
    
    // Calculer le pourcentage de complétion
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
    const { user } = ctx.state;
    const { id } = ctx.params;
    const { status } = ctx.request.body;
    
    if (!user) {
      return ctx.unauthorized('Vous devez être connecté');
    }
    
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
    
    const userRole = user.role?.name?.toLowerCase();
    
    // Vérifier les permissions
    if (userRole === 'employee' && task.assigned_to?.id !== user.id) {
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