// Community Functions - Sistema de Comunidades "Consume Local"
import * as admin from "firebase-admin";
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { onSchedule } from "firebase-functions/v2/scheduler";
import {
  CommunityData,
  CommunityMembership,
  CommunityRecommendation,
  CommunityFeedActivity,
  CommunityProvider,
  CommunityBusiness,
  COMMUNITY_LIMITS,
  COMMUNITY_TYPES,
  COMMUNITY_ROLES
} from "./types";

const db = admin.firestore();

/**
 * 🏘️ createCommunity
 * Crear nueva comunidad local
 */
export const createCommunity = onCall<{
  name: string;
  description: string;
  type: string;
  location: {
    lat: number;
    lng: number;
    address: string;
    radius: number;
    city: string;
    state: string;
    country: string;
  };
  settings: {
    isPrivate: boolean;
    allowRecommendations: boolean;
    allowBusinesses: boolean;
    requireVerification: boolean;
    maxMembers: number;
    autoApproveRadius: number;
  };
  coverImage?: string;
  tags: string[];
}>(
  async (request) => {
    const { name, description, type, location, settings, coverImage, tags } = request.data;
    const creatorId = request.auth?.uid;

    if (!creatorId) {
      throw new HttpsError("unauthenticated", "Usuario no autenticado");
    }

    console.log(`🏘️ Creando comunidad: ${name} por usuario ${creatorId}`);

    try {
      const now = admin.firestore.Timestamp.now();

      // 1. Validaciones
      if (!name.trim() || name.length < 3) {
        throw new HttpsError("invalid-argument", "Nombre debe tener al menos 3 caracteres");
      }

      if (!description.trim() || description.length < 10) {
        throw new HttpsError("invalid-argument", "Descripción debe tener al menos 10 caracteres");
      }

      if (!Object.values(COMMUNITY_TYPES).includes(type as any)) {
        throw new HttpsError("invalid-argument", "Tipo de comunidad inválido");
      }

      if (location.radius < 100 || location.radius > 10000) {
        throw new HttpsError("invalid-argument", "Radio debe estar entre 100m y 10km");
      }

      // 2. Verificar límites del usuario (máximo 3 comunidades como owner)
      const userOwnedCommunitiesSnapshot = await db
        .collection("communities")
        .where("createdBy", "==", creatorId)
        .get();

      if (userOwnedCommunitiesSnapshot.size >= 3) {
        throw new HttpsError("resource-exhausted", "Máximo 3 comunidades por usuario");
      }

      // 3. Verificar duplicados en la misma ubicación
      const nearbyCommunitiesSnapshot = await db
        .collection("communities")
        .where("location.city", "==", location.city)
        .where("location.state", "==", location.state)
        .get();

      for (const doc of nearbyCommunitiesSnapshot.docs) {
        const existingCommunity = doc.data() as CommunityData;
        const distance = calculateDistance(
          location.lat, location.lng,
          existingCommunity.location.lat, existingCommunity.location.lng
        );

        if (distance < 500 && existingCommunity.name.toLowerCase() === name.toLowerCase()) {
          throw new HttpsError("already-exists", "Ya existe una comunidad con ese nombre en la zona");
        }
      }

      // 4. Crear la comunidad
      const communityRef = db.collection("communities").doc();
      const communityData: CommunityData = {
        name: name.trim(),
        description: description.trim(),
        type: type as any,
        location,
        settings: {
          ...settings,
          maxMembers: Math.min(settings.maxMembers, COMMUNITY_LIMITS.MAX_MEMBERS_FREE)
        },
        stats: {
          totalMembers: 1, // El creador
          activeMembers: 1,
          totalProviders: 0,
          localBusinesses: 0,
          recommendationsThisMonth: 0,
          averageRating: 0
        },
        moderation: {
          adminIds: [creatorId],
          moderatorIds: [],
          rules: [
            "Mantén un ambiente respetuoso",
            "Solo contenido relacionado con la comunidad",
            "No spam ni autopromoción excesiva",
            "Ayuda a crear una red de confianza local"
          ],
          bannedUsers: [],
          pendingRequests: 0
        },
        coverImage,
        tags: tags.slice(0, 10), // Máximo 10 tags
        verified: false,
        featured: false,
        createdBy: creatorId,
        createdAt: now,
        updatedAt: now,
        lastActivityAt: now,
        popularProviders: [],
        trendingServices: []
      };

      await communityRef.set(communityData);

      // 5. Crear membresía del creador como owner
      const membershipRef = db.collection("communityMemberships").doc();
      const ownerMembership: CommunityMembership = {
        communityId: communityRef.id,
        userId: creatorId,
        role: "owner",
        status: "approved",
        memberInfo: {
          displayName: "Creador", // En producción obtener del perfil
          isProvider: false,
          isBusinessOwner: false,
          verifiedResident: false
        },
        memberStats: {
          recommendationsGiven: 0,
          recommendationsReceived: 0,
          helpfulVotes: 0,
          communityScore: 100, // Owner empieza con score alto
          lastActiveAt: now
        },
        verification: {
          method: "admin_approval",
          verifiedBy: creatorId,
          verifiedAt: now
        },
        requestedAt: now,
        approvedAt: now,
        joinedAt: now
      };

      await membershipRef.set(ownerMembership);

      // 6. Crear índice de búsqueda
      await createCommunitySearchIndex(communityRef.id, communityData);

      // 7. Log de actividad
      await logCommunityActivity(communityRef.id, "community_created", creatorId, {
        communityName: name,
        communityType: type,
        location: location.city
      });

      console.log(`✅ Comunidad creada: ${communityRef.id}`);

      return {
        success: true,
        communityId: communityRef.id,
        message: "Comunidad creada exitosamente"
      };

    } catch (error) {
      console.error("❌ Error creando comunidad:", error);
      if (error instanceof HttpsError) throw error;
      throw new HttpsError("internal", "Error creando comunidad");
    }
  }
);

/**
 * 🔍 searchCommunities
 * Buscar comunidades por ubicación, nombre o tipo
 */
