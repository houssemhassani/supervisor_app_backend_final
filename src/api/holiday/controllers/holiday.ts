/**
 * holiday controller
 */

import { factories } from '@strapi/strapi';
import { DateTime } from 'luxon';

export default factories.createCoreController('api::holiday.holiday', ({ strapi }) => ({
  /**
   * Récupérer les jours fériés selon le rôle
   * - Employee: voit les jours fériés qui lui sont applicables
   * - Manager/Admin: voit tous les jours fériés
   */
  async find(ctx) {
    const { user } = ctx.state;
    
    if (!user) {
      return ctx.unauthorized('Vous devez être connecté');
    }
    
    const userRole = user.role?.name?.toLowerCase();
    
    // Employee ne voit que les jours fériés qui lui sont applicables
    if (userRole === 'employee') {
      const { data, meta } = await super.find(ctx);
      
      // Filtrer les jours fériés applicables à l'utilisateur
      const filteredData = data.filter((holiday: any) => {
        // Si aucun utilisateur spécifié, applicable à tous
        if (!holiday.applicable_to || holiday.applicable_to.length === 0) {
          return true;
        }
        // Vérifier si l'utilisateur est dans la liste
        return holiday.applicable_to.some((u: any) => u.id === user.id);
      });
      
      return { data: filteredData, meta };
    }
    
    // Manager et admin voient tout
    const { data, meta } = await super.find(ctx);
    return { data, meta };
  },
  
  /**
   * Créer un jour férié
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
    
    // Employee ne peut pas créer
    if (userRole === 'employee') {
      return ctx.forbidden('Les employés ne peuvent pas créer des jours fériés');
    }
    
    const response = await super.create(ctx);
    return response;
  },
  
  /**
   * Mettre à jour un jour férié
   * - Employee: ne peut pas modifier
   * - Manager: peut modifier
   * - Admin: peut modifier
   */
  async update(ctx) {
    const { user } = ctx.state;
    
    if (!user) {
      return ctx.unauthorized('Vous devez être connecté');
    }
    
    const userRole = user.role?.name?.toLowerCase();
    
    // Employee ne peut pas modifier
    if (userRole === 'employee') {
      return ctx.forbidden('Les employés ne peuvent pas modifier les jours fériés');
    }
    
    const response = await super.update(ctx);
    return response;
  },
  
  /**
   * Supprimer un jour férié
   * - Employee: ne peut pas supprimer
   * - Manager: peut supprimer
   * - Admin: peut supprimer
   */
  async delete(ctx) {
    const { user } = ctx.state;
    
    if (!user) {
      return ctx.unauthorized('Vous devez être connecté');
    }
    
    const userRole = user.role?.name?.toLowerCase();
    
    // Employee ne peut pas supprimer
    if (userRole === 'employee') {
      return ctx.forbidden('Les employés ne peuvent pas supprimer les jours fériés');
    }
    
    const response = await super.delete(ctx);
    return response;
  },
  
  /**
   * Récupérer les jours fériés pour une année donnée
   */
  async getByYear(ctx) {
    const { user } = ctx.state;
    const { year } = ctx.params;
    
    if (!user) {
      return ctx.unauthorized('Vous devez être connecté');
    }
    
    const userRole = user.role?.name?.toLowerCase();
    const startDate = new Date(parseInt(year), 0, 1);
    const endDate = new Date(parseInt(year), 11, 31);
    
    let holidays = await strapi.db.query('api::holiday.holiday').findMany({
      where: {
        date: {
          $gte: startDate,
          $lte: endDate
        }
      },
      populate: { applicable_to: true }
    });
    
    // Filtrer pour employee
    if (userRole === 'employee') {
      holidays = holidays.filter((holiday: any) => {
        if (!holiday.applicable_to || holiday.applicable_to.length === 0) {
          return true;
        }
        return holiday.applicable_to.some((u: any) => u.id === user.id);
      });
    }
    
    return ctx.send({
      success: true,
      data: holidays
    });
  },
  
  /**
   * Récupérer le prochain jour férié
   */
  async getNext(ctx) {
    const { user } = ctx.state;
    
    if (!user) {
      return ctx.unauthorized('Vous devez être connecté');
    }
    
    const userRole = user.role?.name?.toLowerCase();
    const today = new Date();
    
    let holidays = await strapi.db.query('api::holiday.holiday').findMany({
      where: {
        date: {
          $gte: today
        }
      },
      orderBy: { date: 'asc' },
      limit: 10,
      populate: { applicable_to: true }
    });
    
    // Filtrer pour employee
    if (userRole === 'employee') {
      holidays = holidays.filter((holiday: any) => {
        if (!holiday.applicable_to || holiday.applicable_to.length === 0) {
          return true;
        }
        return holiday.applicable_to.some((u: any) => u.id === user.id);
      });
    }
    
    const nextHoliday = holidays[0] || null;
    
    return ctx.send({
      success: true,
      data: nextHoliday
    });
  },
  
  /**
   * Vérifier si une date est un jour férié pour l'utilisateur
   */
  async isHoliday(ctx) {
    const { user } = ctx.state;
    const { date } = ctx.params;
    
    if (!user) {
      return ctx.unauthorized('Vous devez être connecté');
    }
    
    const userRole = user.role?.name?.toLowerCase();
    const checkDate = new Date(date);
    
    let holidays = await strapi.db.query('api::holiday.holiday').findMany({
      where: {
        date: {
          $gte: new Date(checkDate.setHours(0, 0, 0, 0)),
          $lte: new Date(checkDate.setHours(23, 59, 59, 999))
        }
      },
      populate: { applicable_to: true }
    });
    
    // Filtrer pour employee
    if (userRole === 'employee') {
      holidays = holidays.filter((holiday: any) => {
        if (!holiday.applicable_to || holiday.applicable_to.length === 0) {
          return true;
        }
        return holiday.applicable_to.some((u: any) => u.id === user.id);
      });
    }
    
    return ctx.send({
      success: true,
      data: {
        isHoliday: holidays.length > 0,
        holiday: holidays[0] || null
      }
    });
  },
  
  /**
   * Ajouter des utilisateurs à un jour férié
   */
  async addUsers(ctx) {
    const { user } = ctx.state;
    const { id } = ctx.params;
    const { userIds } = ctx.request.body;
    
    if (!user) {
      return ctx.unauthorized('Vous devez être connecté');
    }
    
    const userRole = user.role?.name?.toLowerCase();
    
    // Seul manager et admin peuvent ajouter des utilisateurs
    if (userRole !== 'manager' && userRole !== 'admin') {
      return ctx.forbidden('Vous n\'avez pas les droits pour ajouter des utilisateurs');
    }
    
    const holiday = await strapi.db.query('api::holiday.holiday').findOne({
      where: { id }
    });
    
    if (!holiday) {
      return ctx.notFound('Jour férié non trouvé');
    }
    
    // Récupérer les utilisateurs existants
    const existingUsers = holiday.applicable_to || [];
    const allUsers = [...existingUsers, ...userIds];
    
    const response = await strapi.db.query('api::holiday.holiday').update({
      where: { id },
      data: {
        applicable_to: allUsers
      }
    });
    
    return ctx.send({
      success: true,
      message: 'Utilisateurs ajoutés avec succès',
      data: response
    });
  },
  
  /**
   * Retirer des utilisateurs d'un jour férié
   */
  async removeUsers(ctx) {
    const { user } = ctx.state;
    const { id } = ctx.params;
    const { userIds } = ctx.request.body;
    
    if (!user) {
      return ctx.unauthorized('Vous devez être connecté');
    }
    
    const userRole = user.role?.name?.toLowerCase();
    
    // Seul manager et admin peuvent retirer des utilisateurs
    if (userRole !== 'manager' && userRole !== 'admin') {
      return ctx.forbidden('Vous n\'avez pas les droits pour retirer des utilisateurs');
    }
    
    const holiday = await strapi.db.query('api::holiday.holiday').findOne({
      where: { id },
      populate: { applicable_to: true }
    });
    
    if (!holiday) {
      return ctx.notFound('Jour férié non trouvé');
    }
    
    // Filtrer pour retirer les utilisateurs
    const remainingUsers = holiday.applicable_to.filter(
      (u: any) => !userIds.includes(u.id)
    );
    
    const response = await strapi.db.query('api::holiday.holiday').update({
      where: { id },
      data: {
        applicable_to: remainingUsers
      }
    });
    
    return ctx.send({
      success: true,
      message: 'Utilisateurs retirés avec succès',
      data: response
    });
  }
}));