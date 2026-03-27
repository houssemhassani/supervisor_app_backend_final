/**
 * project service
 */

import { factories } from '@strapi/strapi';
import { DateTime } from 'luxon';

export default factories.createCoreService('api::project.project', ({ strapi }) => ({
  /**
   * Vérifier si un utilisateur est membre d'un projet
   */
  async isUserInProject(userId: number, projectId: number): Promise<boolean> {
    const project = await strapi.db.query('api::project.project').findOne({
      where: { id: projectId },
      populate: { users: true }
    });
    
    if (!project) return false;
    return project.users?.some((u: any) => u.id === userId) || false;
  },
  
  /**
   * Vérifier si un utilisateur est le créateur d'un projet
   */
  async isProjectCreator(userId: number, projectId: number): Promise<boolean> {
    const project = await strapi.db.query('api::project.project').findOne({
      where: { id: projectId },
      populate: { creator: true }
    });
    
    if (!project) return false;
    return project.creator?.id === userId;
  },
  
  /**
   * Récupérer les projets d'un utilisateur
   */
  async getUserProjects(userId: number, status?: string): Promise<any[]> {
    let whereClause: any = {
      users: { id: userId }
    };
    
    if (status) {
      whereClause.statuts = status;
    }
    
    const projects = await strapi.db.query('api::project.project').findMany({
      where: whereClause,
      populate: { creator: true, users: true, tasks: true },
      orderBy: { start_date: 'desc' }
    });
    
    return projects;
  },
  
  /**
   * Récupérer les projets créés par un utilisateur
   */
  async getUserCreatedProjects(userId: number): Promise<any[]> {
    const projects = await strapi.db.query('api::project.project').findMany({
      where: {
        creator: userId
      },
      populate: { users: true, tasks: true },
      orderBy: { created_at: 'desc' }
    });
    
    return projects;
  },
  
  /**
   * Compter les projets par statut
   */
  async countProjectsByStatus(): Promise<any> {
    const projects = await strapi.db.query('api::project.project').findMany({});
    
    return {
      planned: projects.filter((p: any) => p.statuts === 'PLANNED').length,
      inProgress: projects.filter((p: any) => p.statuts === 'IN_PROGRESS').length,
      completed: projects.filter((p: any) => p.statuts === 'COMPLETED').length,
      cancelled: projects.filter((p: any) => p.statuts === 'CANCELLED').length,
      total: projects.length
    };
  },
  
  /**
   * Récupérer les projets en retard
   */
  async getOverdueProjects(): Promise<any[]> {
    const today = new Date();
    
    const projects = await strapi.db.query('api::project.project').findMany({
      where: {
        end_date: {
          $lt: today
        },
        statuts: { $in: ['PLANNED', 'IN_PROGRESS'] }
      },
      populate: { creator: true, users: true }
    });
    
    return projects;
  },
  
  /**
   * Récupérer les projets proches de la date de fin
   */
  async getProjectsExpiringSoon(days: number = 7): Promise<any[]> {
    const today = new Date();
    const limitDate = new Date();
    limitDate.setDate(today.getDate() + days);
    
    const projects = await strapi.db.query('api::project.project').findMany({
      where: {
        end_date: {
          $gte: today,
          $lte: limitDate
        },
        statuts: { $in: ['PLANNED', 'IN_PROGRESS'] }
      },
      populate: { creator: true, users: true }
    });
    
    return projects;
  },
  
  /**
   * Récupérer les statistiques d'avancement d'un projet
   */
  async getProjectProgress(projectId: number): Promise<any> {
    const project = await strapi.db.query('api::project.project').findOne({
      where: { id: projectId },
      populate: { tasks: true }
    });
    
    if (!project) return null;
    
    const totalTasks = project.tasks?.length || 0;
    const completedTasks = project.tasks?.filter((t: any) => t.statuts === 'DONE').length || 0;
    const progress = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;
    
    return {
      totalTasks,
      completedTasks,
      progress,
      status: project.statuts
    };
  },
  
  /**
   * Récupérer les membres d'un projet
   */
  async getProjectMembers(projectId: number): Promise<{ creator: any; members: any[]; totalMembers: number }> {
    const project = await strapi.db.query('api::project.project').findOne({
      where: { id: projectId },
      populate: { users: true, creator: true }
    });
    
    if (!project) {
      return {
        creator: null,
        members: [],
        totalMembers: 0
      };
    }
    
    const members = project.users || [];
    const creator = project.creator;
    
    return {
      creator,
      members,
      totalMembers: members.length + 1
    };
  }
}));