export const searchCommunities = onCall<{
  query?: string;
  location?: { lat: number; lng: number; radius: number };
  type?: string;
  limit?: number;
  featured?: boolean;
}>(
  async (request) => {
    const { query, location, type, limit = 20, featured } = request.data;

    try {
      console.log("🔍 Buscando comunidades:", { query, location, type });

      let communitiesQuery = db.collection("communities")
        .where("verified", "==", true) // Solo comunidades verificadas
        .orderBy("stats.totalMembers", "desc")
        .limit(Math.min(limit, 50));

      // Filtrar por tipo si se especifica
      if (type && Object.values(COMMUNITY_TYPES).includes(type as any)) {
        communitiesQuery = communitiesQuery.where("type", "==", type);
      }

      // Filtrar comunidades destacadas
      if (featured) {
        communitiesQuery = communitiesQuery.where("featured", "==", true);
      }

      const communitiesSnapshot = await communitiesQuery.get();
      let communities = communitiesSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as (CommunityData & { id: string })[];

      // Filtrar por ubicación si se proporciona
      if (location) {
        communities = communities.filter(community => {
          const distance = calculateDistance(
            location.lat, location.lng,
            community.location.lat, community.location.lng
          );
          return distance <= location.radius;
        }).map(community => ({
          ...community,
          distance: calculateDistance(
            location.lat, location.lng,
            community.location.lat, community.location.lng
          )
        })).sort((a, b) => a.distance - b.distance);
      }

      // Filtrar por texto de búsqueda
      if (query && query.trim()) {
        const searchTerm = query.toLowerCase().trim();
        communities = communities.filter(community => 
          community.name.toLowerCase().includes(searchTerm) ||
          community.description.toLowerCase().includes(searchTerm) ||
          community.location.city.toLowerCase().includes(searchTerm) ||
          community.tags.some(tag => tag.toLowerCase().includes(searchTerm))
        );
      }

      return {
        success: true,
        communities: communities.slice(0, limit),
        totalFound: communities.length
      };

    } catch (error) {
      console.error("❌ Error buscando comunidades:", error);
      throw new HttpsError("internal", "Error en búsqueda de comunidades");
    }
  }
);

/**
 * 🤝 joinCommunity
 * Solicitar unirse a una comunidad
 */
export const joinCommunity = onCall<{
  communityId: string;
  joinReason?: string;
  userLocation?: { lat: number; lng: number };
}>(
  async (request) => {
    const { communityId, joinReason, userLocation } = request.data;
    const userId = request.auth?.uid;

    if (!userId) {
      throw new HttpsError("unauthenticated", "Usuario no autenticado");
    }

    console.log(`🤝 Usuario ${userId} solicitando unirse a comunidad ${communityId}`);

    try {
      const now = admin.firestore.Timestamp.now();

      // 1. Verificar que la comunidad existe
      const communityDoc = await db.collection("communities").doc(communityId).get();
      if (!communityDoc.exists) {
        throw new HttpsError("not-found", "Comunidad no encontrada");
      }

      const communityData = communityDoc.data() as CommunityData;

      // 2. Verificar que no esté ya en la comunidad
      const existingMembershipSnapshot = await db
        .collection("communityMemberships")
        .where("communityId", "==", communityId)
        .where("userId", "==", userId)
        .get();

      if (!existingMembershipSnapshot.empty) {
        const membership = existingMembershipSnapshot.docs[0].data();
        if (membership.status === "approved") {
          throw new HttpsError("already-exists", "Ya eres miembro de esta comunidad");
        } else if (membership.status === "pending") {
          throw new HttpsError("already-exists", "Ya tienes una solicitud pendiente");
        } else if (membership.status === "banned") {
          throw new HttpsError("permission-denied", "Estás baneado de esta comunidad");
        }
      }

      // 3. Verificar límite de miembros
      if (communityData.stats.totalMembers >= communityData.settings.maxMembers) {
        throw new HttpsError("resource-exhausted", "La comunidad ha alcanzado su límite de miembros");
      }

      // 4. Obtener información del usuario
      const userDoc = await db.collection("users").doc(userId).get();
      const userData = userDoc.data() || {};

      // 5. Determinar si auto-aprobar
      let shouldAutoApprove = false;
      let verificationMethod = "admin_approval";

      if (!communityData.settings.isPrivate) {
        shouldAutoApprove = true;
        verificationMethod = "location_based";
      } else if (userLocation && communityData.settings.autoApproveRadius > 0) {
        const distance = calculateDistance(
          userLocation.lat, userLocation.lng,
          communityData.location.lat, communityData.location.lng
        );
        
        if (distance <= communityData.settings.autoApproveRadius) {
          shouldAutoApprove = true;
          verificationMethod = "location_based";
        }
      }

      // 6. Crear membresía
      const membershipRef = db.collection("communityMemberships").doc();
      const membership: CommunityMembership = {
        communityId,
        userId,
        role: "member",
        status: shouldAutoApprove ? "approved" : "pending",
        memberInfo: {
          displayName: userData.nombre || "Usuario",
          profileImage: userData.avatarUrl,
          isProvider: !!userData.isProvider,
          isBusinessOwner: !!userData.isBusinessOwner,
          categories: userData.categoryIds || [],
          verifiedResident: false,
          joinReason
        },
        memberStats: {
          recommendationsGiven: 0,
          recommendationsReceived: 0,
          helpfulVotes: 0,
          communityScore: 50, // Score inicial
          lastActiveAt: now
        },
        verification: {
          method: verificationMethod as any
        },
        requestedAt: now
      };

      if (shouldAutoApprove) {
        membership.approvedAt = now;
        membership.joinedAt = now;
        membership.verification.verifiedAt = now;
      }

      await membershipRef.set(membership);

      // 7. Actualizar estadísticas de la comunidad
      if (shouldAutoApprove) {
        await communityDoc.ref.update({
          "stats.totalMembers": admin.firestore.FieldValue.increment(1),
          "stats.activeMembers": admin.firestore.FieldValue.increment(1),
          lastActivityAt: now,
          updatedAt: now
        });

        // Log de actividad
        await logCommunityActivity(communityId, "member_joined", userId, {
          memberName: userData.nombre || "Usuario",
          autoApproved: true
        });
      } else {
        await communityDoc.ref.update({
          "moderation.pendingRequests": admin.firestore.FieldValue.increment(1),
          updatedAt: now
        });
      }

      return {
        success: true,
        status: shouldAutoApprove ? "approved" : "pending",
        message: shouldAutoApprove ? 
          "¡Bienvenido a la comunidad!" : 
          "Solicitud enviada. Esperando aprobación de los administradores."
      };

    } catch (error) {
      console.error("❌ Error uniéndose a comunidad:", error);
      if (error instanceof HttpsError) throw error;
      throw new HttpsError("internal", "Error procesando solicitud");
    }
  }
);

/**
 * ✅ approveMembershipRequest
 * Aprobar/rechazar solicitud de membresía (solo admins/moderadores)
 */
