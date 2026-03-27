/**
 * project controller
 */

import { factories } from '@strapi/strapi';
import { DateTime } from 'luxon';

export default factories.createCoreController('api::project.project', ({ strapi }) => ({
  /**
   * Récupérer les projets selon le rôle
   * - Employee: voit seulement les projets auxquels il est assigné
   * - Manager: voit les projets qu'il a créés + ceux de son équipe
   * - Admin: voit tous les projets
   */
  async find(ctx) {
    const { user } = ctx.state;
    
    if (!user) {
      return ctx.unauthorized('Vous devez être connecté');
    }
    
    const userRole = user.role?.name?.toLowerCase();
    
    if (userRole === 'employee') {
      // Employee: voir les projets où il est assigné
      const { data, meta } = await super.find(ctx);
      const filteredData = data.filter((project: any) => {
        if (!project.users) return false;
        return project.users.some((u: any) => u.id === user.id);
      });
      return { data: filteredData, meta };
    }
    
    if (userRole === 'manager') {
      // Manager: voir ses propres projets + projets de son équipe
      const { data, meta } = await super.find(ctx);
      const filteredData = data.filter((project: any) => {
        // Projet créé par le manager
        if (project.creator?.id === user.id) return true;
        // Projet où le manager est assigné
        if (project.users?.some((u: any) => u.id === user.id)) return true;
        return false;
      });
      return { data: filteredData, meta };
    }
    
    // Admin voit tout
    const { data, meta } = await super.find(ctx);
    return { data, meta };
  },
  
  /**
   * Créer un projet
   * - Employee: ne peut pas créer
   * - Manager: peut créer
   * - Admin: peut créer
   */
  async create(ctx) {
    const { user } = ctx.state;
    
    if (!user) {
      return ctx.unauthorized('Vous devez être connecté');
    }
    
    const userRole = user.role?.name?.toLowerCase();
    
    // Employee ne peut pas créer de projet
    if (userRole === 'employee') {
      return ctx.forbidden('Les employés ne peuvent pas créer des projets');
    }
    
    const requestData = ctx.request.body?.data || {};
    
    // Assigner le créateur
    requestData.creator = user.id;
    
    // Si manager, ajouter automatiquement le manager comme membre
    if (userRole === 'manager') {
      if (!requestData.users) {
        requestData.users = [];
      }
      if (!requestData.users.some((u: any) => u.id === user.id)) {
        requestData.users.push(user.id);
      }
    }
    
    ctx.request.body = { data: requestData };
    
    const response = await super.create(ctx);
    return response;
  },
  
  /**
   * Mettre à jour un projet
   * - Employee: ne peut pas modifier
   * - Manager: peut modifier seulement ses propres projets
   * - Admin: peut modifier tous les projets
   */
  async update(ctx) {
    const { user } = ctx.state;
    const { id } = ctx.params;
    
    if (!user) {
      return ctx.unauthorized('Vous devez être connecté');
    }
    
    const userRole = user.role?.name?.toLowerCase();
    
    // Récupérer le projet
    const project = await strapi.db.query('api::project.project').findOne({
      where: { id },
      populate: { creator: true, users: true }
    });
    
    if (!project) {
      return ctx.notFound('Projet non trouvé');
    }
    
    // Vérifier les permissions
    if (userRole === 'employee') {
      return ctx.forbidden('Les employés ne peuvent pas modifier les projets');
    }
    
    if (userRole === 'manager') {
      if (project.creator?.id !== user.id) {
        return ctx.forbidden('Vous ne pouvez modifier que vos propres projets');
      }
    }
    
    const response = await super.update(ctx);
    return response;
  },
  
  /**
   * Supprimer un projet
   * - Employee: ne peut pas supprimer
   * - Manager: peut supprimer seulement ses propres projets
   * - Admin: peut supprimer tous les projets
   */
  async delete(ctx) {
    const { user } = ctx.state;
    const { id } = ctx.params;
    
    if (!user) {
      return ctx.unauthorized('Vous devez être connecté');
    }
    
    const userRole = user.role?.name?.toLowerCase();
    
    // Récupérer le projet
    const project = await strapi.db.query('api::project.project').findOne({
      where: { id },
      populate: { creator: true }
    });
    
    if (!project) {
      return ctx.notFound('Projet non trouvé');
    }
    
    // Vérifier les permissions
    if (userRole === 'employee') {
      return ctx.forbidden('Les employés ne peuvent pas supprimer les projets');
    }
    
    if (userRole === 'manager') {
      if (project.creator?.id !== user.id) {
        return ctx.forbidden('Vous ne pouvez supprimer que vos propres projets');
      }
    }
    
    const response = await super.delete(ctx);
    return response;
  },
  
  /**
   * Ajouter des membres à un projet
   */
  async addMembers(ctx) {
    const { user } = ctx.state;
    const { id } = ctx.params;
    const { userIds } = ctx.request.body;
    
    if (!user) {
      return ctx.unauthorized('Vous devez être connecté');
    }
    
    const userRole = user.role?.name?.toLowerCase();
    
    // Récupérer le projet
    const project = await strapi.db.query('api::project.project').findOne({
      where: { id },
      populate: { creator: true, users: true }
    });
    
    if (!project) {
      return ctx.notFound('Projet non trouvé');
    }
    
    // Vérifier les permissions
    if (userRole === 'employee') {
      return ctx.forbidden('Les employés ne peuvent pas ajouter des membres');
    }
    
    if (userRole === 'manager' && project.creator?.id !== user.id) {
      return ctx.forbidden('Vous ne pouvez ajouter des membres qu\'à vos propres projets');
    }
    
    // Ajouter les nouveaux membres
    const existingUsers = project.users || [];
    const allUsers = [...existingUsers.map((u: any) => u.id), ...userIds];
    const uniqueUsers = [...new Set(allUsers)];
    
    const response = await strapi.db.query('api::project.project').update({
      where: { id },
      data: {
        users: uniqueUsers
      }
    });
    
    return ctx.send({
      success: true,
      message: 'Membres ajoutés avec succès',
      data: response
    });
  },
  
  /**
   * Retirer des membres d'un projet
   */
  async removeMembers(ctx) {
    const { user } = ctx.state;
    const { id } = ctx.params;
    const { userIds } = ctx.request.body;
    
    if (!user) {
      return ctx.unauthorized('Vous devez être connecté');
    }
    
    const userRole = user.role?.name?.toLowerCase();
    
    // Récupérer le projet
    const project = await strapi.db.query('api::project.project').findOne({
      where: { id },
      populate: { creator: true, users: true }
    });
    
    if (!project) {
      return ctx.notFound('Projet non trouvé');
    }
    
    // Vérifier les permissions
    if (userRole === 'employee') {
      return ctx.forbidden('Les employés ne peuvent pas retirer des membres');
    }
    
    if (userRole === 'manager' && project.creator?.id !== user.id) {
      return ctx.forbidden('Vous ne pouvez retirer des membres qu\'à vos propres projets');
    }
    
    // Retirer les membres
    const remainingUsers = (project.users || []).filter(
      (u: any) => !userIds.includes(u.id)
    );
    
    const response = await strapi.db.query('api::project.project').update({
      where: { id },
      data: {
        users: remainingUsers.map((u: any) => u.id)
      }
    });
    
    return ctx.send({
      success: true,
      message: 'Membres retirés avec succès',
      data: response
    });
  },
  
  /**
   * Récupérer les projets d'un utilisateur
   */
  async getUserProjects(ctx) {
    const { user } = ctx.state;
    const { userId } = ctx.params;
    
    if (!user) {
      return ctx.unauthorized('Vous devez être connecté');
    }
    
    const userRole = user.role?.name?.toLowerCase();
    const targetUserId = userId || user.id;
    
    // Vérifier les permissions
    if (userRole === 'employee' && targetUserId !== user.id) {
      return ctx.forbidden('Vous ne pouvez voir que vos propres projets');
    }
    
    const projects = await strapi.db.query('api::project.project').findMany({
      where: {
        users: {
          id: targetUserId
        }
      },
      populate: { creator: true, users: true, tasks: true }
    });
    
    return ctx.send({
      success: true,
      data: projects
    });
  },
  
  /**
   * Récupérer les projets en cours
   */
  async getActiveProjects(ctx) {
    const { user } = ctx.state;
    
    if (!user) {
      return ctx.unauthorized('Vous devez être connecté');
    }
    
    const userRole = user.role?.name?.toLowerCase();
    
    let whereClause: any = {
      statuts: { $in: ['PLANNED', 'IN_PROGRESS'] }
    };
    
    if (userRole === 'employee') {
      whereClause.users = { id: user.id };
    } else if (userRole === 'manager') {
      whereClause = {
        ...whereClause,
        $or: [
          { creator: user.id },
          { users: { id: user.id } }
        ]
      };
    }
    
    const projects = await strapi.db.query('api::project.project').findMany({
      where: whereClause,
      populate: { creator: true, users: true },
      orderBy: { start_date: 'asc' }
    });
    
    return ctx.send({
      success: true,
      data: projects
    });
  },
  
  /**
   * Récupérer les statistiques des projets
   */
  async getStats(ctx) {
    const { user } = ctx.state;
    
    if (!user) {
      return ctx.unauthorized('Vous devez être connecté');
    }
    
    const userRole = user.role?.name?.toLowerCase();
    
    let whereClause: any = {};
    
    if (userRole === 'employee') {
      whereClause.users = { id: user.id };
    } else if (userRole === 'manager') {
      whereClause = {
        $or: [
          { creator: user.id },
          { users: { id: user.id } }
        ]
      };
    }
    
    const projects = await strapi.db.query('api::project.project').findMany({
      where: whereClause
    });
    
    const stats = {
      total: projects.length,
      planned: projects.filter((p: any) => p.statuts === 'PLANNED').length,
      inProgress: projects.filter((p: any) => p.statuts === 'IN_PROGRESS').length,
      completed: projects.filter((p: any) => p.statuts === 'COMPLETED').length,
      cancelled: projects.filter((p: any) => p.statuts === 'CANCELLED').length
    };
    
    return ctx.send({
      success: true,
      data: stats
    });
  }
}));