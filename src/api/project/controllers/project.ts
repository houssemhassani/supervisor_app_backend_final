/**
 * project controller
 */

import { factories } from '@strapi/strapi';

export default factories.createCoreController('api::project.project', ({ strapi }) => ({
  /**
   * Récupérer les projets selon le rôle
   */
  async find(ctx) {
    const { user } = ctx.state;
    
    if (!user) {
      return ctx.unauthorized('Vous devez être connecté');
    }
    
    const userRole = user.role?.name?.toLowerCase();
    
    // Pour admin, retourner tous les projets
    if (userRole === 'admin') {
      const entities = await strapi.entityService.findMany('api::project.project', {
        populate: ['creator', 'users', 'tasks'],
        sort: { createdAt: 'desc' }
      });
      
      return { data: entities, meta: { pagination: { page: 1, pageSize: entities.length, pageCount: 1, total: entities.length } } };
    }
    
    // Pour employee et manager, construire les filtres
    let filters: any = {};
    
    if (userRole === 'employee') {
      // Employee: voir les projets où il est assigné
      filters = {
        users: {
          id: { $eq: user.id }
        }
      };
    } else if (userRole === 'manager') {
      // Manager: voir ses propres projets + projets où il est assigné
      filters = {
        $or: [
          { creator: { id: { $eq: user.id } } },
          { users: { id: { $eq: user.id } } }
        ]
      };
    }
    
    const entities = await strapi.entityService.findMany('api::project.project', {
      filters,
      populate: ['creator', 'users', 'tasks'],
      sort: { createdAt: 'desc' }
    });
    
    return { data: entities, meta: { pagination: { page: 1, pageSize: entities.length, pageCount: 1, total: entities.length } } };
  },
  
  /**
   * Récupérer un projet par son ID
   */
  async findOne(ctx) {
    const { user } = ctx.state;
    const { id } = ctx.params;
    
    if (!user) {
      return ctx.unauthorized('Vous devez être connecté');
    }
    
    const entity = await strapi.entityService.findOne('api::project.project', id, {
      populate: ['creator', 'users', 'tasks']
    });
    
    if (!entity) {
      return ctx.notFound('Projet non trouvé');
    }
    
    return { data: entity };
  },
  
  /**
   * Créer un projet
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
    
    // Récupérer les données du body
    const body = ctx.request.body;
    let requestData: any = {};
    
    if (body.data) {
      requestData = body.data;
    } else {
      requestData = body;
    }
    
    // Initialiser usersList
    let usersList: number[] = [];
    if (requestData.users && Array.isArray(requestData.users)) {
      usersList = requestData.users;
    }
    
    // Si manager, ajouter automatiquement le manager comme membre
    if (userRole === 'manager') {
      if (!usersList.includes(user.id)) {
        usersList.push(user.id);
      }
    }
    
    // Préparer les données pour la création
    const createData: any = {
      name: requestData.name,
      start_date: requestData.start_date,
      end_date: requestData.end_date,
      statuts: requestData.statuts || 'PLANNED',
      publishedAt: new Date().toISOString(),
      creator: user.id
    };
    
    // Ajouter les users si présents
    if (usersList.length > 0) {
      // @ts-ignore - Strapi accepte un tableau d'IDs pour les relations many-to-many
      createData.users = usersList;
    }
    
    // Gérer la description (type blocks)
    if (requestData.description) {
      if (typeof requestData.description === 'string') {
        createData.description = [{ type: 'paragraph', children: [{ type: 'text', text: requestData.description }] }];
      } else {
        createData.description = requestData.description;
      }
    } else {
      createData.description = [{ type: 'paragraph', children: [{ type: 'text', text: '' }] }];
    }
    
    // Créer le projet
    const entity = await strapi.entityService.create('api::project.project', {
      data: createData,
      populate: ['creator', 'users']
    });
    
    return { data: entity };
  },
  
  /**
   * Mettre à jour un projet
   */
  async update(ctx) {
    const { user } = ctx.state;
    const { id } = ctx.params;
    
    if (!user) {
      return ctx.unauthorized('Vous devez être connecté');
    }
    
    const userRole = user.role?.name?.toLowerCase();
    
    // Récupérer le projet existant avec ses relations
    const existingProject = await strapi.entityService.findOne('api::project.project', id, {
      populate: ['creator']
    }) as any;
    
    if (!existingProject) {
      return ctx.notFound('Projet non trouvé');
    }
    
    // Vérifier les permissions
    if (userRole === 'employee') {
      return ctx.forbidden('Les employés ne peuvent pas modifier les projets');
    }
    
    if (userRole === 'manager') {
      if (existingProject.creator?.id !== user.id) {
        return ctx.forbidden('Vous ne pouvez modifier que vos propres projets');
      }
    }
    
    // Récupérer les données à mettre à jour
    const body = ctx.request.body;
    let updateData: any = {};
    
    if (body.data) {
      updateData = body.data;
    } else {
      updateData = body;
    }
    
    // Préparer les données de mise à jour
    const dataToUpdate: any = {};
    
    if (updateData.name !== undefined) {
      dataToUpdate.name = updateData.name;
    }
    
    if (updateData.description !== undefined) {
      if (typeof updateData.description === 'string') {
        dataToUpdate.description = [{ type: 'paragraph', children: [{ type: 'text', text: updateData.description }] }];
      } else {
        dataToUpdate.description = updateData.description;
      }
    }
    
    if (updateData.statuts !== undefined) {
      dataToUpdate.statuts = updateData.statuts;
    }
    
    if (updateData.start_date !== undefined) {
      dataToUpdate.start_date = updateData.start_date;
    }
    
    if (updateData.end_date !== undefined) {
      dataToUpdate.end_date = updateData.end_date;
    }
    
    // Pour la mise à jour des users, assigner directement le tableau d'IDs
    if (updateData.users !== undefined && Array.isArray(updateData.users)) {
      // @ts-ignore - Strapi accepte un tableau d'IDs pour les relations many-to-many
      dataToUpdate.users = updateData.users;
    }
    
    // Mettre à jour le projet
    const entity = await strapi.entityService.update('api::project.project', id, {
      data: dataToUpdate,
      populate: ['creator', 'users']
    });
    
    return { data: entity };
  },
  
  /**
   * Supprimer un projet
   */
  async delete(ctx) {
    const { user } = ctx.state;
    const { id } = ctx.params;
    
    if (!user) {
      return ctx.unauthorized('Vous devez être connecté');
    }
    
    const userRole = user.role?.name?.toLowerCase();
    
    // Récupérer le projet existant
    const existingProject = await strapi.entityService.findOne('api::project.project', id, {
      populate: ['creator']
    }) as any;
    
    if (!existingProject) {
      return ctx.notFound('Projet non trouvé');
    }
    
    // Vérifier les permissions
    if (userRole === 'employee') {
      return ctx.forbidden('Les employés ne peuvent pas supprimer les projets');
    }
    
    if (userRole === 'manager') {
      if (existingProject.creator?.id !== user.id) {
        return ctx.forbidden('Vous ne pouvez supprimer que vos propres projets');
      }
    }
    
    // Supprimer le projet
    const entity = await strapi.entityService.delete('api::project.project', id);
    
    return { data: entity };
  },
  
  /**
   * Ajouter des membres à un projet
   */
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
  
  // Récupérer le projet existant
  const existingProject = await strapi.db.query('api::project.project').findOne({
    where: { id },
    populate: ['creator', 'users']
  });
  
  if (!existingProject) {
    return ctx.notFound('Projet non trouvé');
  }
  
  // Vérifier les permissions
  if (userRole === 'employee') {
    return ctx.forbidden('Les employés ne peuvent pas ajouter des membres');
  }
  
  if (userRole === 'manager' && existingProject.creator?.id !== user.id) {
    return ctx.forbidden('Vous ne pouvez ajouter des membres qu\'à vos propres projets');
  }
  
  // Ajouter les nouveaux membres
  const existingUserIds = (existingProject.users || []).map((u: any) => u.id);
  const allUserIds = [...new Set([...existingUserIds, ...userIds])];
  
  // Mettre à jour le projet avec la nouvelle liste d'IDs en utilisant db.query
  const updatedProject = await strapi.db.query('api::project.project').update({
    where: { id },
    data: {
      users: allUserIds
    }
  });
  
  // Récupérer le projet mis à jour avec les relations
  const entity = await strapi.entityService.findOne('api::project.project', id, {
    populate: ['users']
  });
  
  return ctx.send({
    success: true,
    message: 'Membres ajoutés avec succès',
    data: entity
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
  
  // Récupérer le projet existant
  const existingProject = await strapi.db.query('api::project.project').findOne({
    where: { id },
    populate: ['creator', 'users']
  });
  
  if (!existingProject) {
    return ctx.notFound('Projet non trouvé');
  }
  
  // Vérifier les permissions
  if (userRole === 'employee') {
    return ctx.forbidden('Les employés ne peuvent pas retirer des membres');
  }
  
  if (userRole === 'manager' && existingProject.creator?.id !== user.id) {
    return ctx.forbidden('Vous ne pouvez retirer des membres qu\'à vos propres projets');
  }
  
  // Retirer les membres
  const remainingUsers = (existingProject.users || [])
    .filter((u: any) => !userIds.includes(u.id))
    .map((u: any) => u.id);
  
  // Mettre à jour le projet avec la nouvelle liste d'IDs en utilisant db.query
  await strapi.db.query('api::project.project').update({
    where: { id },
    data: {
      users: remainingUsers
    }
  });
  
  // Récupérer le projet mis à jour avec les relations
  const entity = await strapi.entityService.findOne('api::project.project', id, {
    populate: ['users']
  });
  
  return ctx.send({
    success: true,
    message: 'Membres retirés avec succès',
    data: entity
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
    const targetUserId = parseInt(userId || user.id);
    
    // Vérifier les permissions
    if (userRole === 'employee' && targetUserId !== user.id) {
      return ctx.forbidden('Vous ne pouvez voir que vos propres projets');
    }
    
    const entities = await strapi.entityService.findMany('api::project.project', {
      filters: {
        users: {
          id: { $eq: targetUserId }
        }
      },
      populate: ['creator', 'users', 'tasks']
    });
    
    return ctx.send({
      success: true,
      data: entities
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
    
    let filters: any = {
      statuts: { $in: ['PLANNED', 'IN_PROGRESS'] }
    };
    
    if (userRole === 'employee') {
      filters = {
        $and: [
          { statuts: { $in: ['PLANNED', 'IN_PROGRESS'] } },
          { users: { id: { $eq: user.id } } }
        ]
      };
    } else if (userRole === 'manager') {
      filters = {
        $and: [
          { statuts: { $in: ['PLANNED', 'IN_PROGRESS'] } },
          {
            $or: [
              { creator: { id: { $eq: user.id } } },
              { users: { id: { $eq: user.id } } }
            ]
          }
        ]
      };
    }
    
    const entities = await strapi.entityService.findMany('api::project.project', {
      filters,
      populate: ['creator', 'users'],
      sort: { start_date: 'asc' }
    });
    
    return ctx.send({
      success: true,
      data: entities
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
    
    let filters: any = {};
    
    if (userRole === 'employee') {
      filters = { users: { id: { $eq: user.id } } };
    } else if (userRole === 'manager') {
      filters = {
        $or: [
          { creator: { id: { $eq: user.id } } },
          { users: { id: { $eq: user.id } } }
        ]
      };
    }
    
    const entities = await strapi.entityService.findMany('api::project.project', {
      filters
    });
    
    const stats = {
      total: entities.length,
      planned: entities.filter((p: any) => p.statuts === 'PLANNED').length,
      inProgress: entities.filter((p: any) => p.statuts === 'IN_PROGRESS').length,
      completed: entities.filter((p: any) => p.statuts === 'COMPLETED').length,
      cancelled: entities.filter((p: any) => p.statuts === 'CANCELLED').length
    };
    
    return ctx.send({
      success: true,
      data: stats
    });
  }
}));