export const approveMembershipRequest = onCall<{
  membershipId: string;
  action: 'approve' | 'reject';
  reason?: string;
}>(
  async (request) => {
    const { membershipId, action, reason } = request.data;
    const adminId = request.auth?.uid;

    if (!adminId) {
      throw new HttpsError("unauthenticated", "Usuario no autenticado");
    }

    try {
      const now = admin.firestore.Timestamp.now();

      // 1. Obtener la membresía
      const membershipDoc = await db.collection("communityMemberships").doc(membershipId).get();
      if (!membershipDoc.exists) {
        throw new HttpsError("not-found", "Solicitud no encontrada");
      }

      const membershipData = membershipDoc.data() as CommunityMembership;

      // 2. Verificar permisos del admin
      const adminMembershipSnapshot = await db
        .collection("communityMemberships")
        .where("communityId", "==", membershipData.communityId)
        .where("userId", "==", adminId)
        .where("status", "==", "approved")
        .get();

      if (adminMembershipSnapshot.empty) {
        throw new HttpsError("permission-denied", "No eres miembro de esta comunidad");
      }

      const adminMembership = adminMembershipSnapshot.docs[0].data();
      if (!["admin", "owner", "moderator"].includes(adminMembership.role)) {
        throw new HttpsError("permission-denied", "Sin permisos de moderación");
      }

      // 3. Verificar que esté pendiente
      if (membershipData.status !== "pending") {
        throw new HttpsError("failed-precondition", "La solicitud ya fue procesada");
      }

      // 4. Procesar acción
      const updateData: any = {
        status: action === 'approve' ? 'approved' : 'rejected',
        updatedAt: now
      };

      if (action === 'approve') {
        updateData.approvedAt = now;
        updateData.joinedAt = now;
        updateData['verification.verifiedBy'] = adminId;
        updateData['verification.verifiedAt'] = now;
      } else {
        updateData.rejectedAt = now;
        updateData.rejectionReason = reason;
      }

      await membershipDoc.ref.update(updateData);

      // 5. Actualizar estadísticas de la comunidad
      const communityDoc = await db.collection("communities").doc(membershipData.communityId).get();
      
      if (action === 'approve') {
        await communityDoc.ref.update({
          "stats.totalMembers": admin.firestore.FieldValue.increment(1),
          "stats.activeMembers": admin.firestore.FieldValue.increment(1),
          "moderation.pendingRequests": admin.firestore.FieldValue.increment(-1),
          lastActivityAt: now,
          updatedAt: now
        });

        // Log de actividad
        await logCommunityActivity(membershipData.communityId, "member_joined", membershipData.userId, {
          memberName: membershipData.memberInfo.displayName,
          approvedBy: adminId,
          autoApproved: false
        });
      } else {
        await communityDoc.ref.update({
          "moderation.pendingRequests": admin.firestore.FieldValue.increment(-1),
          updatedAt: now
        });
      }

      return {
        success: true,
        action,
        message: action === 'approve' ? "Miembro aprobado" : "Solicitud rechazada"
      };

    } catch (error) {
      console.error("❌ Error procesando solicitud:", error);
      if (error instanceof HttpsError) throw error;
      throw new HttpsError("internal", "Error procesando solicitud");
    }
  }
);

/**
 * 📍 Función auxiliar para calcular distancia entre coordenadas
 */
function calculateDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371e3; // Radio de la Tierra en metros
  const φ1 = lat1 * Math.PI/180;
  const φ2 = lat2 * Math.PI/180;
  const Δφ = (lat2-lat1) * Math.PI/180;
  const Δλ = (lng2-lng1) * Math.PI/180;

  const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
          Math.cos(φ1) * Math.cos(φ2) *
          Math.sin(Δλ/2) * Math.sin(Δλ/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

  return R * c; // Distancia en metros
}

/**
 * 🔍 Crear índice de búsqueda para la comunidad
 */
async function createCommunitySearchIndex(communityId: string, communityData: CommunityData) {
  try {
    const searchIndex = {
      communityId,
      searchTerms: [
        ...communityData.name.toLowerCase().split(' '),
        ...communityData.description.toLowerCase().split(' '),
        ...communityData.tags.map(tag => tag.toLowerCase()),
        communityData.location.city.toLowerCase(),
        communityData.location.state.toLowerCase(),
        communityData.type.toLowerCase()
      ].filter(term => term.length > 2), // Solo términos de más de 2 caracteres
      categories: [communityData.type],
      location: {
        lat: communityData.location.lat,
        lng: communityData.location.lng,
        city: communityData.location.city,
        state: communityData.location.state
      },
      memberCount: communityData.stats.totalMembers,
      activityScore: 0,
      popularityScore: communityData.featured ? 100 : 50,
      updatedAt: admin.firestore.Timestamp.now()
    };

    await db.collection("communitySearchIndex").doc(communityId).set(searchIndex);
  } catch (error) {
    console.error("Error creando índice de búsqueda:", error);
  }
}

/**
 * 🏷️ postRecommendationRequest
 * Publicar solicitud de recomendación con tagging de prestadores
 */
export const postRecommendationRequest = onCall<{
  communityId: string;
  content: {
    title: string;
    description: string;
    category: string;
    urgency: 'low' | 'medium' | 'high' | 'emergency';
    budget?: { min: number; max: number; currency: string };
    location?: { lat: number; lng: number; address: string };
    mediaUrls?: string[];
    preferredTime?: admin.firestore.Timestamp;
  };
  tags: {
    providerIds: string[];
    businessIds: string[];
    serviceCategories: string[];
    keywords: string[];
  };
}>(
  async (request) => {
    const { communityId, content, tags } = request.data;
    const requesterId = request.auth?.uid;

    if (!requesterId) {
      throw new HttpsError("unauthenticated", "Usuario no autenticado");
    }

    console.log(`🏷️ Nueva solicitud de recomendación en comunidad ${communityId}`);

    try {
      const now = admin.firestore.Timestamp.now();

      // 1. Verificar membresía en la comunidad
      const membershipSnapshot = await db
        .collection("communityMemberships")
        .where("communityId", "==", communityId)
        .where("userId", "==", requesterId)
        .where("status", "==", "approved")
        .get();

      if (membershipSnapshot.empty) {
        throw new HttpsError("permission-denied", "No eres miembro de esta comunidad");
      }

      // 2. Verificar rate limiting (máximo por día)
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const todayTimestamp = admin.firestore.Timestamp.fromDate(today);

      const todayRecommendationsSnapshot = await db
        .collection("communityRecommendations")
        .where("communityId", "==", communityId)
        .where("requesterId", "==", requesterId)
        .where("createdAt", ">=", todayTimestamp)
        .get();

      if (todayRecommendationsSnapshot.size >= COMMUNITY_LIMITS.MAX_RECOMMENDATIONS_PER_DAY) {
        throw new HttpsError("resource-exhausted", 
          `Máximo ${COMMUNITY_LIMITS.MAX_RECOMMENDATIONS_PER_DAY} recomendaciones por día`);
      }

      // 3. Validar tags
      if (tags.providerIds.length + tags.businessIds.length > COMMUNITY_LIMITS.MAX_TAGS_PER_RECOMMENDATION) {
        throw new HttpsError("invalid-argument", 
          `Máximo ${COMMUNITY_LIMITS.MAX_TAGS_PER_RECOMMENDATION} prestadores/negocios por recomendación`);
      }

      // 4. Verificar que los prestadores taggeados estén en la comunidad
      for (const providerId of tags.providerIds) {
        const providerInCommunitySnapshot = await db
          .collection("communityProviders")
          .where("communityId", "==", communityId)
          .where("providerId", "==", providerId)
          .where("status", "==", "active")
          .get();

        if (providerInCommunitySnapshot.empty) {
          throw new HttpsError("invalid-argument", `Prestador ${providerId} no está en la comunidad`);
        }
      }

      // 5. Calcular prioridad basada en urgencia y otros factores
      const priorityScore = calculateRecommendationPriority(content.urgency, tags, content.budget);

      // 6. Crear la recomendación
      const recommendationRef = db.collection("communityRecommendations").doc();
      const expiresAt = admin.firestore.Timestamp.fromMillis(
        now.toMillis() + (COMMUNITY_LIMITS.RECOMMENDATION_EXPIRY_DAYS * 24 * 60 * 60 * 1000)
      );

      const recommendation: CommunityRecommendation = {
        communityId,
        requesterId,
        content,
        tags,
        responses: [],
        status: "open",
        priority: priorityScore,
        viewCount: 0,
        responseCount: 0,
        helpfulResponsesCount: 0,
        createdAt: now,
        updatedAt: now,
        expiresAt
      };

      await recommendationRef.set(recommendation);

      // 7. Crear actividad en el feed
      await createFeedActivity(communityId, "recommendation_posted", requesterId, {
        recommendationId: recommendationRef.id,
        recommendationTitle: content.title,
        category: content.category,
        urgency: content.urgency
      });

      // 8. Notificar a prestadores taggeados
      await notifyTaggedProviders(tags.providerIds, {
        communityId,
        recommendationId: recommendationRef.id,
        title: content.title,
        category: content.category,
        urgency: content.urgency
      });

      // 9. Actualizar estadísticas de la comunidad
      await db.collection("communities").doc(communityId).update({
        "stats.recommendationsThisMonth": admin.firestore.FieldValue.increment(1),
        lastActivityAt: now,
        updatedAt: now
      });

      console.log(`✅ Recomendación creada: ${recommendationRef.id}`);

      return {
        success: true,
        recommendationId: recommendationRef.id,
        expiresAt: expiresAt.toMillis(),
        message: "Solicitud de recomendación publicada"
      };

    } catch (error) {
      console.error("❌ Error creando recomendación:", error);
      if (error instanceof HttpsError) throw error;
      throw new HttpsError("internal", "Error creando solicitud de recomendación");
    }
  }
);

