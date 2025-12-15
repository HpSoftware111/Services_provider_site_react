const { Lead, ServiceRequest, Business, User, ProviderProfile, Category, SubCategory } = require('../models');
const { Op } = require('sequelize');

/**
 * Assign leads to fallback businesses (other selected businesses, typically 2-4) after 24 hours
 * if the priority provider hasn't accepted the lead
 * 
 * Note: If customer selected fewer than 3 businesses total, fallbackBusinessIds might be 1 or 0.
 * In such cases, we assign to whatever businesses are available.
 * 
 * @param {number} serviceRequestId - The service request ID
 * @param {Array<number>} fallbackBusinessIds - Business IDs to assign leads to (can be 1-4 businesses)
 * @returns {Promise<Array>} Array of created leads
 */
async function assignFallbackLeads(serviceRequestId, fallbackBusinessIds) {
    try {
        if (!fallbackBusinessIds || fallbackBusinessIds.length === 0) {
            console.log(`[assignFallbackLeads] No fallback businesses to assign for service request ${serviceRequestId}`);
            return [];
        }

        // Get service request
        const serviceRequest = await ServiceRequest.findByPk(serviceRequestId, {
            include: [
                { model: User, as: 'customer', attributes: ['id', 'name', 'email', 'phone', 'firstName', 'lastName'] },
                { model: Category, as: 'category', attributes: ['id', 'name'] },
                { model: SubCategory, as: 'subCategory', attributes: ['id', 'name'], required: false }
            ]
        });

        if (!serviceRequest) {
            console.error(`[assignFallbackLeads] Service request ${serviceRequestId} not found`);
            return [];
        }

        // Check if lead was already accepted
        const existingAcceptedLead = await Lead.findOne({
            where: {
                businessId: { [Op.in]: fallbackBusinessIds },
                status: 'accepted',
                metadata: {
                    [Op.like]: `%"serviceRequestId":${serviceRequestId}%`
                }
            }
        });

        if (existingAcceptedLead) {
            console.log(`[assignFallbackLeads] Lead already accepted for service request ${serviceRequestId}, skipping fallback assignment`);
            return [];
        }

        // Get customer info
        const customer = serviceRequest.customer;
        const customerName = customer?.firstName && customer?.lastName
            ? `${customer.firstName} ${customer.lastName}`
            : customer?.name || customer?.email || 'Customer';

        // Get category info
        const categoryName = serviceRequest.category?.name || 'Service';
        const subCategoryName = serviceRequest.subCategory?.name || null;

        // Get businesses
        const businesses = await Business.findAll({
            where: {
                id: { [Op.in]: fallbackBusinessIds },
                isActive: true,
                ownerId: { [Op.ne]: null }
            },
            include: [
                {
                    model: User,
                    as: 'owner',
                    attributes: ['id', 'name', 'email', 'phone', 'firstName', 'lastName'],
                    required: true
                }
            ]
        });

        console.log(`[assignFallbackLeads] Assigning leads to ${businesses.length} fallback businesses for service request ${serviceRequestId}`);

        // Create leads for each fallback business
        const createdLeads = [];
        for (const business of businesses) {
            try {
                // Check if lead already exists for this business and service request
                const existingLead = await Lead.findOne({
                    where: {
                        businessId: business.id,
                        providerId: business.owner.id,
                        metadata: {
                            [Op.like]: `%"serviceRequestId":${serviceRequestId}%`
                        }
                    }
                });

                if (existingLead) {
                    console.log(`[assignFallbackLeads] Lead already exists for business ${business.id}, skipping`);
                    continue;
                }

                const locationCity = business.city || null;
                const locationState = business.state || null;

                const lead = await Lead.create({
                    customerId: customer.id,
                    businessId: business.id,
                    providerId: business.owner.id,
                    serviceType: subCategoryName
                        ? `${categoryName} - ${subCategoryName}`
                        : categoryName,
                    categoryId: serviceRequest.categoryId,
                    locationCity: locationCity,
                    locationState: locationState,
                    locationPostalCode: serviceRequest.zipCode,
                    description: serviceRequest.projectDescription,
                    // DO NOT include customer contact details - they will be shown only after acceptance
                    customerName: null,
                    customerEmail: null,
                    customerPhone: null,
                    preferredContact: 'either',
                    status: 'submitted',
                    routedAt: new Date(),
                    metadata: JSON.stringify({
                        serviceRequestId: serviceRequest.id,
                        projectTitle: serviceRequest.projectTitle,
                        preferredDate: serviceRequest.preferredDate,
                        preferredTime: serviceRequest.preferredTime,
                        attachments: serviceRequest.attachments,
                        isFallbackLead: true, // Mark as fallback lead
                        priorityExpired: true
                    })
                });

                createdLeads.push(lead);
                console.log(`[assignFallbackLeads] ✅ Created fallback lead ${lead.id} for business ${business.id}`);
            } catch (error) {
                console.error(`[assignFallbackLeads] ❌ Error creating lead for business ${business.id}:`, error);
            }
        }

        return createdLeads;
    } catch (error) {
        console.error(`[assignFallbackLeads] Error assigning fallback leads:`, error);
        return [];
    }
}

module.exports = assignFallbackLeads;
