/**
 * task service
 */

import { factories } from '@strapi/strapi';
import { DateTime } from 'luxon';

export default factories.createCoreService('api::task.task', ({ strapi }) => ({
  /**
   * Récupérer les tâches assignées à un utilisateur
   */
  async getUserTasks(userId: number, status?: string): Promise<any[]> {
    let whereClause: any = {
      assigned_to: userId
    };
    
    if (status) {
      whereClause.statuts = status;
    }
    
    const tasks = await strapi.db.query('api::task.task').findMany({
      where: whereClause,
      populate: { project: true },
      orderBy: { due_date: 'asc' }
    });
    
    return tasks;
  },
  
  /**
   * Récupérer les tâches en retard pour un utilisateur
   */
  async getOverdueTasks(userId: number): Promise<any[]> {
    const today = new Date();
    
    const tasks = await strapi.db.query('api::task.task').findMany({
      where: {
        assigned_to: userId,
        due_date: {
          $lt: today
        },
        statuts: { $ne: 'DONE' }
      },
      populate: { project: true }
    });
    
    return tasks;
  },
  
  /**
   * Récupérer les tâches d'un projet
   */
  async getProjectTasks(projectId: number, status?: string): Promise<any[]> {
    let whereClause: any = {
      project: projectId
    };
    
    if (status) {
      whereClause.statuts = status;
    }
    
    const tasks = await strapi.db.query('api::task.task').findMany({
      where: whereClause,
      populate: { assigned_to: true },
      orderBy: { due_date: 'asc' }
    });
    
    return tasks;
  },
  
  /**
   * Compter les tâches par statut pour un utilisateur
   */
  async countUserTasksByStatus(userId: number): Promise<any> {
    const tasks = await strapi.db.query('api::task.task').findMany({
      where: {
        assigned_to: userId
      }
    });
    
    return {
      total: tasks.length,
      todo: tasks.filter((t: any) => t.statuts === 'TODO').length,
      inProgress: tasks.filter((t: any) => t.statuts === 'IN_PROGRESS').length,
      done: tasks.filter((t: any) => t.statuts === 'DONE').length
    };
  },
  
  /**
   * Récupérer les tâches prioritaires
   */
  async getHighPriorityTasks(userId: number): Promise<any[]> {
    const tasks = await strapi.db.query('api::task.task').findMany({
      where: {
        assigned_to: userId,
        priority: 'HIGH',
        statuts: { $ne: 'DONE' }
      },
      orderBy: { due_date: 'asc' }
    });
    
    return tasks;
  },
  
  /**
   * Récupérer les tâches qui arrivent à échéance bientôt
   */
  async getUpcomingTasks(userId: number, days: number = 7): Promise<any[]> {
    const today = new Date();
    const limitDate = new Date();
    limitDate.setDate(today.getDate() + days);
    
    const tasks = await strapi.db.query('api::task.task').findMany({
      where: {
        assigned_to: userId,
        due_date: {
          $gte: today,
          $lte: limitDate
        },
        statuts: { $ne: 'DONE' }
      },
      orderBy: { due_date: 'asc' }
    });
    
    return tasks;
  },
  
  /**
   * Récupérer les statistiques d'avancement d'un projet
   */
  async getProjectProgress(projectId: number): Promise<any> {
    const tasks = await strapi.db.query('api::task.task').findMany({
      where: {
        project: projectId
      }
    });
    
    const total = tasks.length;
    const completed = tasks.filter((t: any) => t.statuts === 'DONE').length;
    const progress = total > 0 ? Math.round((completed / total) * 100) : 0;
    
    return {
      total,
      completed,
      progress,
      todo: tasks.filter((t: any) => t.statuts === 'TODO').length,
      inProgress: tasks.filter((t: any) => t.statuts === 'IN_PROGRESS').length
    };
  },
  
  /**
   * Vérifier si un utilisateur peut modifier une tâche
   */
  async canModifyTask(userId: number, taskId: number): Promise<boolean> {
    const task = await strapi.db.query('api::task.task').findOne({
      where: { id: taskId },
      populate: { assigned_to: true, project: true }
    });
    
    if (!task) return false;
    
    const userRole = await strapi.db.query('plugin::users-permissions.user').findOne({
      where: { id: userId },
      populate: { role: true }
    });
    
    const roleName = userRole.role?.name?.toLowerCase();
    
    // Admin peut tout modifier
    if (roleName === 'admin') return true;
    
    // Employee ne peut modifier que ses propres tâches
    if (roleName === 'employee') {
      return task.assigned_to?.id === userId;
    }
    
    // Manager peut modifier les tâches de ses projets
    if (roleName === 'manager') {
      const project = await strapi.db.query('api::project.project').findOne({
        where: { id: task.project.id },
        populate: { creator: true, users: true }
      });
      
      return project?.creator?.id === userId || 
             project?.users?.some((u: any) => u.id === userId) ||
             task.assigned_to?.id === userId;
    }
    
    return false;
  }
}));