/**
 * 💬 respondToRecommendation
 * Responder a una solicitud de recomendación
 */
export const respondToRecommendation = onCall<{
  recommendationId: string;
  responseType: 'recommendation' | 'offer' | 'comment';
  content: string;
  recommendedProviderId?: string;
  recommendedBusinessId?: string;
  rating?: number;
  price?: number;
  availability?: string;
}>(
  async (request) => {
    const { 
      recommendationId, 
      responseType, 
      content, 
      recommendedProviderId,
      recommendedBusinessId,
      rating,
      price,
      availability 
    } = request.data;
    const responderId = request.auth?.uid;

    if (!responderId) {
      throw new HttpsError("unauthenticated", "Usuario no autenticado");
    }

    try {
      const now = admin.firestore.Timestamp.now();

      // 1. Obtener la recomendación
      const recommendationDoc = await db.collection("communityRecommendations").doc(recommendationId).get();
      if (!recommendationDoc.exists) {
        throw new HttpsError("not-found", "Solicitud no encontrada");
      }

      const recommendationData = recommendationDoc.data() as CommunityRecommendation;

      // 2. Verificar que no haya expirado
      if (recommendationData.expiresAt && recommendationData.expiresAt.toMillis() < now.toMillis()) {
        throw new HttpsError("failed-precondition", "La solicitud ha expirado");
      }

      // 3. Verificar membresía en la comunidad
      const membershipSnapshot = await db
        .collection("communityMemberships")
        .where("communityId", "==", recommendationData.communityId)
        .where("userId", "==", responderId)
        .where("status", "==", "approved")
        .get();

      if (membershipSnapshot.empty) {
        throw new HttpsError("permission-denied", "No eres miembro de esta comunidad");
      }

      const responderMembership = membershipSnapshot.docs[0].data();

      // 4. Crear la respuesta
      const response = {
        responderId,
        responderType: responderMembership.memberInfo.isProvider ? 'provider' : 'member',
        responseType,
        content,
        recommendedProviderId,
        recommendedBusinessId,
        rating,
        price,
        availability,
        timestamp: now,
        helpfulVotes: 0,
        votedBy: []
      };

      // 5. Actualizar la recomendación
      await recommendationDoc.ref.update({
        responses: admin.firestore.FieldValue.arrayUnion(response),
        responseCount: admin.firestore.FieldValue.increment(1),
        updatedAt: now
      });

      // 6. Crear actividad en el feed
      await createFeedActivity(recommendationData.communityId, "recommendation_responded", responderId, {
        recommendationId,
        recommendationTitle: recommendationData.content.title,
        responseContent: content.substring(0, 100),
        responseType
      });

      // 7. Actualizar estadísticas del miembro
      await membershipSnapshot.docs[0].ref.update({
        "memberStats.recommendationsGiven": admin.firestore.FieldValue.increment(1),
        "memberStats.lastActiveAt": now
      });

      return {
        success: true,
        message: "Respuesta agregada exitosamente"
      };

    } catch (error) {
      console.error("❌ Error respondiendo recomendación:", error);
      if (error instanceof HttpsError) throw error;
      throw new HttpsError("internal", "Error agregando respuesta");
    }
  }
);

/**
 * 📱 getCommunityFeed
 * Obtener feed de actividades de la comunidad
 */
export const getCommunityFeed = onCall<{
  communityId: string;
  limit?: number;
  before?: admin.firestore.Timestamp;
  activityTypes?: string[];
}>(
  async (request) => {
    const { communityId, limit = 20, before, activityTypes } = request.data;
    const userId = request.auth?.uid;

    if (!userId) {
      throw new HttpsError("unauthenticated", "Usuario no autenticado");
    }

    try {
      // 1. Verificar membresía
      const membershipSnapshot = await db
        .collection("communityMemberships")
        .where("communityId", "==", communityId)
        .where("userId", "==", userId)
        .where("status", "==", "approved")
        .get();

      if (membershipSnapshot.empty) {
        throw new HttpsError("permission-denied", "No eres miembro de esta comunidad");
      }

      // 2. Construir query del feed
      let feedQuery = db.collection("communityFeedActivities")
        .where("communityId", "==", communityId)
        .where("visibility", "in", ["public", "members_only"])
        .orderBy("createdAt", "desc")
        .limit(Math.min(limit, 50));

      if (before) {
        feedQuery = feedQuery.where("createdAt", "<", before);
      }

      if (activityTypes && activityTypes.length > 0) {
        feedQuery = feedQuery.where("activityType", "in", activityTypes);
      }

      const feedSnapshot = await feedQuery.get();

      // 3. Procesar actividades
      const activities = feedSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));

      // 4. Obtener recomendaciones activas
      const activeRecommendationsSnapshot = await db
        .collection("communityRecommendations")
        .where("communityId", "==", communityId)
        .where("status", "==", "open")
        .orderBy("priority", "desc")
        .limit(5)
        .get();

      const activeRecommendations = activeRecommendationsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));

      return {
        success: true,
        activities,
        activeRecommendations,
        hasMore: feedSnapshot.size === limit
      };

    } catch (error) {
      console.error("❌ Error obteniendo feed:", error);
      if (error instanceof HttpsError) throw error;
      throw new HttpsError("internal", "Error obteniendo feed de la comunidad");
    }
  }
);

/**
 * ⭐ voteHelpfulResponse
 * Votar respuesta como útil
 */
export const voteHelpfulResponse = onCall<{
  recommendationId: string;
  responseIndex: number;
  vote: 'helpful' | 'not_helpful' | 'remove';
}>(
  async (request) => {
    const { recommendationId, responseIndex, vote } = request.data;
    const voterId = request.auth?.uid;

    if (!voterId) {
      throw new HttpsError("unauthenticated", "Usuario no autenticado");
    }

    try {
      const recommendationDoc = await db.collection("communityRecommendations").doc(recommendationId).get();
      if (!recommendationDoc.exists) {
        throw new HttpsError("not-found", "Recomendación no encontrada");
      }

      const recommendationData = recommendationDoc.data() as CommunityRecommendation;
      
      if (responseIndex >= recommendationData.responses.length) {
        throw new HttpsError("invalid-argument", "Respuesta no encontrada");
      }

      // Verificar membresía
      const membershipSnapshot = await db
        .collection("communityMemberships")
        .where("communityId", "==", recommendationData.communityId)
        .where("userId", "==", voterId)
        .where("status", "==", "approved")
        .get();

      if (membershipSnapshot.empty) {
        throw new HttpsError("permission-denied", "No eres miembro de esta comunidad");
      }

      // Actualizar voto
      const responses = [...recommendationData.responses];
      const response = responses[responseIndex];
      const hasVoted = response.votedBy.includes(voterId);

      if (vote === 'helpful' && !hasVoted) {
        response.helpfulVotes += 1;
        response.votedBy.push(voterId);
      } else if (vote === 'remove' && hasVoted) {
        response.helpfulVotes -= 1;
        response.votedBy = response.votedBy.filter(id => id !== voterId);
      }

      responses[responseIndex] = response;

      await recommendationDoc.ref.update({
        responses,
        updatedAt: admin.firestore.Timestamp.now()
      });

      return {
        success: true,
        newVoteCount: response.helpfulVotes
      };

    } catch (error) {
      console.error("❌ Error votando respuesta:", error);
      if (error instanceof HttpsError) throw error;
      throw new HttpsError("internal", "Error procesando voto");
    }
  }
);

/**
 * 🏆 getFeaturedProviders
 * Obtener prestadores destacados de la comunidad
 */
export const getFeaturedProviders = onCall<{
  communityId: string;
  category?: string;
  limit?: number;
}>(
  async (request) => {
    const { communityId, category, limit = 10 } = request.data;

    try {
      const providersQuery = db.collection("communityProviders")
        .where("communityId", "==", communityId)
        .where("status", "in", ["active", "featured"])
        .orderBy("priority", "desc")
        .limit(Math.min(limit, 20));

      const providersSnapshot = await providersQuery.get();
      
      // Obtener información completa de los prestadores
      const providerIds = providersSnapshot.docs.map(doc => doc.data().providerId);
      const providersInfoPromises = providerIds.map(id => 
        db.collection("providers").doc(id).get()
      );
      
      const providersInfo = await Promise.all(providersInfoPromises);
      
      const featuredProviders = providersSnapshot.docs.map((doc, index) => {
        const communityProviderData = doc.data();
        const providerInfo = providersInfo[index].data() || {};
        
        return {
          id: doc.id,
          providerId: communityProviderData.providerId,
          communityData: communityProviderData,
          providerInfo,
          localRating: communityProviderData.localMetrics.communityRating,
          localReviews: communityProviderData.localMetrics.communityReviews,
          isLocal: communityProviderData.localVerification.isLocalResident
        };
      }).filter(provider => {
        // Filtrar por categoría si se especifica
        if (category) {
          return provider.providerInfo.categoryIds?.includes(category);
        }
        return true;
      });

      return {
        success: true,
        providers: featuredProviders
      };

    } catch (error) {
      console.error("❌ Error obteniendo prestadores destacados:", error);
      throw new HttpsError("internal", "Error obteniendo prestadores destacados");
    }
  }
);

/**
 * 🔢 Calcular prioridad de recomendación
 */
function calculateRecommendationPriority(
  urgency: string, 
  tags: any, 
  budget?: { min: number; max: number }
): number {
  let priority = 50; // Base

  // Factor urgencia
  switch (urgency) {
    case 'emergency': priority += 40; break;
    case 'high': priority += 25; break;
    case 'medium': priority += 10; break;
    case 'low': priority += 0; break;
  }

  // Factor tags (más tags = más prioridad)
  priority += (tags.providerIds.length + tags.businessIds.length) * 5;

  // Factor presupuesto (presupuestos más altos = más prioridad)
  if (budget && budget.max > 0) {
    if (budget.max >= 1000) priority += 15;
    else if (budget.max >= 500) priority += 10;
    else if (budget.max >= 100) priority += 5;
  }

  return Math.min(priority, 100); // Máximo 100
}

/**
 * 🔔 Notificar prestadores taggeados
 */
async function notifyTaggedProviders(providerIds: string[], notificationData: any) {
  try {
    const notifications = providerIds.map(providerId => ({
      userId: providerId,
      type: 'community_recommendation',
      title: 'Te han mencionado en una recomendación',
      message: `Alguien solicita recomendaciones para: ${notificationData.title}`,
      data: notificationData,
      createdAt: admin.firestore.Timestamp.now(),
      read: false
    }));

    const batch = db.batch();
    notifications.forEach(notification => {
      const notificationRef = db.collection("notifications").doc();
      batch.set(notificationRef, notification);
    });

    await batch.commit();
  } catch (error) {
    console.error("Error enviando notificaciones:", error);
  }
}

/**
 * 📰 Crear actividad en el feed
 */
async function createFeedActivity(
  communityId: string,
  activityType: string,
  actorId: string,
  content: any
) {
  try {
    // Obtener información del actor
    const actorDoc = await db.collection("users").doc(actorId).get();
    const actorData = actorDoc.data() || {};

    const feedActivity: CommunityFeedActivity = {
      communityId,
      activityType: activityType as any,
      actor: {
        userId: actorId,
        displayName: actorData.nombre || "Usuario",
        profileImage: actorData.avatarUrl,
        role: actorData.role || "member"
      },
      content,
      engagement: {
        likes: 0,
        comments: 0,
        shares: 0,
        views: 0,
        likedBy: []
      },
      visibility: "members_only",
      featured: false,
      pinned: false,
      createdAt: admin.firestore.Timestamp.now(),
      relevanceScore: calculateFeedRelevanceScore(activityType, content)
    };

    await db.collection("communityFeedActivities").add(feedActivity);
  } catch (error) {
    console.error("Error creando actividad de feed:", error);
  }
}

/**
 * 📊 Calcular score de relevancia para el feed
 */
function calculateFeedRelevanceScore(activityType: string, content: any): number {
  let score = 50; // Base

  switch (activityType) {
    case 'recommendation_posted':
      score += content.urgency === 'emergency' ? 30 : 
               content.urgency === 'high' ? 20 : 
               content.urgency === 'medium' ? 10 : 0;
      break;
    case 'member_joined':
      score += 15;
      break;
    case 'business_verified':
      score += 25;
      break;
    case 'provider_featured':
      score += 20;
      break;
  }

  return Math.min(score, 100);
}

/**
 * 🏆 addProviderToCommunity
 * Agregar prestador a la comunidad con priorización local
 */
export const addProviderToCommunity = onCall<{
  communityId: string;
  providerId: string;
  localInfo: {
    isLocalResident: boolean;
    businessAddress?: string;
    servicesLocalArea: boolean;
    localExperience: number;
  };
  specialOffers?: Array<{
    title: string;
    description: string;
    discount: number;
    validUntil: admin.firestore.Timestamp;
    communityExclusive: boolean;
  }>;
}>(
  async (request) => {
    const { communityId, providerId, localInfo, specialOffers = [] } = request.data;
    const requesterId = request.auth?.uid;

    if (!requesterId) {
      throw new HttpsError("unauthenticated", "Usuario no autenticado");
    }

    try {
      const now = admin.firestore.Timestamp.now();

      // 1. Verificar que el prestador existe
      const providerDoc = await db.collection("providers").doc(providerId).get();
      if (!providerDoc.exists) {
        throw new HttpsError("not-found", "Prestador no encontrado");
      }

      // 2. Verificar que no esté ya en la comunidad
      const existingProviderSnapshot = await db
        .collection("communityProviders")
        .where("communityId", "==", communityId)
        .where("providerId", "==", providerId)
        .get();

      if (!existingProviderSnapshot.empty) {
        throw new HttpsError("already-exists", "Prestador ya está en la comunidad");
      }

      // 3. Calcular prioridad local basada en varios factores
      const priority = calculateLocalProviderPriority(localInfo, specialOffers, providerDoc.data());

      // 4. Crear registro de prestador comunitario
      const communityProviderRef = db.collection("communityProviders").doc();
      const communityProvider: CommunityProvider = {
        communityId,
        providerId,
        status: "active",
        priority,
        localMetrics: {
          communityRating: 0,
          communityReviews: 0,
          jobsCompletedInCommunity: 0,
          recommendationsReceived: 0,
          responseTime: 0,
          localExperience: localInfo.localExperience
        },
        localVerification: {
          isLocalResident: localInfo.isLocalResident,
          businessAddress: localInfo.businessAddress,
          servicesLocalArea: localInfo.servicesLocalArea,
          verifiedByMembers: [],
          verificationScore: localInfo.isLocalResident ? 50 : 25
        },
        promotion: {
          isFeatured: false,
          specialOffers
        },
        addedAt: now,
        lastActiveAt: now
      };

      await communityProviderRef.set(communityProvider);

      // 5. Actualizar estadísticas de la comunidad
      await db.collection("communities").doc(communityId).update({
        "stats.totalProviders": admin.firestore.FieldValue.increment(1),
        lastActivityAt: now,
        updatedAt: now
      });

      // 6. Crear actividad en el feed
      await createFeedActivity(communityId, "provider_featured", providerId, {
        providerName: providerDoc.data()?.nombre || "Prestador",
        categories: providerDoc.data()?.categoryIds || [],
        isLocal: localInfo.isLocalResident
      });

      return {
        success: true,
        priority,
        message: "Prestador agregado a la comunidad"
      };

    } catch (error) {
      console.error("❌ Error agregando prestador:", error);
      if (error instanceof HttpsError) throw error;
      throw new HttpsError("internal", "Error agregando prestador a la comunidad");
    }
  }
);

/**
 * 🏪 addBusinessToCommunity
 * Agregar negocio local a la comunidad
 */
export const addBusinessToCommunity = onCall<{
  communityId: string;
  businessId: string;
  localInfo: {
    isLocallyOwned: boolean;
    yearsInCommunity: number;
    employeesFromCommunity: number;
    communityInvolvement: string[];
  };
  consumeLocalProgram: {
    participates: boolean;
    discountForMembers: number;
    loyaltyProgram: boolean;
    communityEvents: boolean;
    localSuppliers: boolean;
  };
}>(
  async (request) => {
    const { communityId, businessId, localInfo, consumeLocalProgram } = request.data;
    const requesterId = request.auth?.uid;

    if (!requesterId) {
      throw new HttpsError("unauthenticated", "Usuario no autenticado");
    }

    try {
      const now = admin.firestore.Timestamp.now();

      // 1. Verificar permisos de administrador
      const adminMembershipSnapshot = await db
        .collection("communityMemberships")
        .where("communityId", "==", communityId)
        .where("userId", "==", requesterId)
        .where("status", "==", "approved")
        .get();

      if (adminMembershipSnapshot.empty) {
        throw new HttpsError("permission-denied", "No eres miembro de esta comunidad");
      }

      const adminMembership = adminMembershipSnapshot.docs[0].data();
      if (!["admin", "owner", "moderator"].includes(adminMembership.role)) {
        throw new HttpsError("permission-denied", "Sin permisos de administración");
      }

      // 2. Verificar que el negocio existe
      const businessDoc = await db.collection("fixedBusinesses").doc(businessId).get();
      if (!businessDoc.exists) {
        throw new HttpsError("not-found", "Negocio no encontrado");
      }

      // 3. Calcular puntos "Consume Local"
      const communityPoints = calculateConsumeLocalPoints(localInfo, consumeLocalProgram);

      // 4. Crear registro de negocio comunitario
      const communityBusinessRef = db.collection("communityBusinesses").doc();
      const communityBusiness: CommunityBusiness = {
        communityId,
        businessId,
        status: "active",
        businessType: "local_business",
        localInfo: {
          ...localInfo,
          preferredByMembers: 0
        },
        communityMetrics: {
          communityRating: 0,
          communityReviews: 0,
          ordersFromCommunity: 0,
          recommendationsReceived: 0,
          communityDiscountUsage: 0
        },
        consumeLocalProgram: {
          ...consumeLocalProgram,
          communityPoints
        },
        addedAt: now
      };

      await communityBusinessRef.set(communityBusiness);

      // 5. Actualizar estadísticas de la comunidad
      await db.collection("communities").doc(communityId).update({
        "stats.localBusinesses": admin.firestore.FieldValue.increment(1),
        lastActivityAt: now,
        updatedAt: now
      });

      // 6. Crear actividad en el feed
      await createFeedActivity(communityId, "business_verified", businessId, {
        businessName: businessDoc.data()?.businessName || "Negocio",
        consumeLocalPoints,
        offersDiscount: consumeLocalProgram.discountForMembers > 0
      });

      return {
        success: true,
        communityPoints,
        message: "Negocio agregado a la comunidad"
      };

    } catch (error) {
      console.error("❌ Error agregando negocio:", error);
      if (error instanceof HttpsError) throw error;
      throw new HttpsError("internal", "Error agregando negocio a la comunidad");
    }
  }
);

/**
 * 🔍 searchLocalProviders
 * Buscar prestadores priorizando los locales
 */
export const searchLocalProviders = onCall<{
  communityId: string;
  category: string;
  location?: { lat: number; lng: number };
  prioritizeLocal?: boolean;
  limit?: number;
}>(
  async (request) => {
    const { communityId, category, location, prioritizeLocal = true, limit = 20 } = request.data;
    const userId = request.auth?.uid;

    try {
      // 1. Obtener prestadores de la comunidad
      const communityProvidersSnapshot = await db
        .collection("communityProviders")
        .where("communityId", "==", communityId)
        .where("status", "==", "active")
        .get();

      // 2. Obtener información completa de los prestadores
      const providerPromises = communityProvidersSnapshot.docs.map(async (doc) => {
        const communityProviderData = doc.data();
        const providerDoc = await db.collection("providers").doc(communityProviderData.providerId).get();
        const providerData = providerDoc.data() || {};

        // Filtrar por categoría
        if (category && !providerData.categoryIds?.includes(category)) {
          return null;
        }

        return {
          ...communityProviderData,
          providerInfo: providerData,
          combinedScore: calculateCombinedProviderScore(
            communityProviderData,
            providerData,
            location,
            prioritizeLocal
          )
        };
      });

      const allProviders = (await Promise.all(providerPromises))
        .filter(provider => provider !== null)
        .sort((a, b) => b.combinedScore - a.combinedScore)
        .slice(0, limit);

      return {
        success: true,
        providers: allProviders,
        localProvidersCount: allProviders.filter(p => p.localVerification.isLocalResident).length
      };

    } catch (error) {
      console.error("❌ Error buscando prestadores locales:", error);
      throw new HttpsError("internal", "Error en búsqueda de prestadores");
    }
  }
);

/**
 * 🚨 reportCommunityContent
 * Reportar contenido inapropiado en la comunidad
 */
export const reportCommunityContent = onCall<{
  communityId: string;
  contentId: string;
  contentType: 'recommendation' | 'response' | 'member' | 'business';
  reason: string;
  description?: string;
}>(
  async (request) => {
    const { communityId, contentId, contentType, reason, description } = request.data;
    const reporterId = request.auth?.uid;

    if (!reporterId) {
      throw new HttpsError("unauthenticated", "Usuario no autenticado");
    }

    try {
      const now = admin.firestore.Timestamp.now();

      // 1. Verificar membresía
      const membershipSnapshot = await db
        .collection("communityMemberships")
        .where("communityId", "==", communityId)
        .where("userId", "==", reporterId)
        .where("status", "==", "approved")
        .get();

      if (membershipSnapshot.empty) {
        throw new HttpsError("permission-denied", "No eres miembro de esta comunidad");
      }

      // 2. Verificar que no haya reportado el mismo contenido antes
      const existingReportSnapshot = await db
        .collection("communityReports")
        .where("communityId", "==", communityId)
        .where("contentId", "==", contentId)
        .where("reportedBy", "==", reporterId)
        .get();

      if (!existingReportSnapshot.empty) {
        throw new HttpsError("already-exists", "Ya reportaste este contenido");
      }

      // 3. Crear el reporte
      const reportRef = db.collection("communityReports").doc();
      const report = {
        id: reportRef.id,
        communityId,
        contentId,
        contentType,
        reportedBy: reporterId,
        reason,
        description,
        priority: calculateReportPriority(reason, contentType),
        status: "pending",
        createdAt: now,
        reviewedAt: null,
        reviewedBy: null,
        action: null
      };

      await reportRef.set(report);

      // 4. Actualizar moderación de la comunidad
      const moderationDoc = await db.collection("communityModerations").doc(communityId).get();
      
      if (moderationDoc.exists) {
        await moderationDoc.ref.update({
          pendingReports: admin.firestore.FieldValue.arrayUnion({
            reportId: reportRef.id,
            reportedContentId: contentId,
            reportedContentType: contentType,
            reportedBy: reporterId,
            reason,
            priority: report.priority,
            status: "pending",
            createdAt: now
          }),
          "stats.totalReports": admin.firestore.FieldValue.increment(1),
          updatedAt: now
        });
      }

      // 5. Auto-moderación si alcanza el umbral
      const contentReportsSnapshot = await db
        .collection("communityReports")
        .where("contentId", "==", contentId)
        .where("status", "==", "pending")
        .get();

      if (contentReportsSnapshot.size >= 3) {
        await handleAutoModeration(communityId, contentId, contentType, contentReportsSnapshot.size);
      }

      return {
        success: true,
        reportId: reportRef.id,
        message: "Reporte enviado a los moderadores"
      };

    } catch (error) {
      console.error("❌ Error reportando contenido:", error);
      if (error instanceof HttpsError) throw error;
      throw new HttpsError("internal", "Error enviando reporte");
    }
  }
);

/**
 * ⚖️ moderateContent
 * Moderar contenido reportado (solo moderadores)
 */
export const moderateContent = onCall<{
  reportId: string;
  action: 'approve' | 'remove' | 'warn' | 'suspend';
  reason?: string;
  duration?: number; // días para suspensión
}>(
  async (request) => {
    const { reportId, action, reason, duration } = request.data;
    const moderatorId = request.auth?.uid;

    if (!moderatorId) {
      throw new HttpsError("unauthenticated", "Usuario no autenticado");
    }

    try {
      const now = admin.firestore.Timestamp.now();

      // 1. Obtener el reporte
      const reportDoc = await db.collection("communityReports").doc(reportId).get();
      if (!reportDoc.exists) {
        throw new HttpsError("not-found", "Reporte no encontrado");
      }

      const reportData = reportDoc.data();

      // 2. Verificar permisos de moderador
      const moderatorMembershipSnapshot = await db
        .collection("communityMemberships")
        .where("communityId", "==", reportData.communityId)
        .where("userId", "==", moderatorId)
        .where("status", "==", "approved")
        .get();

      if (moderatorMembershipSnapshot.empty) {
        throw new HttpsError("permission-denied", "No eres miembro de esta comunidad");
      }

      const moderatorMembership = moderatorMembershipSnapshot.docs[0].data();
      if (!["admin", "owner", "moderator"].includes(moderatorMembership.role)) {
        throw new HttpsError("permission-denied", "Sin permisos de moderación");
      }

      // 3. Aplicar acción de moderación
      await applyModerationAction(reportData, action, moderatorId, reason, duration);

      // 4. Actualizar el reporte
      await reportDoc.ref.update({
        status: "resolved",
        reviewedAt: now,
        reviewedBy: moderatorId,
        action,
        moderationReason: reason,
        updatedAt: now
      });

      // 5. Log de acción de moderación
      await logModerationAction(reportData.communityId, {
        actionType: action,
        targetId: reportData.contentId,
        targetType: reportData.contentType,
        moderatorId,
        reason: reason || `Acción automática: ${action}`,
        duration,
        timestamp: now
      });

      return {
        success: true,
        action,
        message: "Acción de moderación aplicada"
      };

    } catch (error) {
      console.error("❌ Error moderando contenido:", error);
      if (error instanceof HttpsError) throw error;
      throw new HttpsError("internal", "Error aplicando moderación");
    }
  }
);

/**
 * 🔢 Calcular prioridad local del prestador
 */
function calculateLocalProviderPriority(
  localInfo: any,
  specialOffers: any[],
  providerData: any
): number {
  let priority = 50; // Base

  // Factor residencia local
  if (localInfo.isLocalResident) priority += 25;

  // Factor experiencia local
  priority += Math.min(localInfo.localExperience * 2, 15);

  // Factor servicios en área local
  if (localInfo.servicesLocalArea) priority += 10;

  // Factor ofertas especiales
  priority += Math.min(specialOffers.length * 3, 10);

  // Factor rating general
  if (providerData.rating) {
    priority += (providerData.rating - 3) * 5; // Rating base 3, +5 por cada punto adicional
  }

  return Math.min(priority, 100);
}

/**
 * 🏪 Calcular puntos "Consume Local"
 */
function calculateConsumeLocalPoints(localInfo: any, consumeLocalProgram: any): number {
  let points = 0;

  // Puntos por ser local
  if (localInfo.isLocallyOwned) points += 30;

  // Puntos por años en la comunidad
  points += Math.min(localInfo.yearsInCommunity * 5, 25);

  // Puntos por empleados locales
  points += Math.min(localInfo.employeesFromCommunity * 2, 15);

  // Puntos por participación en programa
  if (consumeLocalProgram.participates) points += 20;
  if (consumeLocalProgram.loyaltyProgram) points += 10;
  if (consumeLocalProgram.communityEvents) points += 15;
  if (consumeLocalProgram.localSuppliers) points += 10;

  // Puntos por descuento a miembros
  if (consumeLocalProgram.discountForMembers > 0) {
    points += Math.min(consumeLocalProgram.discountForMembers, 15);
  }

  return Math.min(points, 100);
}

/**
 * 📊 Calcular score combinado del prestador
 */
function calculateCombinedProviderScore(
  communityProviderData: any,
  providerData: any,
  location?: { lat: number; lng: number },
  prioritizeLocal = true
): number {
  let score = 0;

  // Factor prioridad local (50% del score si se prioriza local)
  if (prioritizeLocal) {
    score += communityProviderData.priority * 0.5;
  } else {
    score += communityProviderData.priority * 0.2;
  }

  // Factor rating general (30% del score)
  if (providerData.rating) {
    score += (providerData.rating / 5) * 30;
  }

  // Factor métricas locales (20% del score)
  if (communityProviderData.localMetrics.communityRating > 0) {
    score += (communityProviderData.localMetrics.communityRating / 5) * 20;
  }

  // Bonus por ser residente local
  if (prioritizeLocal && communityProviderData.localVerification.isLocalResident) {
    score += 10;
  }

  // Factor distancia (si se proporciona ubicación)
  if (location && providerData.currentLocation) {
    const distance = calculateDistance(
      location.lat, location.lng,
      providerData.currentLocation.lat, providerData.currentLocation.lng
    );
    
    // Bonus por proximidad (máximo 10 puntos)
    if (distance < 1000) score += 10; // < 1km
    else if (distance < 5000) score += 5; // < 5km
  }

  return Math.min(score, 100);
}

/**
 * 🚨 Calcular prioridad del reporte
 */
function calculateReportPriority(reason: string, contentType: string): 'low' | 'medium' | 'high' {
  const highPriorityReasons = ['spam', 'harassment', 'inappropriate_content', 'fraud'];
  const highPriorityTypes = ['member', 'business'];

  if (highPriorityReasons.includes(reason) || highPriorityTypes.includes(contentType)) {
    return 'high';
  }

  if (reason === 'misleading_information' || contentType === 'recommendation') {
    return 'medium';
  }

  return 'low';
}

/**
 * 🤖 Auto-moderación por umbral de reportes
 */
async function handleAutoModeration(
  communityId: string,
  contentId: string,
  contentType: string,
  reportCount: number
) {
  try {
    if (reportCount >= 5) {
      // Auto-remover contenido con muchos reportes
      await applyModerationAction({
        communityId,
        contentId,
        contentType
      }, 'remove', 'system', 'Auto-removido por múltiples reportes');
    } else if (reportCount >= 3) {
      // Auto-ocultar temporalmente
      await applyModerationAction({
        communityId,
        contentId,
        contentType
      }, 'warn', 'system', 'Auto-marcado para revisión');
    }
  } catch (error) {
    console.error("Error en auto-moderación:", error);
  }
}

/**
 * ⚖️ Aplicar acción de moderación
 */
async function applyModerationAction(
  reportData: any,
  action: string,
  moderatorId: string,
  reason?: string,
  duration?: number
) {
  try {
    const now = admin.firestore.Timestamp.now();

    switch (action) {
      case 'remove':
        if (reportData.contentType === 'recommendation') {
          await db.collection("communityRecommendations").doc(reportData.contentId).update({
            status: 'removed',
            moderatedAt: now,
            moderatedBy: moderatorId,
            moderationReason: reason
          });
        }
        break;

      case 'suspend':
        if (reportData.contentType === 'member' && duration) {
          const suspendUntil = admin.firestore.Timestamp.fromMillis(
            now.toMillis() + (duration * 24 * 60 * 60 * 1000)
          );
          
          await db.collection("communityMemberships")
            .where("communityId", "==", reportData.communityId)
            .where("userId", "==", reportData.contentId)
            .get()
            .then(snapshot => {
              if (!snapshot.empty) {
                return snapshot.docs[0].ref.update({
                  status: 'suspended',
                  suspendedAt: now,
                  suspendedUntil: suspendUntil,
                  suspensionReason: reason
                });
              }
            });
        }
        break;

      case 'warn':
        // Crear notificación de advertencia
        await db.collection("notifications").add({
          userId: reportData.reportedBy || reportData.contentId,
          type: 'community_warning',
          title: 'Advertencia de moderación',
          message: reason || 'Tu contenido ha sido reportado y está bajo revisión',
          communityId: reportData.communityId,
          createdAt: now,
          read: false
        });
        break;
    }
  } catch (error) {
    console.error("Error aplicando acción de moderación:", error);
  }
}

/**
 * 📝 Log de acción de moderación
 */
async function logModerationAction(communityId: string, actionData: any) {
  try {
    // Actualizar colección de moderación de la comunidad
    const moderationDoc = await db.collection("communityModerations").doc(communityId).get();
    
    if (moderationDoc.exists) {
      await moderationDoc.ref.update({
        moderationActions: admin.firestore.FieldValue.arrayUnion(actionData),
        "stats.resolvedReports": admin.firestore.FieldValue.increment(1),
        updatedAt: admin.firestore.Timestamp.now()
      });
    }

    // Log en actividad de la comunidad
    await logCommunityActivity(communityId, "moderation_action", actionData.moderatorId, {
      actionType: actionData.actionType,
      targetType: actionData.targetType,
      reason: actionData.reason
    });
  } catch (error) {
    console.error("Error logging acción de moderación:", error);
  }
}

/**
 * 📊 Log de actividad de la comunidad
 */
async function logCommunityActivity(
  communityId: string, 
  activityType: string, 
  actorId: string, 
  metadata: any
) {
  try {
    await db.collection("communityActivityLogs").add({
      communityId,
      activityType,
      actorId,
      metadata,
      timestamp: admin.firestore.Timestamp.now(),
      visibility: 'public'
    });
  } catch (error) {
    console.error("Error logging actividad:", error);
  }
}