const express = require('express');
const router = express.Router();
const { Op, Sequelize } = require('sequelize');
const {
    ServiceRequest,
    ProviderProfile,
    User,
    Lead,
    Proposal,
    WorkOrder,
    Review,
    Business,
    Category,
    SubCategory
} = require('../models');
const AlternativeProviderSelection = require('../models/AlternativeProviderSelection');
const { protect, authorize } = require('../middleware/auth');
const logActivity = require('../utils/logActivity');
const stripe = require('../config/stripe');
const sendEmail = require('../utils/sendEmail');
const processProviderPayout = require('../utils/processProviderPayout');
const getSubscriptionBenefits = require('../utils/getSubscriptionBenefits');

// Test route to verify router is working
router.get('/test', (req, res) => {
    res.json({ success: true, message: 'Service requests router is working!' });
});

/**
 * Assign providers to a service request
 * Selects 1 primary provider and up to 3 alternatives based on ranking
 * @param {number} serviceRequestId - The service request ID
 * @returns {Promise<{primary: Object, alternatives: Array}>}
 */
async function assignProvidersForRequest(serviceRequestId) {
    try {
        // Get service request with details
        const serviceRequest = await ServiceRequest.findByPk(serviceRequestId, {
            include: [
                { model: Category, as: 'category', attributes: ['id', 'name'] },
                { model: SubCategory, as: 'subCategory', attributes: ['id', 'name'], required: false }
            ]
        });

        if (!serviceRequest) {
            throw new Error('Service request not found');
        }

        // Find matching businesses by category and zip code
        console.log(`[assignProvidersForRequest] Searching for businesses: categoryId=${serviceRequest.categoryId}, zipCode=${serviceRequest.zipCode}`);

        const matchingBusinesses = await Business.findAll({
            where: {
                categoryId: serviceRequest.categoryId,
                zipCode: serviceRequest.zipCode,
                isActive: true,
                ownerId: { [Op.ne]: null }
            },
            include: [
                {
                    model: User,
                    as: 'owner',
                    attributes: ['id', 'name', 'email', 'firstName', 'lastName', 'phone'],
                    required: true
                }
            ]
        });

        console.log(`[assignProvidersForRequest] Found ${matchingBusinesses.length} matching businesses by category and zip code`);

        // Also include selected businesses if any
        let selectedBusinesses = [];
        if (serviceRequest.selectedBusinessIds && Array.isArray(serviceRequest.selectedBusinessIds) && serviceRequest.selectedBusinessIds.length > 0) {
            console.log(`[assignProvidersForRequest] Also searching for ${serviceRequest.selectedBusinessIds.length} selected businesses`);
            selectedBusinesses = await Business.findAll({
                where: {
                    id: { [Op.in]: serviceRequest.selectedBusinessIds },
                    ownerId: { [Op.ne]: null }
                },
                include: [
                    {
                        model: User,
                        as: 'owner',
                        attributes: ['id', 'name', 'email', 'firstName', 'lastName', 'phone'],
                        required: true
                    }
                ]
            });
            console.log(`[assignProvidersForRequest] Found ${selectedBusinesses.length} selected businesses`);
        }

        // Combine and deduplicate businesses
        const allBusinesses = [...matchingBusinesses, ...selectedBusinesses];
        const uniqueBusinesses = Array.from(
            new Map(allBusinesses.map(b => [b.id, b])).values()
        );

        console.log(`[assignProvidersForRequest] Total unique businesses after deduplication: ${uniqueBusinesses.length}`);

        // Get provider profiles for each business owner and rank them
        console.log(`[assignProvidersForRequest] Processing ${uniqueBusinesses.length} unique businesses for service request ${serviceRequestId}`);

        const providersWithScores = await Promise.all(
            uniqueBusinesses.map(async (business) => {
                if (!business.owner) {
                    console.log(`[assignProvidersForRequest] Business ${business.id} has no owner`);
                    return null;
                }

                console.log(`[assignProvidersForRequest] Checking business ${business.id} (owner: ${business.owner.id}, email: ${business.owner.email})`);

                // Safety check: Exclude businesses owned by the customer who created the request
                // This prevents providers from being assigned to their own service requests
                if (business.owner.id === serviceRequest.customerId) {
                    console.log(`[assignProvidersForRequest] ⚠️ Skipping business ${business.id} - owned by customer who created the request (userId: ${serviceRequest.customerId})`);
                    return null;
                }

                // Find or create provider profile for business owner
                // Business owners should automatically have ProviderProfiles to receive leads
                let providerProfile = await ProviderProfile.findOne({
                    where: { userId: business.owner.id },
                    attributes: ['id', 'userId']
                });

                if (!providerProfile) {
                    console.log(`[assignProvidersForRequest] ⚠️ Business ${business.id} owner (userId: ${business.owner.id}) has no ProviderProfile - creating one automatically`);
                    try {
                        // Auto-create ProviderProfile for business owner
                        // Only set userId - let database handle defaults for other fields
                        providerProfile = await ProviderProfile.create({
                            userId: business.owner.id
                        }, {
                            fields: ['userId'] // Only set userId field to avoid issues with non-existent columns
                        });
                        console.log(`[assignProvidersForRequest] ✅ Created ProviderProfile (id: ${providerProfile.id}) for business owner userId=${business.owner.id}`);
                    } catch (createError) {
                        console.error(`[assignProvidersForRequest] ❌ Failed to create ProviderProfile for userId=${business.owner.id}:`, createError.message);
                        console.error(`[assignProvidersForRequest] Error details:`, {
                            name: createError.name,
                            code: createError.code,
                            sqlState: createError.sqlState,
                            sqlMessage: createError.sqlMessage
                        });
                        // If creation fails (e.g., duplicate key due to race condition), try to find it again
                        providerProfile = await ProviderProfile.findOne({
                            where: { userId: business.owner.id },
                            attributes: ['id', 'userId']
                        });
                        if (!providerProfile) {
                            console.log(`[assignProvidersForRequest] ⚠️ Still no ProviderProfile found after creation attempt - skipping business ${business.id}`);
                            return null;
                        } else {
                            console.log(`[assignProvidersForRequest] ✅ Found ProviderProfile (id: ${providerProfile.id}) after creation error (likely race condition)`);
                        }
                    }
                } else {
                    console.log(`[assignProvidersForRequest] ✅ Business ${business.id} owner has ProviderProfile (id: ${providerProfile.id})`);
                }

                // Calculate score for ranking
                let score = 0;

                // Use Business rating instead of ProviderProfile rating (since ProviderProfile doesn't have rating columns in DB)
                // Business rating bonus (max 50 points)
                const businessRating = parseFloat(business.ratingAverage) || 0;
                score += businessRating * 10; // Max 50 points (5.0 * 10)

                // Business review count bonus (max 20 points)
                const businessReviewCount = parseInt(business.ratingCount) || 0;
                score += Math.min(businessReviewCount / 10, 20); // 1 point per 10 reviews, max 20

                // Category match bonus (if business category matches request category, +10 points)
                if (business.categoryId === serviceRequest.categoryId) {
                    score += 10;
                }

                // Subcategory match bonus (if business subcategory matches request subcategory, +10 points)
                if (serviceRequest.subCategoryId && business.subCategoryId === serviceRequest.subCategoryId) {
                    score += 10;
                }

                // Zip code match bonus (if business zip code matches request zip code, +5 points)
                if (business.zipCode === serviceRequest.zipCode) {
                    score += 5;
                }

                // Selected business bonus (if customer specifically selected this business, +20 points)
                if (serviceRequest.selectedBusinessIds && Array.isArray(serviceRequest.selectedBusinessIds)) {
                    if (serviceRequest.selectedBusinessIds.includes(business.id)) {
                        score += 20;
                    }
                }

                // Subscription priority boost (add boost points if user has active subscription)
                let isPriorityProvider = false; // Featured or Pro tier providers get leads first
                try {
                    const subscriptionBenefits = await getSubscriptionBenefits(business.owner.id);
                    if (subscriptionBenefits.hasActiveSubscription) {
                        // Check if provider is Featured or has PRO tier (priority providers)
                        isPriorityProvider = subscriptionBenefits.isFeatured === true || subscriptionBenefits.tier === 'PRO';

                        if (subscriptionBenefits.priorityBoostPoints > 0) {
                            score += subscriptionBenefits.priorityBoostPoints;
                            console.log(`[assignProvidersForRequest] Added ${subscriptionBenefits.priorityBoostPoints} priority boost points for business ${business.id} (user ${business.owner.id}, tier: ${subscriptionBenefits.tier})`);
                        }

                        if (isPriorityProvider) {
                            console.log(`[assignProvidersForRequest] ⭐ Priority provider detected: Business ${business.id} (user ${business.owner.id}, tier: ${subscriptionBenefits.tier}, isFeatured: ${subscriptionBenefits.isFeatured})`);
                        }
                    }
                } catch (subError) {
                    console.error(`[assignProvidersForRequest] Error getting subscription benefits for user ${business.owner.id}:`, subError);
                    // Continue without boost if there's an error
                }

                return {
                    business,
                    providerProfile,
                    owner: business.owner,
                    score,
                    isPriorityProvider // Flag to prioritize Featured/Pro providers
                };
            })
        );

        // Filter out nulls and sort by priority first, then by score (descending)
        // Priority: Featured providers and Pro tier subscribers get leads FIRST
        // Then the rest are sorted by score
        const validProviders = providersWithScores
            .filter(p => p !== null)
            .sort((a, b) => {
                // First priority: Featured providers or Pro tier subscribers
                // If one is priority and the other isn't, priority wins
                if (a.isPriorityProvider && !b.isPriorityProvider) {
                    return -1; // a comes first
                }
                if (!a.isPriorityProvider && b.isPriorityProvider) {
                    return 1; // b comes first
                }
                // If both are priority or both are not, sort by score (descending)
                return b.score - a.score;
            });

        console.log(`[assignProvidersForRequest] Found ${validProviders.length} valid providers after filtering`);

        if (validProviders.length === 0) {
            console.log(`[assignProvidersForRequest] ⚠️ No valid providers found. Reasons could be:`);
            console.log(`   - No businesses found matching categoryId=${serviceRequest.categoryId} and zipCode=${serviceRequest.zipCode}`);
            console.log(`   - Businesses found but owners don't have ProviderProfiles`);
            console.log(`   - All businesses were filtered out`);
            return { primary: null, alternatives: [] };
        }

        // Select primary (highest priority/score)
        const primary = validProviders[0];
        console.log(`[assignProvidersForRequest] ✅ Selected primary provider: Business ID=${primary.business.id}, Owner ID=${primary.owner.id}, Score=${primary.score}, Priority=${primary.isPriorityProvider ? 'YES (Featured/Pro)' : 'NO'}`);

        // Select up to 3 alternatives (next highest priority/scores)
        const alternatives = validProviders.slice(1, 4);
        console.log(`[assignProvidersForRequest] Selected ${alternatives.length} alternative providers`);
        alternatives.forEach((alt, index) => {
            console.log(`[assignProvidersForRequest]   Alternative ${index + 1}: Business ID=${alt.business.id}, Score=${alt.score}, Priority=${alt.isPriorityProvider ? 'YES (Featured/Pro)' : 'NO'}`);
        });

        return { primary, alternatives };
    } catch (error) {
        console.error('Error in assignProvidersForRequest:', error);
        throw error;
    }
}

// @route   GET /api/service-requests/categories/all
// @desc    Get all categories with subcategories (using categories and subcategories tables)
// @access  Public
// NOTE: This route MUST be defined before /:id route to avoid route conflicts
router.get('/categories/all', async (req, res) => {
    try {
        console.log('Categories route hit!'); // Debug log
        const categories = await Category.findAll({
            where: { isActive: true },
            attributes: ['id', 'name', 'description', 'icon'],
            include: [
                {
                    model: SubCategory,
                    as: 'subcategories',
                    attributes: ['id', 'name', 'description'],
                    required: false
                }
            ],
            order: [['name', 'ASC']]
        });

        console.log(`Found ${categories.length} categories`); // Debug log

        // Log icons to verify they're being fetched
        categories.forEach(cat => {
            console.log(`Category: ${cat.name}, Icon: ${cat.icon || 'MISSING'}`);
        });

        // Format response to match frontend expectations (subCategories instead of subcategories)
        const formattedCategories = categories.map(cat => ({
            id: cat.id,
            name: cat.name,
            description: cat.description,
            icon: cat.icon,
            subCategories: cat.subcategories || []
        }));

        res.json({
            success: true,
            categories: formattedCategories || []
        });
    } catch (error) {
        console.error('Get categories error:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Server error',
            details: process.env.NODE_ENV === 'development' ? error.stack : undefined
        });
    }
});

// @route   GET /api/service-requests
// @desc    Get all service requests (filtered by user role)
// @access  Private
router.get('/', protect, async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const offset = (page - 1) * limit;

        const where = {};

        // Filter based on user role
        if (req.user.role === 'CUSTOMER' || req.user.role === 'user') {
            where.customerId = req.user.id;
        } else if (req.user.role === 'PROVIDER' || req.user.role === 'business_owner') {
            // Get provider profile
            const providerProfile = await ProviderProfile.findOne({
                where: { userId: req.user.id },
                attributes: ['id', 'userId', 'status', 'ratingAverage', 'ratingCount']
            });

            if (providerProfile) {
                // Get requests where provider is primary or has a lead
                // NOTE: providerId references users.id, not provider_profiles.id
                const leads = await Lead.findAll({
                    where: { providerId: req.user.id }, // User ID, not ProviderProfile ID
                    attributes: ['id', 'metadata']
                });

                // Extract serviceRequestId from metadata
                const leadRequestIds = [];
                leads.forEach(lead => {
                    if (lead.metadata) {
                        try {
                            const metadata = typeof lead.metadata === 'string'
                                ? JSON.parse(lead.metadata)
                                : lead.metadata;
                            if (metadata.serviceRequestId) {
                                leadRequestIds.push(metadata.serviceRequestId);
                            }
                        } catch (e) {
                            console.error('Error parsing lead metadata:', e);
                        }
                    }
                });

                where[Op.or] = [
                    { primaryProviderId: providerProfile.id },
                    { id: { [Op.in]: leadRequestIds.length > 0 ? leadRequestIds : [-1] } } // Use [-1] if no leads to avoid empty IN clause
                ];
            } else {
                // No provider profile, return empty
                return res.json({
                    success: true,
                    count: 0,
                    total: 0,
                    page,
                    pages: 0,
                    serviceRequests: []
                });
            }
        }

        // Filter by status
        if (req.query.status) {
            where.status = req.query.status;
        }

        // Filter by category
        if (req.query.categoryId) {
            where.categoryId = req.query.categoryId;
        }

        // Use try-catch to handle missing columns gracefully if migration hasn't been run
        let count, serviceRequests;
        try {
            const result = await ServiceRequest.findAndCountAll({
                where,
                include: [
                    { model: User, as: 'customer', attributes: ['id', 'name', 'email', 'phone'] },
                    { model: Category, as: 'category', attributes: ['id', 'name', 'icon'] },
                    { model: SubCategory, as: 'subCategory', attributes: ['id', 'name'], required: false },
                    { model: ProviderProfile, as: 'primaryProvider', attributes: ['id', 'userId'], include: [{ model: User, as: 'user', attributes: ['id', 'name', 'email'] }], required: false }
                ],
                order: [['createdAt', 'DESC']],
                limit,
                offset
            });
            count = result.count;
            serviceRequests = result.rows;
        } catch (dbError) {
            // If error is about missing columns, try with explicit attributes (migration not run yet)
            if (dbError.message && dbError.message.includes('Unknown column')) {
                console.log('Migration not run yet, using explicit attributes for service requests list...');
                const result = await ServiceRequest.findAndCountAll({
                    where,
                    attributes: [
                        'id', 'customerId', 'categoryId', 'subCategoryId', 'zipCode',
                        'projectTitle', 'projectDescription', 'attachments', 'preferredDate',
                        'preferredTime', 'status', 'primaryProviderId', 'selectedBusinessIds',
                        'createdAt', 'updatedAt'
                    ],
                    include: [
                        { model: User, as: 'customer', attributes: ['id', 'name', 'email', 'phone'] },
                        { model: Category, as: 'category', attributes: ['id', 'name', 'icon'] },
                        { model: SubCategory, as: 'subCategory', attributes: ['id', 'name'], required: false },
                        { model: ProviderProfile, as: 'primaryProvider', attributes: ['id', 'userId'], include: [{ model: User, as: 'user', attributes: ['id', 'name', 'email'] }], required: false }
                    ],
                    order: [['createdAt', 'DESC']],
                    limit,
                    offset
                });
                count = result.count;
                serviceRequests = result.rows;
            } else {
                throw dbError;
            }
        }

        res.json({
            success: true,
            count: serviceRequests.length,
            total: count,
            page,
            pages: Math.ceil(count / limit),
            serviceRequests
        });
    } catch (error) {
        console.error('Get service requests error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// @route   GET /api/service-requests/my/service-requests
// @desc    Get current user's service requests with pagination and filters
// @access  Private (Customer and Provider)
// NOTE: This route MUST be defined before /:id route to avoid route conflicts
router.get('/my/service-requests', protect, async (req, res) => {
    try {
        // Allow customers and providers (business_owner) to access their own requests
        if (req.user.role !== 'CUSTOMER' && req.user.role !== 'user' && req.user.role !== 'business_owner') {
            return res.status(403).json({
                success: false,
                error: 'Access denied. This endpoint is for customers and providers only.'
            });
        }

        const page = parseInt(req.query.page) || 1;
        const pageSize = parseInt(req.query.pageSize) || 10;
        const offset = (page - 1) * pageSize;
        const status = req.query.status;

        const where = {
            customerId: req.user.id
        };

        // Filter by status if provided
        if (status && status !== 'ALL') {
            where.status = status;
        }
        // When status is 'ALL', include all statuses including COMPLETED and CLOSED
        // No filtering needed - show all requests

        // Get total count for pagination
        const total = await ServiceRequest.count({ where });

        // Fetch service requests with related data
        // Use try-catch to handle missing columns gracefully if migration hasn't been run
        let serviceRequests;
        try {
            serviceRequests = await ServiceRequest.findAll({
                where,
                include: [
                    {
                        model: Category,
                        as: 'category',
                        attributes: ['id', 'name', 'icon']
                    },
                    {
                        model: SubCategory,
                        as: 'subCategory',
                        attributes: ['id', 'name'],
                        required: false
                    },
                    {
                        model: ProviderProfile,
                        as: 'primaryProvider',
                        attributes: ['id', 'userId'],
                        include: [{
                            model: User,
                            as: 'user',
                            attributes: ['id', 'name', 'email', 'phone']
                        }],
                        required: false
                    }
                ],
                order: [['createdAt', 'DESC']],
                limit: pageSize,
                offset: offset
            });
        } catch (dbError) {
            // If error is about missing columns, try with explicit attributes (migration not run yet)
            if (dbError.message && dbError.message.includes('Unknown column')) {
                console.log('Migration not run yet, using explicit attributes...');
                serviceRequests = await ServiceRequest.findAll({
                    where,
                    attributes: [
                        'id', 'customerId', 'categoryId', 'subCategoryId', 'zipCode',
                        'projectTitle', 'projectDescription', 'attachments', 'preferredDate',
                        'preferredTime', 'status', 'primaryProviderId', 'selectedBusinessIds',
                        'createdAt', 'updatedAt'
                    ],
                    include: [
                        {
                            model: Category,
                            as: 'category',
                            attributes: ['id', 'name', 'icon']
                        },
                        {
                            model: SubCategory,
                            as: 'subCategory',
                            attributes: ['id', 'name'],
                            required: false
                        },
                        {
                            model: ProviderProfile,
                            as: 'primaryProvider',
                            attributes: ['id', 'userId'],
                            include: [{
                                model: User,
                                as: 'user',
                                attributes: ['id', 'name', 'email', 'phone']
                            }],
                            required: false
                        }
                    ],
                    order: [['createdAt', 'DESC']],
                    limit: pageSize,
                    offset: offset
                });
            } else {
                throw dbError;
            }
        }

        // Format response
        const data = serviceRequests.map(request => ({
            id: request.id,
            projectTitle: request.projectTitle,
            categoryName: request.category?.name || 'N/A',
            subCategoryName: request.subCategory?.name || null,
            zipCode: request.zipCode,
            status: request.status,
            createdAt: request.createdAt,
            preferredDate: request.preferredDate,
            preferredTime: request.preferredTime
        }));

        res.json({
            success: true,
            data,
            pagination: {
                page,
                pageSize,
                total,
                pages: Math.ceil(total / pageSize)
            }
        });
    } catch (error) {
        console.error('Get my service requests error:', error);
        console.error('Error stack:', error.stack);
        res.status(500).json({
            success: false,
            error: error.message || 'Server error'
        });
    }
});

// @route   GET /api/service-requests/my/service-requests/:id
// @desc    Get single service request detail for current user
// @access  Private (Customer and Provider)
// NOTE: This route MUST be defined before /:id route to avoid route conflicts
router.get('/my/service-requests/:id', protect, async (req, res) => {
    try {
        // Allow customers and providers (business_owner) to access their own requests
        if (req.user.role !== 'CUSTOMER' && req.user.role !== 'user' && req.user.role !== 'business_owner') {
            return res.status(403).json({
                success: false,
                error: 'Access denied. This endpoint is for customers and providers only.'
            });
        }

        const requestId = parseInt(req.params.id);
        if (isNaN(requestId)) {
            return res.status(400).json({
                success: false,
                error: 'Invalid request ID'
            });
        }

        // Find service request
        // Use try-catch to handle missing columns gracefully if migration hasn't been run
        let serviceRequest;
        try {
            serviceRequest = await ServiceRequest.findOne({
                where: {
                    id: requestId,
                    customerId: req.user.id
                },
                include: [
                    {
                        model: Category,
                        as: 'category',
                        attributes: ['id', 'name', 'icon', 'description']
                    },
                    {
                        model: SubCategory,
                        as: 'subCategory',
                        attributes: ['id', 'name', 'description'],
                        required: false
                    },
                    {
                        model: ProviderProfile,
                        as: 'primaryProvider',
                        attributes: ['id', 'userId'],
                        include: [{
                            model: User,
                            as: 'user',
                            attributes: ['id', 'name', 'email', 'phone', 'avatar']
                        }],
                        required: false
                    }
                ]
            });
        } catch (dbError) {
            // If error is about missing columns, try with explicit attributes (migration not run yet)
            if (dbError.message && dbError.message.includes('Unknown column')) {
                console.log('Migration not run yet, using explicit attributes for service request detail...');
                serviceRequest = await ServiceRequest.findOne({
                    where: {
                        id: requestId,
                        customerId: req.user.id
                    },
                    attributes: [
                        'id', 'customerId', 'categoryId', 'subCategoryId', 'zipCode',
                        'projectTitle', 'projectDescription', 'attachments', 'preferredDate',
                        'preferredTime', 'status', 'primaryProviderId', 'selectedBusinessIds',
                        'createdAt', 'updatedAt'
                    ],
                    include: [
                        {
                            model: Category,
                            as: 'category',
                            attributes: ['id', 'name', 'icon', 'description']
                        },
                        {
                            model: SubCategory,
                            as: 'subCategory',
                            attributes: ['id', 'name', 'description'],
                            required: false
                        },
                        {
                            model: ProviderProfile,
                            as: 'primaryProvider',
                            attributes: ['id', 'userId'],
                            include: [{
                                model: User,
                                as: 'user',
                                attributes: ['id', 'name', 'email', 'phone', 'avatar']
                            }],
                            required: false
                        }
                    ]
                });
            } else {
                throw dbError;
            }
        }

        if (!serviceRequest) {
            return res.status(404).json({
                success: false,
                error: 'Service request not found'
            });
        }

        // Get leads for this service request (from metadata)
        // Query all leads and filter by metadata.serviceRequestId
        // Note: Lead, Proposal, Business, ProviderProfile, and Op are already imported at the top

        // Get all leads (we'll filter by metadata below to find ones for this service request)
        // Use try-catch to handle missing columns gracefully if migration hasn't been run
        let allLeads;
        try {
            allLeads = await Lead.findAll({
                where: {
                    // Get leads for this customer, or we'll filter by metadata
                    customerId: req.user.id
                },
                include: [
                    {
                        model: User,
                        as: 'provider',
                        attributes: ['id', 'name', 'email', 'phone'],
                        required: false,
                        include: [{
                            model: ProviderProfile,
                            as: 'providerProfile',
                            attributes: ['id', 'userId'],
                            required: false
                        }]
                    },
                    {
                        model: Business,
                        as: 'business',
                        attributes: ['id', 'name'],
                        required: false
                    }
                ]
            });
        } catch (dbError) {
            // If error is about missing columns, try with explicit attributes (migration not run yet)
            if (dbError.message && dbError.message.includes('Unknown column')) {
                console.log('Migration not run yet, using explicit attributes for leads in service request detail...');
                allLeads = await Lead.findAll({
                    where: {
                        customerId: req.user.id
                    },
                    attributes: [
                        'id', 'customerId', 'businessId', 'providerId', 'serviceType', 'categoryId',
                        'locationCity', 'locationState', 'locationPostalCode', 'description', 'budgetRange',
                        'preferredContact', 'customerName', 'customerEmail', 'customerPhone', 'membershipTierRequired',
                        'status', 'stripePaymentIntentId', 'leadCost', 'statusHistory', 'metadata', 'routedAt',
                        'createdAt', 'updatedAt'
                    ],
                    include: [
                        {
                            model: User,
                            as: 'provider',
                            attributes: ['id', 'name', 'email', 'phone'],
                            required: false,
                            include: [{
                                model: ProviderProfile,
                                as: 'providerProfile',
                                attributes: ['id', 'userId'],
                                required: false
                            }]
                        },
                        {
                            model: Business,
                            as: 'business',
                            attributes: ['id', 'name'],
                            required: false
                        }
                    ]
                });
            } else {
                throw dbError;
            }
        }

        // Filter leads that belong to this service request
        const serviceRequestLeads = [];
        const serviceRequestProposals = [];

        for (const lead of allLeads) {
            if (lead.metadata) {
                try {
                    const metadata = typeof lead.metadata === 'string'
                        ? JSON.parse(lead.metadata)
                        : lead.metadata;
                    if (metadata.serviceRequestId === requestId) {
                        serviceRequestLeads.push({
                            id: lead.id,
                            status: lead.status,
                            provider: lead.provider ? {
                                id: lead.provider.id,
                                name: lead.provider.name,
                                email: lead.provider.email,
                                phone: lead.provider.phone || null
                            } : null,
                            business: lead.business ? {
                                id: lead.business.id,
                                name: lead.business.name
                            } : null,
                            rejectedAt: lead.status === 'rejected' ? lead.updatedAt : null
                        });

                        // Check if lead has pending proposal in metadata
                        // Show if:
                        // 1. Has pending proposal in metadata
                        // 2. Lead status is submitted/routed (with or without payment intent)
                        // 3. OR lead status is rejected (to show rejected proposals)
                        // 4. OR lead status is accepted (to show accepted proposals)
                        const hasPendingProposal = metadata.pendingProposal &&
                            (
                                (lead.status === 'submitted' || lead.status === 'routed') ||
                                lead.status === 'rejected' ||
                                lead.status === 'accepted'
                            );

                        if (hasPendingProposal) {
                            const pendingProposal = metadata.pendingProposal;
                            const proposalPrice = pendingProposal.price ? parseFloat(pendingProposal.price) : 0;

                            console.log(`[Get Request Details] Found pending proposal in lead ${lead.id}:`, {
                                description: pendingProposal.description ? `${pendingProposal.description.substring(0, 50)}...` : 'EMPTY',
                                price: proposalPrice,
                                status: lead.status,
                                hasPaymentIntent: !!lead.stripePaymentIntentId
                            });

                            // Determine proposal status from metadata or lead status
                            let proposalStatus = 'SENT'; // Default
                            if (pendingProposal.status) {
                                proposalStatus = pendingProposal.status; // Use status from metadata (REJECTED, ACCEPTED, etc.)
                            } else if (lead.status === 'rejected') {
                                proposalStatus = 'REJECTED'; // If lead is rejected, proposal is rejected
                            } else if (lead.status === 'accepted') {
                                proposalStatus = 'ACCEPTED'; // If lead is accepted, proposal is accepted
                            }

                            // Create proposal object from lead metadata
                            // Only show provider contact info if proposal is ACCEPTED
                            const isAccepted = proposalStatus === 'ACCEPTED';
                            serviceRequestProposals.push({
                                id: `pending-${lead.id}`, // Temporary ID
                                details: pendingProposal.description || '',
                                price: proposalPrice,
                                status: proposalStatus, // Use actual status from metadata or lead
                                providerPayoutAmount: null, // Will be calculated after payment
                                platformFeeAmount: null, // Will be calculated after payment
                                payoutStatus: null, // No payout yet
                                payoutProcessedAt: null,
                                provider: lead.provider ? {
                                    id: lead.provider.id,
                                    name: lead.provider.name || 'Provider',
                                    email: isAccepted ? (lead.provider.email || null) : null,
                                    phone: null // Phone not available from lead metadata
                                } : null,
                                createdAt: lead.updatedAt || new Date() // Use lead update time
                            });
                        }
                    }
                } catch (e) {
                    console.error('Error parsing lead metadata:', e);
                }
            }
        }

        // Get proposals for this service request
        console.log(`[Get Request Details] Fetching proposals for serviceRequestId=${requestId}`);

        // Define base attributes (columns that always exist)
        const baseAttributes = [
            'id', 'serviceRequestId', 'providerId', 'details', 'price',
            'status', 'stripePaymentIntentId', 'paymentStatus', 'paidAt',
            'createdAt', 'updatedAt'
        ];

        // Try to include payout fields, but handle if they don't exist yet
        let proposalAttributes = [...baseAttributes];
        try {
            // Check if payout columns exist by attempting a test query
            // If they exist, add them to attributes
            proposalAttributes.push('providerPayoutAmount', 'platformFeeAmount', 'payoutStatus', 'payoutProcessedAt', 'stripeTransferId');
        } catch (e) {
            // If columns don't exist, use base attributes only
            console.log('Payout columns not found, using base attributes only');
        }

        const proposals = await Proposal.findAll({
            where: {
                serviceRequestId: requestId
            },
            attributes: proposalAttributes,
            include: [
                {
                    model: ProviderProfile,
                    as: 'provider',
                    attributes: ['id', 'userId'],
                    include: [{
                        model: User,
                        as: 'user',
                        attributes: ['id', 'name', 'email', 'phone'],
                        required: false
                    }],
                    required: false
                }
            ],
            order: [['createdAt', 'DESC']],
            // Use raw query to handle missing columns gracefully
            raw: false
        }).catch(async (error) => {
            // If error is due to missing columns, retry with base attributes only
            if (error.message && error.message.includes('Unknown column')) {
                console.log('Retrying proposal query with base attributes only (payout columns not migrated yet)');
                return await Proposal.findAll({
                    where: {
                        serviceRequestId: requestId
                    },
                    attributes: baseAttributes,
                    include: [
                        {
                            model: ProviderProfile,
                            as: 'provider',
                            attributes: ['id', 'userId'],
                            include: [{
                                model: User,
                                as: 'user',
                                attributes: ['id', 'name', 'email'],
                                required: false
                            }],
                            required: false
                        }
                    ],
                    order: [['createdAt', 'DESC']]
                });
            }
            throw error;
        });

        console.log(`[Get Request Details] Found ${proposals.length} proposals for serviceRequestId=${requestId}`);

        // Create a set of provider user IDs that already have Proposal records
        // This helps us avoid duplicates from lead metadata
        const providersWithProposals = new Set();
        proposals.forEach(proposal => {
            if (proposal.provider?.user?.id) {
                // Use provider.user.id (which is the User.id, same as lead.providerId)
                providersWithProposals.add(proposal.provider.user.id);
            }
        });

        console.log(`[Get Request Details] Providers with Proposal records (user IDs):`, Array.from(providersWithProposals));

        // Filter out pending proposals from metadata if a Proposal record already exists for that provider
        // This prevents duplicates when a proposal has been accepted and payment completed
        const filteredPendingProposals = serviceRequestProposals.filter(pendingProposal => {
            // If it's a pending proposal (id starts with "pending-"), check if provider has a Proposal record
            if (pendingProposal.id && pendingProposal.id.startsWith('pending-')) {
                const providerUserId = pendingProposal.provider?.id; // This is the User.id from lead.providerId
                if (providerUserId && providersWithProposals.has(providerUserId)) {
                    console.log(`[Get Request Details] Filtering out duplicate pending proposal for provider ${providerUserId} (Proposal record exists)`);
                    return false; // Filter out - Proposal record exists
                }
            }
            return true; // Keep - no Proposal record exists yet
        });

        // Replace serviceRequestProposals with filtered list
        serviceRequestProposals.length = 0;
        serviceRequestProposals.push(...filteredPendingProposals);

        serviceRequestProposals.push(...proposals.map(proposal => {
            // Ensure price is a number
            let proposalPrice = 0;
            if (proposal.price) {
                proposalPrice = typeof proposal.price === 'string' ? parseFloat(proposal.price) : parseFloat(proposal.price);
                if (isNaN(proposalPrice)) {
                    proposalPrice = 0;
                }
            }

            // Only show provider contact info if proposal is ACCEPTED
            const isAccepted = (proposal.status || 'SENT') === 'ACCEPTED';
            const proposalData = {
                id: proposal.id,
                details: proposal.details || '',
                price: proposalPrice,
                status: proposal.status || 'SENT',
                providerPayoutAmount: proposal.providerPayoutAmount ? parseFloat(proposal.providerPayoutAmount) : null,
                platformFeeAmount: proposal.platformFeeAmount ? parseFloat(proposal.platformFeeAmount) : null,
                payoutStatus: proposal.payoutStatus || null,
                payoutProcessedAt: proposal.payoutProcessedAt || null,
                provider: proposal.provider?.user ? {
                    id: proposal.provider.user.id,
                    name: proposal.provider.user.name || 'Provider',
                    email: isAccepted ? (proposal.provider.user.email || null) : null,
                    phone: isAccepted ? (proposal.provider.user.phone || null) : null
                } : (proposal.provider ? {
                    id: proposal.provider.id,
                    name: 'Provider',
                    email: null,
                    phone: null
                } : null),
                createdAt: proposal.createdAt || new Date()
            };

            console.log(`[Get Request Details] Proposal ${proposal.id}:`, {
                id: proposalData.id,
                details: proposalData.details ? `${proposalData.details.substring(0, 50)}...` : 'EMPTY',
                price: proposalData.price,
                priceType: typeof proposalData.price,
                status: proposalData.status,
                hasProvider: !!proposalData.provider,
                providerName: proposalData.provider?.name
            });

            return proposalData;
        }));

        console.log(`[Get Request Details] Total proposals formatted: ${serviceRequestProposals.length}`);

        // Format alternative providers from leads
        // Only show provider contact info if their proposal has been ACCEPTED
        const alternativeProviders = serviceRequestLeads
            .filter(lead => lead.status === 'accepted' && lead.provider)
            .map(lead => {
                // Check if there's an accepted proposal from this provider
                const providerProposal = serviceRequestProposals.find(
                    p => p.provider?.id === lead.provider.id && p.status === 'ACCEPTED'
                );
                const isAccepted = !!providerProposal;

                return {
                    id: lead.provider.id,
                    name: lead.provider.name,
                    email: isAccepted ? (lead.provider.email || null) : null,
                    phone: isAccepted ? (lead.provider.phone || null) : null
                };
            });

        // Parse attachments and selectedBusinessIds if they're strings
        let attachments = serviceRequest.attachments;
        if (typeof attachments === 'string') {
            try {
                attachments = JSON.parse(attachments);
            } catch (e) {
                attachments = [];
            }
        }
        if (!Array.isArray(attachments)) {
            attachments = [];
        }

        let selectedBusinessIds = serviceRequest.selectedBusinessIds;
        if (typeof selectedBusinessIds === 'string') {
            try {
                selectedBusinessIds = JSON.parse(selectedBusinessIds);
            } catch (e) {
                selectedBusinessIds = [];
            }
        }
        if (!Array.isArray(selectedBusinessIds)) {
            selectedBusinessIds = [];
        }

        // Format response
        const response = {
            id: serviceRequest.id,
            projectTitle: serviceRequest.projectTitle,
            projectDescription: serviceRequest.projectDescription,
            categoryName: serviceRequest.category?.name || 'N/A',
            categoryId: serviceRequest.categoryId,
            subCategoryName: serviceRequest.subCategory?.name || null,
            subCategoryId: serviceRequest.subCategoryId,
            zipCode: serviceRequest.zipCode,
            status: serviceRequest.status,
            attachments: attachments,
            preferredDate: serviceRequest.preferredDate,
            preferredTime: serviceRequest.preferredTime,
            selectedBusinessIds: selectedBusinessIds,
            primaryProvider: serviceRequest.primaryProvider ? {
                id: serviceRequest.primaryProvider.id,
                name: serviceRequest.primaryProvider.user?.name || 'Unknown',
                email: serviceRequest.primaryProvider.user?.email,
                phone: serviceRequest.primaryProvider.user?.phone,
                avatar: serviceRequest.primaryProvider.user?.avatar
            } : null,
            alternativeProviders: alternativeProviders,
            proposals: serviceRequestProposals,
            leads: serviceRequestLeads,
            rejectedLeads: serviceRequestLeads.filter(lead => lead.status === 'rejected'),
            workOrders: [],
            createdAt: serviceRequest.createdAt,
            updatedAt: serviceRequest.updatedAt
        };

        res.json({
            success: true,
            data: response
        });
    } catch (error) {
        console.error('Get service request detail error:', error);
        res.status(500).json({
            success: false,
            error: 'Server error'
        });
    }
});

// @route   PATCH /api/service-requests/my/service-requests/:id/cancel
// @desc    Cancel a service request
// @access  Private (Customer and Provider)
router.patch('/my/service-requests/:id/cancel', protect, async (req, res) => {
    try {
        // Allow customers and providers (business_owner) to cancel their own requests
        if (req.user.role !== 'CUSTOMER' && req.user.role !== 'user' && req.user.role !== 'business_owner') {
            return res.status(403).json({
                success: false,
                error: 'Access denied. This endpoint is for customers and providers only.'
            });
        }

        const requestId = parseInt(req.params.id);
        if (isNaN(requestId)) {
            return res.status(400).json({
                success: false,
                error: 'Invalid request ID'
            });
        }

        // Find service request
        const serviceRequest = await ServiceRequest.findOne({
            where: {
                id: requestId,
                customerId: req.user.id
            }
        });

        if (!serviceRequest) {
            return res.status(404).json({
                success: false,
                error: 'Service request not found'
            });
        }

        // Check if request can be cancelled
        const cancellableStatuses = ['REQUEST_CREATED', 'LEAD_ASSIGNED'];
        if (!cancellableStatuses.includes(serviceRequest.status)) {
            return res.status(400).json({
                success: false,
                error: `Cannot cancel request with status: ${serviceRequest.status}. Only requests with status REQUEST_CREATED or LEAD_ASSIGNED can be cancelled.`
            });
        }

        // Get optional rejection reason from request body
        const { rejectionReason, rejectionReasonOther } = req.body;

        // Update status using update() method to ensure it's saved correctly
        console.log('Cancelling service request:', serviceRequest.id);
        console.log('Current status:', serviceRequest.status);
        console.log('Setting status to: CLOSED');

        // Use try-catch to handle missing columns gracefully if migration hasn't been run
        try {
            await serviceRequest.update({
                status: 'CLOSED',
                rejectionReason: rejectionReason || null,
                rejectionReasonOther: rejectionReason === 'OTHER' ? rejectionReasonOther : null
            });
        } catch (updateError) {
            // If error is about missing columns, only update status (migration not run yet)
            if (updateError.message && updateError.message.includes('Unknown column')) {
                console.log('Migration not run yet, updating only status field...');
                await serviceRequest.update({
                    status: 'CLOSED'
                });
                // Log a warning that rejection reasons weren't saved
                console.warn('⚠️ Rejection reasons provided but not saved - migration not run yet');
            } else {
                throw updateError;
            }
        }

        // Reload to get the updated status
        await serviceRequest.reload();

        console.log('Status after update:', serviceRequest.status);
        console.log('Verification - status is:', serviceRequest.getDataValue('status'));

        // Process pending payout if work was approved before cancellation
        // Find the accepted proposal for this service request and process payout if pending
        try {
            const acceptedProposal = await Proposal.findOne({
                where: {
                    serviceRequestId: serviceRequest.id,
                    status: 'ACCEPTED',
                    paymentStatus: 'succeeded'
                }
            });

            if (acceptedProposal) {
                const payoutStatus = acceptedProposal.payoutStatus;
                // Process payout if it's pending or null (not yet processed) - even if cancelled, provider should get paid for approved work
                if (!payoutStatus || payoutStatus === 'pending') {
                    console.log(`[Cancel Request] Processing pending payout for proposal ${acceptedProposal.id} after cancelling service request`);
                    // Process payout asynchronously (don't block response)
                    processProviderPayout(acceptedProposal, serviceRequest)
                        .then(() => {
                            console.log(`✅ Payout processed for proposal ${acceptedProposal.id} after service request cancelled`);
                        })
                        .catch(err => {
                            // Error is already logged in processProviderPayout
                            console.error(`[Cancel Request] Payout processing encountered an error for proposal ${acceptedProposal.id}. Check processProviderPayout logs for details.`);
                        });
                } else if (payoutStatus === 'completed') {
                    console.log(`[Cancel Request] ✅ Proposal ${acceptedProposal.id} payout already completed (status: ${payoutStatus})`);
                } else {
                    console.log(`[Cancel Request] ⚠️ Proposal ${acceptedProposal.id} payout status: ${payoutStatus} (not processing - may need manual review)`);
                }
            }
        } catch (payoutError) {
            // Log error but don't fail the cancellation
            console.error(`[Cancel Request] Error checking/processing payout:`, payoutError.message);
        }

        // Log activity
        await logActivity({
            type: 'service_request_cancelled',
            description: `Service request "${serviceRequest.projectTitle}" cancelled by customer`,
            userId: req.user.id,
            metadata: { serviceRequestId: serviceRequest.id }
        });

        res.json({
            success: true,
            message: 'Service request cancelled successfully',
            data: {
                id: serviceRequest.id,
                status: serviceRequest.status
            }
        });
    } catch (error) {
        console.error('Cancel service request error:', error);
        res.status(500).json({
            success: false,
            error: 'Server error'
        });
    }
});

// @route   POST /api/service-requests/my/service-requests/:id/proposals/:proposalId/create-payment-intent
// @desc    Create Stripe Payment Intent for proposal acceptance
// @access  Private (Customer and Provider)
router.post('/my/service-requests/:id/proposals/:proposalId/create-payment-intent', protect, async (req, res) => {
    try {
        // Allow customers and providers (business_owner) to create payment intents for their requests
        if (req.user.role !== 'CUSTOMER' && req.user.role !== 'user' && req.user.role !== 'business_owner') {
            return res.status(403).json({
                success: false,
                error: 'Access denied. This endpoint is for customers and providers only.'
            });
        }

        const requestId = parseInt(req.params.id);
        const proposalIdParam = req.params.proposalId;

        if (isNaN(requestId)) {
            return res.status(400).json({
                success: false,
                error: 'Invalid request ID'
            });
        }

        // Find service request
        const serviceRequest = await ServiceRequest.findOne({
            where: {
                id: requestId,
                customerId: req.user.id
            },
            include: [{
                model: Category,
                as: 'category',
                attributes: ['id', 'name']
            }]
        });

        if (!serviceRequest) {
            return res.status(404).json({
                success: false,
                error: 'Service request not found'
            });
        }

        // Check if this is a pending proposal (from lead metadata)
        let proposal = null;
        let isPendingProposal = false;
        let leadId = null;
        let pendingProposalData = null;

        if (proposalIdParam.startsWith('pending-')) {
            // Extract lead ID from "pending-{leadId}"
            leadId = parseInt(proposalIdParam.replace('pending-', ''));

            if (isNaN(leadId)) {
                return res.status(400).json({
                    success: false,
                    error: 'Invalid pending proposal ID'
                });
            }

            // Find the lead and get pending proposal from metadata
            // Note: Lead.providerId refers to User.id (not ProviderProfile.id)
            // Use try-catch to handle missing columns gracefully if migration hasn't been run
            let lead;
            try {
                lead = await Lead.findOne({
                    where: {
                        id: leadId
                        // Don't filter by customerId - leads might not have it set
                    },
                    include: [
                        {
                            model: User,
                            as: 'provider', // Lead.providerId -> User.id
                            attributes: ['id', 'name', 'email'],
                            required: false
                        }
                    ]
                });
            } catch (dbError) {
                // If error is about missing columns, try with explicit attributes (migration not run yet)
                if (dbError.message && dbError.message.includes('Unknown column')) {
                    console.log('Migration not run yet, using explicit attributes for lead in create payment intent...');
                    lead = await Lead.findOne({
                        where: {
                            id: leadId
                        },
                        attributes: [
                            'id', 'customerId', 'businessId', 'providerId', 'serviceType', 'categoryId',
                            'locationCity', 'locationState', 'locationPostalCode', 'description', 'budgetRange',
                            'preferredContact', 'customerName', 'customerEmail', 'customerPhone', 'membershipTierRequired',
                            'status', 'stripePaymentIntentId', 'leadCost', 'statusHistory', 'metadata', 'routedAt',
                            'createdAt', 'updatedAt'
                        ],
                        include: [
                            {
                                model: User,
                                as: 'provider',
                                attributes: ['id', 'name', 'email'],
                                required: false
                            }
                        ]
                    });
                } else {
                    throw dbError;
                }
            }

            if (!lead) {
                return res.status(404).json({
                    success: false,
                    error: 'Lead not found'
                });
            }

            // Get ProviderProfile if provider exists
            let providerProfile = null;
            if (lead.providerId) {
                providerProfile = await ProviderProfile.findOne({
                    where: { userId: lead.providerId },
                    attributes: ['id', 'userId'],
                    include: [{
                        model: User,
                        as: 'user',
                        attributes: ['id', 'name', 'email'],
                        required: false
                    }]
                });
            }

            // Check if lead has pending proposal in metadata
            if (lead.metadata) {
                try {
                    const metadata = typeof lead.metadata === 'string'
                        ? JSON.parse(lead.metadata)
                        : lead.metadata;

                    if (metadata.pendingProposal && metadata.serviceRequestId === requestId) {
                        isPendingProposal = true;
                        pendingProposalData = {
                            id: `pending-${lead.id}`,
                            price: parseFloat(metadata.pendingProposal.price || 0),
                            details: metadata.pendingProposal.description || '',
                            status: 'SENT',
                            provider: providerProfile ? {
                                id: providerProfile.id,
                                userId: providerProfile.userId,
                                user: providerProfile.user || lead.provider,
                                providerProfileId: providerProfile.id
                            } : (lead.provider ? {
                                id: null,
                                userId: lead.provider.id,
                                user: lead.provider,
                                providerProfileId: null
                            } : null),
                            // NOTE: Do NOT include lead.stripePaymentIntentId here
                            // That's for the LEAD FEE payment ($5), not the PROPOSAL payment ($33,333)
                            // Proposal payment intent will be created separately when customer pays
                            leadId: lead.id
                        };
                    } else {
                        return res.status(404).json({
                            success: false,
                            error: 'Pending proposal not found in lead metadata'
                        });
                    }
                } catch (e) {
                    console.error('Error parsing lead metadata:', e);
                    return res.status(400).json({
                        success: false,
                        error: 'Invalid lead metadata'
                    });
                }
            } else {
                return res.status(404).json({
                    success: false,
                    error: 'Lead has no pending proposal'
                });
            }
        } else {
            // Regular proposal ID - find the actual Proposal record
            const proposalId = parseInt(proposalIdParam);

            if (isNaN(proposalId)) {
                return res.status(400).json({
                    success: false,
                    error: 'Invalid proposal ID'
                });
            }

            proposal = await Proposal.findOne({
                where: {
                    id: proposalId,
                    serviceRequestId: requestId,
                    status: 'SENT'
                },
                include: [{
                    model: ProviderProfile,
                    as: 'provider',
                    attributes: ['id', 'userId'],
                    include: [{
                        model: User,
                        as: 'user',
                        attributes: ['id', 'name', 'email']
                    }]
                }]
            });

            if (!proposal) {
                return res.status(404).json({
                    success: false,
                    error: 'Proposal not found or already processed'
                });
            }
        }

        // Check if Stripe is configured
        if (!process.env.STRIPE_SECRET_KEY) {
            return res.status(500).json({
                success: false,
                error: 'Payment system not configured. Please contact support.'
            });
        }

        // Use pending proposal data if available, otherwise use regular proposal
        const proposalPrice = isPendingProposal
            ? pendingProposalData.price
            : parseFloat(proposal.price);

        // IMPORTANT: For pending proposals, do NOT use lead.stripePaymentIntentId
        // because that's for the LEAD FEE payment ($5), not the PROPOSAL payment ($33,333)
        // Lead fee payment intent is stored in Lead.stripePaymentIntentId (provider pays this)
        // Proposal payment intent should be stored in Proposal.stripePaymentIntentId (customer pays this)
        // For pending proposals, check if a Proposal record exists with a payment intent
        let stripePaymentIntentId = null;

        if (isPendingProposal) {
            // For pending proposals, check if a Proposal record was already created (by webhook or accept endpoint)
            // and has a payment intent for the proposal price
            const existingProposal = await Proposal.findOne({
                where: {
                    serviceRequestId: requestId,
                    // Try to find by lead's provider
                    providerId: pendingProposalData.provider?.providerProfileId ?
                        pendingProposalData.provider.providerProfileId : null
                },
                attributes: ['id', 'stripePaymentIntentId', 'price']
            });

            if (existingProposal && existingProposal.stripePaymentIntentId) {
                // Check if this payment intent is for the proposal price, not lead fee
                try {
                    const pi = await stripe.paymentIntents.retrieve(existingProposal.stripePaymentIntentId);
                    const proposalPriceInCents = Math.round(proposalPrice * 100);
                    if (pi.amount === proposalPriceInCents) {
                        // This payment intent is for the proposal price - use it
                        stripePaymentIntentId = existingProposal.stripePaymentIntentId;
                        console.log(`[Create Payment Intent] Found existing proposal payment intent ${stripePaymentIntentId} for proposal price`);
                    } else {
                        console.log(`[Create Payment Intent] Existing proposal payment intent amount (${pi.amount} cents) doesn't match proposal price (${proposalPriceInCents} cents), will create new one`);
                    }
                } catch (e) {
                    console.log(`[Create Payment Intent] Could not verify existing proposal payment intent:`, e.message);
                }
            }

            // DO NOT use lead.stripePaymentIntentId - that's for lead fee, not proposal payment
            // stripePaymentIntentId remains null if no proposal payment intent found
        } else {
            // For regular proposals, use the proposal's payment intent ID
            stripePaymentIntentId = proposal.stripePaymentIntentId;
        }

        // If proposal already has a payment intent, check its status with Stripe
        if (stripePaymentIntentId) {
            try {
                const existingPaymentIntent = await stripe.paymentIntents.retrieve(stripePaymentIntentId);

                console.log(`[Create Payment Intent] Found existing payment intent ${stripePaymentIntentId}, status: ${existingPaymentIntent.status}, amount: ${existingPaymentIntent.amount}`);

                // CRITICAL: Check if payment intent amount matches proposal price
                const expectedAmountInCents = Math.round(proposalPrice * 100);
                if (existingPaymentIntent.amount !== expectedAmountInCents) {
                    console.warn(`[Create Payment Intent] Payment intent amount mismatch! Existing: ${existingPaymentIntent.amount} cents ($${(existingPaymentIntent.amount / 100).toFixed(2)}), Expected: ${expectedAmountInCents} cents ($${proposalPrice.toFixed(2)}). Creating new payment intent.`);

                    // Cancel the old payment intent if it's not in a terminal state
                    if (existingPaymentIntent.status !== 'canceled' &&
                        existingPaymentIntent.status !== 'succeeded' &&
                        existingPaymentIntent.status !== 'payment_failed') {
                        try {
                            await stripe.paymentIntents.cancel(stripePaymentIntentId);
                            console.log(`[Create Payment Intent] Canceled old payment intent ${stripePaymentIntentId} due to amount mismatch`);
                        } catch (cancelError) {
                            console.error(`[Create Payment Intent] Failed to cancel old payment intent:`, cancelError.message);
                            // Continue anyway - we'll create a new one
                        }
                    }

                    // Clear the old payment intent ID from database so we create a new one
                    // NOTE: For pending proposals, we don't clear lead.stripePaymentIntentId
                    // because that's for the lead fee payment, not the proposal payment
                    if (!isPendingProposal && proposalIdParam && !proposalIdParam.startsWith('pending-')) {
                        const proposalId = parseInt(proposalIdParam);
                        if (!isNaN(proposalId)) {
                            const proposalToUpdate = await Proposal.findByPk(proposalId);
                            if (proposalToUpdate) {
                                proposalToUpdate.stripePaymentIntentId = null;
                                proposalToUpdate.paymentStatus = 'pending';
                                await proposalToUpdate.save();
                                console.log(`[Create Payment Intent] Cleared old payment intent ID from proposal ${proposalId}`);
                            }
                        }
                    }

                    // Don't return existing payment intent - continue to create new one below
                } else {
                    // Amount matches - proceed with existing payment intent
                    // If payment already succeeded in Stripe, return succeeded status
                    if (existingPaymentIntent.status === 'succeeded') {
                        console.log(`[Create Payment Intent] Payment already succeeded in Stripe with correct amount`);
                        return res.json({
                            success: true,
                            clientSecret: existingPaymentIntent.client_secret,
                            amount: proposalPrice,
                            paymentStatus: 'succeeded',
                            paymentIntentId: existingPaymentIntent.id
                        });
                    }

                    // If payment intent exists but not succeeded, return existing client secret
                    // This allows the user to complete the payment
                    if (existingPaymentIntent.status === 'requires_payment_method' ||
                        existingPaymentIntent.status === 'requires_confirmation' ||
                        existingPaymentIntent.status === 'processing') {
                        console.log(`[Create Payment Intent] Payment intent exists with correct amount but not succeeded, returning client secret`);
                        return res.json({
                            success: true,
                            clientSecret: existingPaymentIntent.client_secret,
                            amount: proposalPrice,
                            paymentStatus: existingPaymentIntent.status,
                            paymentIntentId: existingPaymentIntent.id
                        });
                    }

                    // If payment intent is in a terminal state (canceled, failed), create a new one
                    if (existingPaymentIntent.status === 'canceled' || existingPaymentIntent.status === 'payment_failed') {
                        console.log(`[Create Payment Intent] Payment intent is ${existingPaymentIntent.status}, creating new one`);
                        // Continue to create new payment intent below
                    }
                }
            } catch (stripeError) {
                // If payment intent doesn't exist or is invalid, create a new one
                console.log('[Create Payment Intent] Existing payment intent check failed, creating new one:', stripeError.message);
                // Continue to create new payment intent below
            }
        }

        // Create new Payment Intent
        const amountInCents = Math.round(proposalPrice * 100);

        // Validate proposal price before creating payment intent
        if (!proposalPrice || isNaN(proposalPrice) || proposalPrice <= 0) {
            console.error(`[Create Payment Intent] Invalid proposal price: ${proposalPrice}`);
            return res.status(400).json({
                success: false,
                error: `Invalid proposal price: $${proposalPrice}. Please contact support.`
            });
        }

        console.log(`[Create Payment Intent] Creating new payment intent with amount: $${proposalPrice.toFixed(2)} (${amountInCents} cents)`);

        // Get provider ID for metadata
        let providerId = null;
        if (isPendingProposal) {
            // For pending proposals, get userId from provider.user
            providerId = pendingProposalData.provider?.user?.id || pendingProposalData.provider?.userId || null;
        } else {
            // For regular proposals, get userId from provider.user
            providerId = proposal.provider?.user?.id || proposal.provider?.userId || null;
        }

        const paymentIntent = await stripe.paymentIntents.create({
            amount: amountInCents,
            currency: 'usd',
            metadata: {
                serviceRequestId: serviceRequest.id.toString(),
                proposalId: isPendingProposal ? `pending-${leadId}` : proposal.id.toString(),
                customerId: req.user.id.toString(),
                providerId: providerId ? providerId.toString() : '',
                projectTitle: serviceRequest.projectTitle,
                isPendingProposal: isPendingProposal ? 'true' : 'false',
                leadId: isPendingProposal ? leadId.toString() : ''
            },
            description: `Payment for: ${serviceRequest.projectTitle}`,
            automatic_payment_methods: {
                enabled: true
            }
        });

        // Update proposal with payment intent ID
        // IMPORTANT: For pending proposals, we need to create or update a Proposal record
        // Do NOT update lead.stripePaymentIntentId - that's for lead fee payment
        if (isPendingProposal) {
            // For pending proposals, check if Proposal record exists, if not create it
            let proposalRecord = await Proposal.findOne({
                where: {
                    serviceRequestId: requestId,
                    providerId: pendingProposalData.provider?.providerProfileId || null
                }
            });

            if (!proposalRecord) {
                // Create Proposal record from pending proposal data
                const providerProfileId = pendingProposalData.provider?.providerProfileId;
                if (!providerProfileId) {
                    return res.status(400).json({
                        success: false,
                        error: 'Provider profile not found. Cannot create proposal payment intent.'
                    });
                }

                proposalRecord = await Proposal.create({
                    serviceRequestId: requestId,
                    providerId: providerProfileId,
                    details: pendingProposalData.details || '',
                    price: proposalPrice,
                    status: 'SENT',
                    stripePaymentIntentId: paymentIntent.id,
                    paymentStatus: 'pending'
                });
                console.log(`[Create Payment Intent] Created Proposal record ${proposalRecord.id} for pending proposal`);
            } else {
                // Update existing Proposal record with payment intent ID
                proposalRecord.stripePaymentIntentId = paymentIntent.id;
                proposalRecord.paymentStatus = 'pending';
                await proposalRecord.save();
                console.log(`[Create Payment Intent] Updated Proposal record ${proposalRecord.id} with payment intent ID`);
            }
        } else {
            // Update regular proposal with payment intent ID
            proposal.stripePaymentIntentId = paymentIntent.id;
            proposal.paymentStatus = 'pending';
            await proposal.save();
            console.log(`[Create Payment Intent] Updated Proposal ${proposal.id} with payment intent ID`);
        }

        // Verify client secret is valid
        if (!paymentIntent.client_secret) {
            console.error('⚠️ Payment intent created but client_secret is missing!');
            return res.status(500).json({
                success: false,
                error: 'Payment configuration error. Please try again.'
            });
        }

        res.json({
            success: true,
            clientSecret: paymentIntent.client_secret,
            amount: proposalPrice,
            paymentStatus: paymentIntent.status,
            paymentIntentId: paymentIntent.id
        });
    } catch (error) {
        console.error('Create payment intent error:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Failed to create payment intent'
        });
    }
});

// @route   PATCH /api/service-requests/my/service-requests/:id/approve
// @desc    Approve completed work
// @access  Private (Customer and Provider)
router.patch('/my/service-requests/:id/approve', protect, async (req, res) => {
    try {
        // Allow customers and providers (business_owner) to approve work on their requests
        if (req.user.role !== 'CUSTOMER' && req.user.role !== 'user' && req.user.role !== 'business_owner') {
            return res.status(403).json({
                success: false,
                error: 'Access denied. This endpoint is for customers and providers only.'
            });
        }

        const requestId = parseInt(req.params.id);

        if (isNaN(requestId)) {
            return res.status(400).json({
                success: false,
                error: 'Invalid request ID'
            });
        }

        // Find service request with related data
        const serviceRequest = await ServiceRequest.findOne({
            where: {
                id: requestId,
                customerId: req.user.id
            },
            include: [
                {
                    model: Category,
                    as: 'category',
                    attributes: ['id', 'name']
                },
                {
                    model: ProviderProfile,
                    as: 'primaryProvider',
                    attributes: ['id', 'userId'],
                    include: [{
                        model: User,
                        as: 'user',
                        attributes: ['id', 'name', 'email']
                    }],
                    required: false
                },
                {
                    model: WorkOrder,
                    as: 'workOrders',
                    attributes: ['id', 'status', 'completedAt'],
                    required: false
                }
            ]
        });

        if (!serviceRequest) {
            return res.status(404).json({
                success: false,
                error: 'Service request not found'
            });
        }

        // Verify service request status is 'COMPLETED'
        if (serviceRequest.status !== 'COMPLETED') {
            return res.status(400).json({
                success: false,
                error: `Cannot approve work. Service request status must be 'COMPLETED'. Current status: ${serviceRequest.status}`
            });
        }

        // Check if work order exists and is completed
        const workOrder = serviceRequest.workOrders && serviceRequest.workOrders.length > 0
            ? serviceRequest.workOrders[0]
            : null;

        if (!workOrder || workOrder.status !== 'COMPLETED') {
            return res.status(400).json({
                success: false,
                error: 'Work order is not completed yet. Please wait for the provider to mark the work as completed.'
            });
        }

        // Update service request status to 'APPROVED'
        await serviceRequest.update({
            status: 'APPROVED'
        });

        // Prepare response data
        const responseData = {
            success: true,
            message: 'Work approved successfully. You can now leave a review.',
            data: {
                serviceRequestId: serviceRequest.id,
                status: serviceRequest.status
            }
        };

        // Send response immediately
        res.json(responseData);

        // Send email notification to provider (non-blocking)
        if (serviceRequest.primaryProvider && serviceRequest.primaryProvider.user) {
            const provider = serviceRequest.primaryProvider.user;
            const customer = await User.findByPk(req.user.id, {
                attributes: ['id', 'name', 'email']
            });

            if (provider.email && customer) {
                sendEmail({
                    to: provider.email,
                    subject: `✅ Work Approved: ${serviceRequest.projectTitle}`,
                    html: `
                        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f9f9f9;">
                            <div style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0;">
                                <h1 style="margin: 0; font-size: 28px;">🎉 Work Approved!</h1>
                            </div>
                            <div style="background-color: white; padding: 30px; border-radius: 0 0 8px 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
                                <p style="color: #333; font-size: 16px; line-height: 1.6;">
                                    Hi ${provider.name || 'Provider'},
                                </p>
                                <p style="color: #333; font-size: 16px; line-height: 1.6;">
                                    Great news! The customer has approved your completed work for <strong>${serviceRequest.projectTitle}</strong>.
                                </p>
                                <div style="background-color: #ecfdf5; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #10b981;">
                                    <h3 style="color: #065f46; margin-top: 0;">Project Details:</h3>
                                    <p style="color: #333; margin: 8px 0;"><strong>Customer:</strong> ${customer.name || customer.email}</p>
                                    <p style="color: #333; margin: 8px 0;"><strong>Service:</strong> ${serviceRequest.category?.name || 'N/A'}</p>
                                    <p style="color: #333; margin: 8px 0;"><strong>Project:</strong> ${serviceRequest.projectTitle}</p>
                                    <p style="color: #333; margin: 8px 0;"><strong>Status:</strong> <span style="color: #059669; font-weight: 600; background: #d1fae5; padding: 4px 12px; border-radius: 12px; display: inline-block;">APPROVED</span></p>
                                </div>
                                <p style="color: #333; font-size: 16px; line-height: 1.6;">
                                    The customer may leave a review for your work. Keep up the excellent service!
                                </p>
                                <div style="text-align: center; margin-top: 30px;">
                                    <a href="${process.env.FRONTEND_URL || 'http://localhost:3000'}/user-dashboard/work-orders" 
                                       style="display: inline-block; background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: white; 
                                              padding: 14px 32px; text-decoration: none; border-radius: 8px; 
                                              font-weight: 600; font-size: 16px; box-shadow: 0 4px 6px rgba(16, 185, 129, 0.3);">
                                        <i style="margin-right: 8px;">📋</i>
                                        View Work Orders
                                    </a>
                                </div>
                                <p style="color: #718096; font-size: 14px; text-align: center; margin-top: 20px; padding-top: 20px; border-top: 1px solid #e2e8f0;">
                                    Thank you for your excellent work!
                                </p>
                            </div>
                        </div>
                    `
                }).then(() => {
                    console.log(`✅ Approval email sent successfully to provider: ${provider.email}`);
                }).catch(err => {
                    console.error('❌ Failed to send approval email to provider:', err);
                });
            }
        }

        // Process provider payout (non-blocking)
        // Find the accepted proposal for this service request
        // Include payout fields if they exist
        const acceptedProposal = await Proposal.findOne({
            where: {
                serviceRequestId: serviceRequest.id,
                status: 'ACCEPTED',
                paymentStatus: 'succeeded'
            }
        });

        if (acceptedProposal) {
            // Process payout if status is pending, null, or undefined (null/undefined means payout hasn't been processed yet)
            // IMPORTANT: Do NOT process if status is already 'completed' or 'processing' to avoid race conditions
            const payoutStatus = acceptedProposal.payoutStatus || null;
            console.log(`[Approve Work] Found accepted proposal ${acceptedProposal.id} with payout status: ${payoutStatus || 'null'}`);

            const shouldProcessPayout = !payoutStatus || payoutStatus === 'pending';
            const isAlreadyProcessing = payoutStatus === 'processing';
            const isAlreadyCompleted = payoutStatus === 'completed';

            if (shouldProcessPayout) {
                console.log(`[Approve Work] ⚠️ Processing payout for proposal ${acceptedProposal.id} (current status: ${payoutStatus || 'null'})`);
                // Process payout asynchronously (don't block response)
                processProviderPayout(acceptedProposal, serviceRequest)
                    .then(() => {
                        console.log(`[Approve Work] ✅ Payout processed successfully for proposal ${acceptedProposal.id}`);
                    })
                    .catch(err => {
                        // Error is already logged in processProviderPayout, just log here for context
                        console.error(`[Approve Work] ❌ Payout processing encountered an error for proposal ${acceptedProposal.id}:`, err.message);
                        console.error(`[Approve Work] Error stack:`, err.stack);
                    });
            } else if (isAlreadyCompleted) {
                console.log(`[Approve Work] ✅ Proposal ${acceptedProposal.id} payout already completed (status: ${payoutStatus})`);
            } else if (isAlreadyProcessing) {
                console.log(`[Approve Work] ⏳ Proposal ${acceptedProposal.id} payout is already processing (status: ${payoutStatus})`);
            } else {
                console.log(`[Approve Work] ⚠️ Proposal ${acceptedProposal.id} payout status: ${payoutStatus} (not processing - may need manual review)`);
            }
        } else {
            console.log(`[Approve Work] ⚠️ No accepted proposal found for service request ${serviceRequest.id}`);
        }

        // Log activity (non-blocking)
        logActivity({
            type: 'work_approved',
            description: `Work approved for service request "${serviceRequest.projectTitle}"`,
            userId: req.user.id,
            metadata: {
                serviceRequestId: serviceRequest.id,
                providerId: serviceRequest.primaryProvider?.id
            }
        }).catch(err => console.error('Failed to log activity:', err));
    } catch (error) {
        console.error('Approve work error:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Failed to approve work'
        });
    }
});

// @route   GET /api/service-requests/my/service-requests/:id/review-status
// @desc    Check if review is available and get existing review
// @access  Private (Customer and Provider)
router.get('/my/service-requests/:id/review-status', protect, async (req, res) => {
    try {
        // Allow customers and providers (business_owner) to check review status for their requests
        if (req.user.role !== 'CUSTOMER' && req.user.role !== 'user' && req.user.role !== 'business_owner') {
            return res.status(403).json({
                success: false,
                error: 'Access denied. This endpoint is for customers and providers only.'
            });
        }

        const requestId = parseInt(req.params.id);

        if (isNaN(requestId)) {
            return res.status(400).json({
                success: false,
                error: 'Invalid request ID'
            });
        }

        // Find service request
        const serviceRequest = await ServiceRequest.findOne({
            where: {
                id: requestId,
                customerId: req.user.id
            },
            attributes: ['id', 'status', 'primaryProviderId']
        });

        if (!serviceRequest) {
            return res.status(404).json({
                success: false,
                error: 'Service request not found'
            });
        }

        // Check if review is available (status must be APPROVED or CLOSED)
        const canReview = serviceRequest.status === 'APPROVED' || serviceRequest.status === 'CLOSED';

        // Check if review already exists for this service request (using metadata)
        let existingReview = null;
        try {
            const allReviews = await Review.findAll({
                where: {
                    userId: req.user.id
                },
                attributes: ['id', 'rating', 'title', 'comment', 'createdAt', 'businessId', 'metadata'],
                order: [['createdAt', 'DESC']]
            });

            // Find review that matches this service request ID in metadata
            for (const review of allReviews) {
                if (review.metadata) {
                    try {
                        const metadata = typeof review.metadata === 'string'
                            ? JSON.parse(review.metadata)
                            : review.metadata;
                        if (metadata.serviceRequestId === requestId) {
                            existingReview = review;
                            break;
                        }
                    } catch (e) {
                        // Invalid metadata, skip
                    }
                }
            }
        } catch (error) {
            // If metadata column doesn't exist, skip duplicate check
            if (error.message && error.message.includes("Unknown column 'metadata'")) {
                console.warn('[Review Status] metadata column not found, skipping duplicate check');
            } else {
                throw error;
            }
        }

        res.json({
            success: true,
            data: {
                canReview,
                hasReview: !!existingReview,
                review: existingReview ? {
                    id: existingReview.id,
                    rating: existingReview.rating,
                    title: existingReview.title,
                    comment: existingReview.comment,
                    createdAt: existingReview.createdAt
                } : null,
                serviceRequestStatus: serviceRequest.status
            }
        });
    } catch (error) {
        console.error('Get review status error:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Failed to get review status'
        });
    }
});

// @route   GET /api/service-requests/my/service-requests/:id/review
// @desc    Get existing review for a service request
// @access  Private (Customer and Provider)
router.get('/my/service-requests/:id/review', protect, async (req, res) => {
    try {
        // Allow customers and providers (business_owner) to get reviews for their requests
        if (req.user.role !== 'CUSTOMER' && req.user.role !== 'user' && req.user.role !== 'business_owner') {
            return res.status(403).json({
                success: false,
                error: 'Access denied. This endpoint is for customers and providers only.'
            });
        }

        const requestId = parseInt(req.params.id);

        if (isNaN(requestId)) {
            return res.status(400).json({
                success: false,
                error: 'Invalid request ID'
            });
        }

        // Verify service request belongs to customer
        const serviceRequest = await ServiceRequest.findOne({
            where: {
                id: requestId,
                customerId: req.user.id
            },
            attributes: ['id']
        });

        if (!serviceRequest) {
            return res.status(404).json({
                success: false,
                error: 'Service request not found'
            });
        }

        // Find review for this service request (using metadata)
        let review = null;
        let metadataColumnExists = true;

        try {
            const allReviews = await Review.findAll({
                where: {
                    userId: req.user.id
                },
                attributes: ['id', 'rating', 'title', 'comment', 'createdAt', 'updatedAt', 'businessId', 'metadata'],
                order: [['createdAt', 'DESC']]
            });

            // Find review that matches this service request ID in metadata
            for (const r of allReviews) {
                if (r.metadata) {
                    try {
                        const metadata = typeof r.metadata === 'string'
                            ? JSON.parse(r.metadata)
                            : r.metadata;
                        if (metadata.serviceRequestId === requestId) {
                            review = r;
                            break;
                        }
                    } catch (e) {
                        // Invalid metadata, skip
                    }
                }
            }
        } catch (error) {
            // If metadata column doesn't exist, we can't find reviews by serviceRequestId
            if (error.message && error.message.includes("Unknown column 'metadata'")) {
                console.warn('[Get Review] metadata column not found. Cannot find review by serviceRequestId.');
                console.warn('[Get Review] Please run migration: ALTER TABLE reviews ADD COLUMN metadata TEXT NULL AFTER isReported;');
                metadataColumnExists = false;

                // Try alternative: Get provider's business and find most recent review
                // This is a fallback but not perfect since we can't guarantee it's for this service request
                try {
                    // Get service request to find provider
                    const sr = await ServiceRequest.findByPk(requestId, {
                        include: [{
                            model: ProviderProfile,
                            as: 'primaryProvider',
                            attributes: ['id', 'userId'],
                            required: false
                        }]
                    });

                    if (sr && sr.primaryProvider) {
                        // Find provider's business
                        const providerBusiness = await Business.findOne({
                            where: { ownerId: sr.primaryProvider.userId },
                            attributes: ['id'],
                            limit: 1
                        });

                        if (providerBusiness) {
                            // Get most recent review for this business by this user
                            const recentReview = await Review.findOne({
                                where: {
                                    userId: req.user.id,
                                    businessId: providerBusiness.id
                                },
                                order: [['createdAt', 'DESC']],
                                limit: 1
                            });

                            if (recentReview) {
                                // This might be the review, but we can't be 100% sure without metadata
                                review = recentReview;
                                console.log('[Get Review] Found review by business fallback (may not be for this service request)');
                            }
                        }
                    }
                } catch (fallbackError) {
                    console.error('[Get Review] Fallback review search failed:', fallbackError.message);
                }
            } else {
                throw error;
            }
        }

        if (!review) {
            // Return 404 with helpful message if metadata column is missing
            const errorMessage = metadataColumnExists
                ? 'Review not found'
                : 'Review not found. The metadata column is missing from the reviews table. Please run the migration to add it.';

            return res.status(404).json({
                success: false,
                error: errorMessage,
                metadataColumnMissing: !metadataColumnExists
            });
        }

        res.json({
            success: true,
            data: {
                id: review.id,
                rating: review.rating,
                title: review.title,
                comment: review.comment,
                createdAt: review.createdAt,
                updatedAt: review.updatedAt
            }
        });
    } catch (error) {
        console.error('Get review error:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Failed to get review'
        });
    }
});

// @route   POST /api/service-requests/my/service-requests/:id/review
// @desc    Submit review for completed and approved work
// @access  Private (Customer and Provider)
router.post('/my/service-requests/:id/review', protect, async (req, res) => {
    try {
        // Allow customers and providers (business_owner) to submit reviews for their requests
        if (req.user.role !== 'CUSTOMER' && req.user.role !== 'user' && req.user.role !== 'business_owner') {
            return res.status(403).json({
                success: false,
                error: 'Access denied. This endpoint is for customers and providers only.'
            });
        }

        const requestId = parseInt(req.params.id);
        const { rating, title, comment } = req.body;

        if (isNaN(requestId)) {
            return res.status(400).json({
                success: false,
                error: 'Invalid request ID'
            });
        }

        // Validate input
        if (!rating || rating < 1 || rating > 5) {
            return res.status(400).json({
                success: false,
                error: 'Rating must be between 1 and 5'
            });
        }

        if (!title || !title.trim()) {
            return res.status(400).json({
                success: false,
                error: 'Review title is required'
            });
        }

        if (!comment || !comment.trim()) {
            return res.status(400).json({
                success: false,
                error: 'Review comment is required'
            });
        }

        // Find service request with provider info
        const serviceRequest = await ServiceRequest.findOne({
            where: {
                id: requestId,
                customerId: req.user.id
            },
            include: [
                {
                    model: ProviderProfile,
                    as: 'primaryProvider',
                    attributes: ['id', 'userId'],
                    include: [{
                        model: User,
                        as: 'user',
                        attributes: ['id', 'name', 'email']
                    }],
                    required: false
                },
                {
                    model: Category,
                    as: 'category',
                    attributes: ['id', 'name']
                }
            ]
        });

        if (!serviceRequest) {
            return res.status(404).json({
                success: false,
                error: 'Service request not found'
            });
        }

        // Verify service request status is 'APPROVED' or 'CLOSED'
        if (serviceRequest.status !== 'APPROVED' && serviceRequest.status !== 'CLOSED') {
            return res.status(400).json({
                success: false,
                error: `Cannot submit review. Service request status must be 'APPROVED' or 'CLOSED'. Current status: ${serviceRequest.status}`
            });
        }

        // Check if review already exists for this service request
        let existingReview = null;
        try {
            // First try to find by serviceRequestId (if column exists)
            existingReview = await Review.findOne({
                where: {
                    userId: req.user.id,
                    serviceRequestId: requestId
                },
                attributes: ['id', 'businessId', 'userId', 'serviceRequestId', 'metadata']
            });

            // Fallback: If serviceRequestId column doesn't exist, check metadata
            if (!existingReview) {
                const allReviews = await Review.findAll({
                    where: {
                        userId: req.user.id
                    },
                    attributes: ['id', 'businessId', 'userId', 'metadata'],
                    order: [['createdAt', 'DESC']]
                });

                // Find review that matches this service request ID in metadata
                for (const review of allReviews) {
                    if (review.metadata) {
                        try {
                            const metadata = typeof review.metadata === 'string'
                                ? JSON.parse(review.metadata)
                                : review.metadata;
                            if (metadata && metadata.serviceRequestId === requestId) {
                                existingReview = review;
                                break;
                            }
                        } catch (e) {
                            // Invalid metadata, skip
                        }
                    }
                }
            }
        } catch (error) {
            // If serviceRequestId column doesn't exist, fall back to metadata check
            if (error.message && error.message.includes("Unknown column 'serviceRequestId'")) {
                console.warn('[Review Submission] serviceRequestId column not found, checking metadata instead');
                // Try metadata-based check (handled above)
            } else {
                throw error;
            }
        }

        if (existingReview) {
            return res.status(400).json({
                success: false,
                error: 'Review already exists for this service request'
            });
        }

        // Get provider ID (from primaryProvider or from proposal)
        let providerId = null;
        let providerProfileId = null;

        if (serviceRequest.primaryProvider) {
            providerProfileId = serviceRequest.primaryProvider.id;
            providerId = serviceRequest.primaryProvider.userId; // User ID of provider
        } else {
            // Try to get provider from accepted proposal
            const proposal = await Proposal.findOne({
                where: {
                    serviceRequestId: requestId,
                    status: 'ACCEPTED'
                },
                attributes: ['providerId']
            });

            if (proposal) {
                providerProfileId = proposal.providerId;
                // Get user ID from provider profile
                const providerProfile = await ProviderProfile.findByPk(proposal.providerId, {
                    attributes: ['id', 'userId']
                });
                if (providerProfile) {
                    providerId = providerProfile.userId;
                }
            }
        }

        // Start transaction
        const { sequelize } = require('../config/database');
        const transaction = await sequelize.transaction({
            isolationLevel: Sequelize.Transaction.ISOLATION_LEVELS.READ_COMMITTED
        });

        try {
            // Get business ID from provider's businesses
            // Find a business owned by the provider that matches the service request category
            let businessIdForReview = null;
            if (providerId && serviceRequest.categoryId) {
                // Find provider's business that matches the category
                const providerBusiness = await Business.findOne({
                    where: {
                        ownerId: providerId,
                        categoryId: serviceRequest.categoryId
                    },
                    attributes: ['id'],
                    limit: 1,
                    transaction
                });

                if (providerBusiness) {
                    businessIdForReview = providerBusiness.id;
                } else {
                    // If no matching category business, get any business owned by provider
                    const anyProviderBusiness = await Business.findOne({
                        where: { ownerId: providerId },
                        attributes: ['id'],
                        limit: 1,
                        transaction
                    });
                    if (anyProviderBusiness) {
                        businessIdForReview = anyProviderBusiness.id;
                    }
                }
            }

            // If still no business found, try to find any business in the category
            if (!businessIdForReview && serviceRequest.categoryId) {
                const categoryBusiness = await Business.findOne({
                    where: { categoryId: serviceRequest.categoryId },
                    attributes: ['id'],
                    limit: 1,
                    transaction
                });
                if (categoryBusiness) {
                    businessIdForReview = categoryBusiness.id;
                }
            }

            // Create review with serviceRequestId in metadata
            const reviewMetadata = {
                serviceRequestId: requestId,
                providerId: providerId,
                providerProfileId: providerProfileId
            };

            // Ensure businessId is not null (reviews table requires it)
            // If no business found, we'll need to handle this case
            if (!businessIdForReview) {
                // Try to find any business (fallback)
                const fallbackBusiness = await Business.findOne({
                    attributes: ['id'],
                    limit: 1,
                    transaction
                });
                if (fallbackBusiness) {
                    businessIdForReview = fallbackBusiness.id;
                } else {
                    // If absolutely no business exists, we can't create review
                    // This should not happen in production, but handle gracefully
                    throw new Error('No business found to associate review with. Please ensure businesses are registered.');
                }
            }

            // Check if review already exists for this business + user + serviceRequest combination
            const existingReviewForBusiness = await Review.findOne({
                where: {
                    businessId: businessIdForReview,
                    userId: req.user.id,
                    serviceRequestId: requestId
                },
                transaction
            });

            // Prepare review data
            const reviewData = {
                businessId: businessIdForReview,
                userId: req.user.id,
                serviceRequestId: requestId,
                rating: parseInt(rating),
                title: title.trim(),
                comment: comment.trim(),
                isApproved: true
            };

            let review;

            if (existingReviewForBusiness) {
                // Update existing review for the same service request
                try {
                    // Try to update with metadata
                    await existingReviewForBusiness.update({
                        rating: reviewData.rating,
                        title: reviewData.title,
                        comment: reviewData.comment,
                        metadata: JSON.stringify(reviewMetadata)
                    }, {
                        transaction,
                        hooks: false
                    });
                    review = existingReviewForBusiness;
                    console.log('[Review Submission] Updated existing review for service request:', requestId);
                } catch (updateError) {
                    // If metadata column doesn't exist, update without it
                    if (updateError.message && updateError.message.includes("Unknown column 'metadata'")) {
                        await existingReviewForBusiness.update({
                            rating: reviewData.rating,
                            title: reviewData.title,
                            comment: reviewData.comment
                        }, {
                            transaction,
                            hooks: false
                        });
                        review = existingReviewForBusiness;
                        console.log('[Review Submission] Updated existing review without metadata. ServiceRequestId:', requestId);
                    } else {
                        throw updateError;
                    }
                }
            } else {
                // No existing review, create new one
                // Only add metadata if column exists (check by trying to create with it)
                // If it fails, we'll catch and retry without metadata
                // IMPORTANT: Disable hooks to prevent lock timeout - we'll update rating after transaction commits
                try {
                    review = await Review.create({
                        ...reviewData,
                        metadata: JSON.stringify(reviewMetadata)
                    }, {
                        transaction,
                        hooks: false // Disable hooks to prevent lock timeout - we'll update rating manually after commit
                    });
                } catch (createError) {
                    // If metadata column doesn't exist, create without it
                    if (createError.message && createError.message.includes("Unknown column 'metadata'")) {
                        console.warn('[Review Submission] metadata column not found, creating review without metadata');
                        review = await Review.create(reviewData, {
                            transaction,
                            hooks: false // Disable hooks to prevent lock timeout
                        });
                        // Log that metadata couldn't be saved (for debugging)
                        console.log('[Review Submission] Review created without metadata. ServiceRequestId:', requestId);
                    } else if (createError.name === 'SequelizeUniqueConstraintError') {
                        // Handle race condition - review was created between our check and create
                        await transaction.rollback();
                        return res.status(400).json({
                            success: false,
                            error: 'A review already exists for this business. Please refresh and try again.'
                        });
                    } else {
                        throw createError;
                    }
                }
            }

            // Update service request status to 'CLOSED'
            await ServiceRequest.update(
                {
                    status: 'CLOSED'
                },
                {
                    where: { id: requestId },
                    transaction
                }
            );

            // Update provider rating (if provider profile exists)
            if (providerProfileId) {
                try {
                    // Get provider profile to find associated businesses
                    const providerProfile = await ProviderProfile.findByPk(providerProfileId, {
                        attributes: ['id', 'userId'],
                        transaction
                    });

                    if (providerProfile) {
                        // Find all businesses owned by this provider
                        const providerBusinesses = await Business.findAll({
                            where: { ownerId: providerProfile.userId },
                            attributes: ['id'],
                            transaction
                        });

                        const businessIds = providerBusinesses.map(b => b.id);

                        if (businessIds.length > 0) {
                            // Calculate average rating for reviews on this provider's businesses
                            const providerReviews = await Review.findAll({
                                where: {
                                    businessId: { [Op.in]: businessIds },
                                    isApproved: true
                                },
                                attributes: [
                                    [sequelize.fn('AVG', sequelize.col('rating')), 'avgRating'],
                                    [sequelize.fn('COUNT', sequelize.col('id')), 'totalCount']
                                ],
                                raw: true,
                                transaction
                            });

                            if (providerReviews && providerReviews.length > 0 && providerReviews[0].avgRating) {
                                const avgRating = parseFloat(providerReviews[0].avgRating).toFixed(2);
                                const reviewCount = parseInt(providerReviews[0].totalCount) || 0;

                                // Update provider profile rating
                                await ProviderProfile.update(
                                    {
                                        ratingAverage: avgRating,
                                        ratingCount: reviewCount
                                    },
                                    {
                                        where: { id: providerProfileId },
                                        transaction
                                    }
                                );

                                console.log(`✅ Updated provider ${providerProfileId} rating: ${avgRating} (${reviewCount} reviews)`);
                            }
                        } else {
                            // No businesses found for this provider
                            // Check if the review's businessId belongs to this provider
                            if (businessIdForReview) {
                                const reviewBusiness = await Business.findByPk(businessIdForReview, {
                                    attributes: ['id', 'ownerId'],
                                    transaction
                                });

                                if (reviewBusiness && reviewBusiness.ownerId === providerId) {
                                    // This review is for provider's business, update rating
                                    await ProviderProfile.update(
                                        {
                                            ratingAverage: parseFloat(rating).toFixed(2),
                                            ratingCount: 1
                                        },
                                        {
                                            where: { id: providerProfileId },
                                            transaction
                                        }
                                    );
                                }
                            }
                        }
                    }
                } catch (err) {
                    // If rating fields don't exist or update fails, log and continue
                    console.log('Error updating provider rating:', err.message);
                    // Don't fail the review submission if rating update fails
                }
            }

            // Commit transaction IMMEDIATELY
            await transaction.commit();

            // Process pending payout after service request is closed (status is now CLOSED)
            // Since status was APPROVED before (required for review submission), payout should be processed
            // Find the accepted proposal for this service request and process payout if pending
            try {
                console.log(`[Review Submission] Checking for pending payouts for service request ${requestId}...`);
                const acceptedProposal = await Proposal.findOne({
                    where: {
                        serviceRequestId: requestId,
                        status: 'ACCEPTED',
                        paymentStatus: 'succeeded'
                    }
                });

                if (acceptedProposal) {
                    console.log(`[Review Submission] Found accepted proposal ${acceptedProposal.id} for service request ${requestId}`);
                    const payoutStatus = acceptedProposal.payoutStatus || null;
                    console.log(`[Review Submission] Current payout status for proposal ${acceptedProposal.id}: ${payoutStatus || 'null'}`);

                    // Process payout if it's pending or null (not yet processed)
                    if (!payoutStatus || payoutStatus === 'pending') {
                        console.log(`[Review Submission] ⚠️ Processing pending payout for proposal ${acceptedProposal.id} after closing service request`);
                        // Reload service request to get latest state (now CLOSED)
                        const updatedServiceRequest = await ServiceRequest.findByPk(requestId);
                        if (updatedServiceRequest) {
                            // Process payout asynchronously (don't block response)
                            processProviderPayout(acceptedProposal, updatedServiceRequest)
                                .then(() => {
                                    console.log(`[Review Submission] ✅ Payout processed successfully for proposal ${acceptedProposal.id} after service request closed`);
                                })
                                .catch(err => {
                                    // Error is already logged in processProviderPayout
                                    console.error(`[Review Submission] ❌ Payout processing encountered an error for proposal ${acceptedProposal.id}:`, err.message);
                                    console.error(`[Review Submission] Error stack:`, err.stack);
                                });
                        } else {
                            console.error(`[Review Submission] ❌ Could not reload service request ${requestId} for payout processing`);
                        }
                    } else if (payoutStatus === 'completed') {
                        console.log(`[Review Submission] ✅ Proposal ${acceptedProposal.id} payout already completed (status: ${payoutStatus})`);
                    } else if (payoutStatus === 'processing') {
                        console.log(`[Review Submission] ⚠️ Proposal ${acceptedProposal.id} payout is already processing (status: ${payoutStatus})`);
                    } else {
                        console.log(`[Review Submission] ⚠️ Proposal ${acceptedProposal.id} payout status: ${payoutStatus} (not processing - may need manual review)`);
                    }
                } else {
                    console.log(`[Review Submission] ⚠️ No accepted proposal with succeeded payment found for service request ${requestId}`);
                }
            } catch (payoutError) {
                // Log error but don't fail the review submission
                console.error(`[Review Submission] ❌ Error checking/processing payout:`, payoutError.message);
                console.error(`[Review Submission] Error stack:`, payoutError.stack);
            }

            // Update business rating AFTER transaction commits (non-blocking, async)
            // This prevents lock timeout issues - the hook was disabled, so we update manually
            if (businessIdForReview) {
                // Run rating update asynchronously - don't block the response
                Review.calculateAverageRating(businessIdForReview)
                    .then(() => {
                        console.log(`✅ Business rating updated for business ${businessIdForReview}`);
                    })
                    .catch((ratingError) => {
                        // Log error but don't fail the request
                        console.error(`❌ Failed to update business rating for business ${businessIdForReview}:`, ratingError.message);
                        // Could retry later or queue for background processing
                    });
            }

            // Prepare response
            const responseData = {
                success: true,
                message: 'Review submitted successfully. Thank you for your feedback!',
                data: {
                    reviewId: review.id,
                    serviceRequestStatus: 'CLOSED'
                }
            };

            // Send response immediately
            res.json(responseData);

            // Send email notification to provider (non-blocking)
            if (serviceRequest.primaryProvider && serviceRequest.primaryProvider.user) {
                const provider = serviceRequest.primaryProvider.user;
                const customer = await User.findByPk(req.user.id, {
                    attributes: ['id', 'name', 'email']
                });

                if (provider.email && customer) {
                    const ratingStars = '⭐'.repeat(parseInt(rating));
                    const ratingText = ['', 'Poor', 'Fair', 'Good', 'Very Good', 'Excellent'][parseInt(rating)];

                    sendEmail({
                        to: provider.email,
                        subject: `⭐ New Review Received: ${title}`,
                        html: `
                            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f9f9f9;">
                                <div style="background: linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%); color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0;">
                                    <h1 style="margin: 0; font-size: 28px;">⭐ New Review Received!</h1>
                                </div>
                                <div style="background-color: white; padding: 30px; border-radius: 0 0 8px 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
                                    <p style="color: #333; font-size: 16px; line-height: 1.6;">
                                        Hi ${provider.name || 'Provider'},
                                    </p>
                                    <p style="color: #333; font-size: 16px; line-height: 1.6;">
                                        Great news! You've received a new review from <strong>${customer.name || customer.email}</strong> for your work on <strong>${serviceRequest.projectTitle}</strong>.
                                    </p>
                                    <div style="background-color: #fef3c7; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #f59e0b;">
                                        <h3 style="color: #92400e; margin-top: 0;">Review Details:</h3>
                                        <div style="margin: 10px 0;">
                                            <strong style="color: #78350f;">Rating:</strong>
                                            <div style="font-size: 1.5rem; color: #f59e0b; margin: 5px 0;">
                                                ${ratingStars} (${rating}/5 - ${ratingText})
                                            </div>
                                        </div>
                                        <div style="margin: 10px 0;">
                                            <strong style="color: #78350f;">Title:</strong>
                                            <p style="color: #92400e; margin: 5px 0;">${title}</p>
                                        </div>
                                        <div style="margin: 10px 0;">
                                            <strong style="color: #78350f;">Comment:</strong>
                                            <p style="color: #92400e; margin: 5px 0; line-height: 1.6;">${comment}</p>
                                        </div>
                                    </div>
                                    <div style="background-color: #ecfdf5; padding: 15px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #10b981;">
                                        <p style="color: #065f46; margin: 0; font-weight: 600;">
                                            <i style="margin-right: 8px;">💼</i>
                                            Project: ${serviceRequest.projectTitle}
                                        </p>
                                        <p style="color: #047857; margin: 5px 0 0 0;">
                                            Category: ${serviceRequest.category?.name || 'N/A'}
                                        </p>
                                    </div>
                                    <p style="color: #333; font-size: 16px; line-height: 1.6;">
                                        Thank you for your excellent service! Keep up the great work.
                                    </p>
                                    <div style="text-align: center; margin-top: 30px;">
                                        <a href="${process.env.FRONTEND_URL || 'http://localhost:3000'}/user-dashboard/work-orders" 
                                           style="display: inline-block; background: linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%); color: white; 
                                                  padding: 14px 32px; text-decoration: none; border-radius: 8px; 
                                                  font-weight: 600; font-size: 16px; box-shadow: 0 4px 6px rgba(251, 191, 36, 0.3);">
                                            <i style="margin-right: 8px;">📋</i>
                                            View Work Orders
                                        </a>
                                    </div>
                                </div>
                            </div>
                        `
                    }).then(() => {
                        console.log(`✅ Review notification email sent successfully to provider: ${provider.email}`);
                    }).catch(err => {
                        console.error('❌ Failed to send review notification email to provider:', err);
                    });
                }
            }

            // Log activity (non-blocking)
            logActivity({
                type: 'review_submitted',
                description: `Review submitted for service request "${serviceRequest.projectTitle}"`,
                userId: req.user.id,
                metadata: {
                    serviceRequestId: requestId,
                    reviewId: review.id,
                    rating: rating,
                    providerId: providerProfileId
                }
            }).catch(err => console.error('Failed to log activity:', err));
        } catch (error) {
            await transaction.rollback();
            throw error;
        }
    } catch (error) {
        console.error('Submit review error:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Failed to submit review'
        });
    }
});

// @route   GET /api/service-requests/my/service-requests/:id/proposals/:proposalId/payment-status
// @desc    Get payment status for a proposal
// @access  Private (Customer and Provider)
router.get('/my/service-requests/:id/proposals/:proposalId/payment-status', protect, async (req, res) => {
    try {
        // Allow customers and providers (business_owner) to get payment status for their requests
        if (req.user.role !== 'CUSTOMER' && req.user.role !== 'user' && req.user.role !== 'business_owner') {
            return res.status(403).json({
                success: false,
                error: 'Access denied. This endpoint is for customers and providers only.'
            });
        }

        const requestId = parseInt(req.params.id);
        const proposalId = parseInt(req.params.proposalId);

        if (isNaN(requestId) || isNaN(proposalId)) {
            return res.status(400).json({
                success: false,
                error: 'Invalid request ID or proposal ID'
            });
        }

        // Find proposal
        const proposal = await Proposal.findOne({
            where: {
                id: proposalId,
                serviceRequestId: requestId
            }
        });

        if (!proposal) {
            return res.status(404).json({
                success: false,
                error: 'Proposal not found'
            });
        }

        // If no payment intent, return pending status
        if (!proposal.stripePaymentIntentId) {
            return res.json({
                success: true,
                data: {
                    paymentStatus: 'pending',
                    paymentIntentId: null,
                    clientSecret: null
                }
            });
        }

        // Check payment status with Stripe
        if (!process.env.STRIPE_SECRET_KEY) {
            return res.json({
                success: true,
                data: {
                    paymentStatus: proposal.paymentStatus || 'pending',
                    paymentIntentId: proposal.stripePaymentIntentId,
                    clientSecret: null
                }
            });
        }

        try {
            const paymentIntent = await stripe.paymentIntents.retrieve(proposal.stripePaymentIntentId);

            // ALWAYS use Stripe's actual status, not database status
            // This ensures we have the truth from Stripe
            const actualStripeStatus = paymentIntent.status;

            console.log(`[Payment Status Check] Proposal ${proposalId}, Stripe Status: ${actualStripeStatus}, DB Status: ${proposal.paymentStatus}`);

            // If Stripe says succeeded, return succeeded
            // Otherwise, return the Stripe status (not database status)
            return res.json({
                success: true,
                data: {
                    paymentStatus: actualStripeStatus === 'succeeded' ? 'succeeded' : (actualStripeStatus || 'pending'),
                    paymentIntentId: paymentIntent.id,
                    clientSecret: actualStripeStatus === 'requires_payment_method' || actualStripeStatus === 'requires_confirmation'
                        ? paymentIntent.client_secret
                        : null
                }
            });
        } catch (stripeError) {
            // If Stripe error (e.g., payment intent doesn't exist), return pending
            // Don't trust database status if Stripe doesn't have the payment intent
            console.error(`[Payment Status Check] Stripe error for proposal ${proposalId}:`, stripeError.message);
            return res.json({
                success: true,
                data: {
                    paymentStatus: 'pending', // Always return pending if Stripe check fails
                    paymentIntentId: proposal.stripePaymentIntentId,
                    clientSecret: null
                }
            });
        }
    } catch (error) {
        console.error('Get payment status error:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Failed to get payment status'
        });
    }
});

// @route   POST /api/service-requests/my/service-requests/:id/proposals/:proposalId/accept
// @desc    Accept proposal after payment verification
// @access  Private (Customer and Provider)
router.post('/my/service-requests/:id/proposals/:proposalId/accept', protect, async (req, res) => {
    try {
        // Allow customers and providers (business_owner) to accept proposals for their requests
        if (req.user.role !== 'CUSTOMER' && req.user.role !== 'user' && req.user.role !== 'business_owner') {
            return res.status(403).json({
                success: false,
                error: 'Access denied. This endpoint is for customers and providers only.'
            });
        }

        const requestId = parseInt(req.params.id);
        const proposalIdParam = req.params.proposalId;
        const { paymentIntentId } = req.body;

        if (isNaN(requestId)) {
            return res.status(400).json({
                success: false,
                error: 'Invalid request ID'
            });
        }

        if (!paymentIntentId) {
            return res.status(400).json({
                success: false,
                error: 'Payment Intent ID is required'
            });
        }

        // Verify payment status with Stripe FIRST (before starting transaction)
        if (!process.env.STRIPE_SECRET_KEY) {
            return res.status(500).json({
                success: false,
                error: 'Payment system not configured'
            });
        }

        // Get proposal price first (needed for amount verification)
        // We need to check if this is a pending proposal or regular proposal
        let expectedProposalPrice = null;

        if (proposalIdParam.startsWith('pending-')) {
            // For pending proposals, get price from lead metadata
            const leadId = parseInt(proposalIdParam.replace('pending-', ''));
            if (!isNaN(leadId)) {
                const lead = await Lead.findByPk(leadId);
                if (lead && lead.metadata) {
                    try {
                        const metadata = typeof lead.metadata === 'string' ? JSON.parse(lead.metadata) : lead.metadata;
                        if (metadata.pendingProposal && metadata.pendingProposal.price) {
                            expectedProposalPrice = parseFloat(metadata.pendingProposal.price);
                        }
                    } catch (e) {
                        console.error('Error parsing lead metadata for price:', e);
                    }
                }
            }
        } else {
            // For regular proposals, get price from proposal
            const proposalId = parseInt(proposalIdParam);
            if (!isNaN(proposalId)) {
                const proposal = await Proposal.findOne({
                    where: { id: proposalId, serviceRequestId: requestId },
                    attributes: ['id', 'price']
                });
                if (proposal) {
                    expectedProposalPrice = parseFloat(proposal.price);
                }
            }
        }

        // Verify payment intent exists and succeeded in Stripe
        let paymentIntent;
        try {
            paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);
        } catch (stripeError) {
            console.error(`[Accept Proposal] Stripe error retrieving payment intent ${paymentIntentId}:`, stripeError.message);
            return res.status(400).json({
                success: false,
                error: `Payment intent not found in Stripe. Please create a new payment.`
            });
        }

        // CRITICAL: Only proceed if Stripe confirms payment succeeded
        if (paymentIntent.status !== 'succeeded') {
            console.error(`[Accept Proposal] Payment intent ${paymentIntentId} status is ${paymentIntent.status}, not succeeded`);
            return res.status(400).json({
                success: false,
                error: `Payment not completed in Stripe. Status: ${paymentIntent.status}. Please complete the payment first.`
            });
        }

        // Verify payment amount matches proposal price (if we have the price)
        if (expectedProposalPrice && !isNaN(expectedProposalPrice)) {
            const proposalPriceInCents = Math.round(expectedProposalPrice * 100);
            if (paymentIntent.amount !== proposalPriceInCents) {
                console.error(`[Accept Proposal] Payment amount mismatch: Stripe=${paymentIntent.amount}, Proposal=${proposalPriceInCents}`);
                return res.status(400).json({
                    success: false,
                    error: `Payment amount mismatch. Expected $${expectedProposalPrice.toFixed(2)} but payment is $${(paymentIntent.amount / 100).toFixed(2)}. Please create a new payment.`
                });
            }
        }

        console.log(`[Accept Proposal] Payment verified in Stripe: ${paymentIntentId}, amount: ${paymentIntent.amount}, status: ${paymentIntent.status}`);

        // Start transaction with optimized settings to prevent lock timeouts
        const { sequelize } = require('../config/database');
        // Use READ_COMMITTED isolation level to reduce lock contention
        const transaction = await sequelize.transaction({
            isolationLevel: Sequelize.Transaction.ISOLATION_LEVELS.READ_COMMITTED
        });

        try {
            // Fetch records WITHIN transaction using row-level locking to prevent concurrent updates
            const serviceRequest = await ServiceRequest.findOne({
                where: {
                    id: requestId,
                    customerId: req.user.id
                },
                lock: Sequelize.Transaction.LOCK.UPDATE,
                transaction
            });

            if (!serviceRequest) {
                await transaction.rollback();
                return res.status(404).json({
                    success: false,
                    error: 'Service request not found'
                });
            }

            // Check if service request is already in progress (before locking proposal)
            if (serviceRequest.status === 'IN_PROGRESS' || serviceRequest.status === 'COMPLETED') {
                await transaction.rollback();
                return res.status(400).json({
                    success: false,
                    error: 'Service request is already in progress or completed'
                });
            }

            let proposal = null;
            let proposalId = null;
            let isPendingProposal = false;
            let leadId = null;

            // Handle pending proposals (from leads) - format: "pending-{leadId}"
            if (proposalIdParam.startsWith('pending-')) {
                // Extract lead ID from "pending-{leadId}"
                leadId = parseInt(proposalIdParam.replace('pending-', ''));

                if (isNaN(leadId)) {
                    await transaction.rollback();
                    return res.status(400).json({
                        success: false,
                        error: 'Invalid pending proposal ID'
                    });
                }

                // Find the lead by ID first
                // Note: The payment intent ID is for the proposal payment (customer pays provider),
                // not the lead fee payment (provider pays). So we find lead by ID only.
                const lead = await Lead.findOne({
                    where: {
                        id: leadId
                    },
                    transaction
                });

                if (!lead) {
                    await transaction.rollback();
                    return res.status(404).json({
                        success: false,
                        error: 'Lead not found'
                    });
                }

                // Check if lead has pending proposal in metadata
                if (!lead.metadata) {
                    await transaction.rollback();
                    return res.status(404).json({
                        success: false,
                        error: 'Lead has no pending proposal'
                    });
                }

                // Parse lead metadata
                let metadata;
                try {
                    metadata = typeof lead.metadata === 'string'
                        ? JSON.parse(lead.metadata)
                        : lead.metadata;
                } catch (e) {
                    console.error('Error parsing lead metadata:', e);
                    await transaction.rollback();
                    return res.status(400).json({
                        success: false,
                        error: 'Invalid lead metadata'
                    });
                }

                // Verify pending proposal exists and matches service request
                if (!metadata.pendingProposal || metadata.serviceRequestId !== requestId) {
                    await transaction.rollback();
                    return res.status(404).json({
                        success: false,
                        error: 'Pending proposal not found in lead metadata or service request mismatch'
                    });
                }

                // Check if proposal already exists (might have been created by webhook)
                // First try to find by payment intent ID
                proposal = await Proposal.findOne({
                    where: {
                        serviceRequestId: requestId,
                        stripePaymentIntentId: paymentIntentId
                    },
                    lock: Sequelize.Transaction.LOCK.UPDATE,
                    transaction
                });

                // If not found by payment intent, try to find by provider and service request
                // (in case payment intent wasn't stored yet or proposal was created differently)
                if (!proposal && lead.providerId) {
                    const providerProfile = await ProviderProfile.findOne({
                        where: { userId: lead.providerId },
                        attributes: ['id'],
                        transaction
                    });

                    if (providerProfile) {
                        proposal = await Proposal.findOne({
                            where: {
                                serviceRequestId: requestId,
                                providerId: providerProfile.id,
                                status: { [Op.in]: ['SENT', 'ACCEPTED'] }
                            },
                            lock: Sequelize.Transaction.LOCK.UPDATE,
                            transaction
                        });

                        // If found, update it with the payment intent ID
                        if (proposal && !proposal.stripePaymentIntentId) {
                            proposal.stripePaymentIntentId = paymentIntentId;
                            proposal.paymentStatus = paymentIntent.status === 'succeeded' ? 'succeeded' : 'pending';
                            proposal.paidAt = paymentIntent.status === 'succeeded' ? new Date() : null;
                            await proposal.save({ transaction });
                            console.log(`[Accept Proposal] Updated existing proposal ${proposal.id} with payment intent ${paymentIntentId}`);
                        }
                    }
                }

                // If proposal doesn't exist, create it from lead metadata
                if (!proposal) {
                    // Get provider profile from lead
                    let providerProfile = null;
                    if (lead.providerId) {
                        providerProfile = await ProviderProfile.findOne({
                            where: { userId: lead.providerId },
                            attributes: ['id', 'userId'],
                            transaction
                        });
                    }

                    if (!providerProfile) {
                        await transaction.rollback();
                        return res.status(404).json({
                            success: false,
                            error: 'Provider profile not found for lead'
                        });
                    }

                    // Create proposal from lead metadata
                    // IMPORTANT: Only set paymentStatus to 'succeeded' if Stripe confirms it
                    proposal = await Proposal.create({
                        serviceRequestId: requestId,
                        providerId: providerProfile.id,
                        details: metadata.pendingProposal.description || '',
                        price: parseFloat(metadata.pendingProposal.price || 0),
                        status: 'SENT',
                        stripePaymentIntentId: paymentIntentId,
                        paymentStatus: paymentIntent.status === 'succeeded' ? 'succeeded' : 'pending', // Use Stripe's actual status
                        paidAt: paymentIntent.status === 'succeeded' ? new Date() : null
                    }, { transaction });

                    console.log(`[Accept Proposal] Created proposal ${proposal.id} from pending lead ${leadId} with paymentStatus=${paymentIntent.status === 'succeeded' ? 'succeeded' : 'pending'}`);

                    console.log(`✅ Created proposal ${proposal.id} from pending lead ${leadId}`);
                }

                proposalId = proposal.id;
                isPendingProposal = true;
            } else {
                // Regular proposal ID - parse as integer
                proposalId = parseInt(proposalIdParam);

                if (isNaN(proposalId)) {
                    await transaction.rollback();
                    return res.status(400).json({
                        success: false,
                        error: 'Invalid proposal ID'
                    });
                }

                // Find proposal WITHIN transaction with lock
                proposal = await Proposal.findOne({
                    where: {
                        id: proposalId,
                        serviceRequestId: requestId,
                        stripePaymentIntentId: paymentIntentId
                    },
                    lock: Sequelize.Transaction.LOCK.UPDATE,
                    transaction
                });

                if (!proposal) {
                    await transaction.rollback();
                    return res.status(404).json({
                        success: false,
                        error: 'Proposal not found or payment intent mismatch'
                    });
                }
            }

            // Check if proposal is already accepted
            if (proposal.status === 'ACCEPTED') {
                await transaction.rollback();
                return res.status(400).json({
                    success: false,
                    error: 'Proposal already accepted'
                });
            }

            // Get provider profile (needed for work order and email)
            const providerProfile = await ProviderProfile.findByPk(proposal.providerId, {
                attributes: ['id', 'userId'],
                include: [{
                    model: User,
                    as: 'user',
                    attributes: ['id', 'name', 'email', 'phone']
                }],
                transaction
            });

            if (!providerProfile) {
                await transaction.rollback();
                return res.status(404).json({
                    success: false,
                    error: 'Provider profile not found'
                });
            }

            // Update proposal - ONLY set paymentStatus to succeeded if Stripe confirms it
            // This ensures database matches Stripe's actual status
            await Proposal.update(
                {
                    status: 'ACCEPTED',
                    paymentStatus: paymentIntent.status === 'succeeded' ? 'succeeded' : 'pending', // Use Stripe's actual status
                    paidAt: paymentIntent.status === 'succeeded' ? new Date() : null,
                    stripePaymentIntentId: paymentIntentId // Ensure payment intent ID is saved
                },
                {
                    where: { id: proposalId },
                    transaction
                }
            );

            console.log(`[Accept Proposal] Updated proposal ${proposalId} with paymentStatus=${paymentIntent.status === 'succeeded' ? 'succeeded' : 'pending'}`);

            // If this was a pending proposal, update the lead status
            if (isPendingProposal && leadId && !isNaN(leadId)) {
                await Lead.update(
                    {
                        status: 'accepted'
                    },
                    {
                        where: { id: leadId },
                        transaction
                    }
                );
                console.log(`✅ Updated lead ${leadId} status to accepted`);
            }

            // Reject all other proposals for this service request
            await Proposal.update(
                {
                    status: 'REJECTED'
                },
                {
                    where: {
                        serviceRequestId: requestId,
                        id: { [Op.ne]: proposalId },
                        status: 'SENT'
                    },
                    transaction
                }
            );

            // Update service request
            await ServiceRequest.update(
                {
                    status: 'IN_PROGRESS',
                    primaryProviderId: providerProfile.id
                },
                {
                    where: { id: requestId },
                    transaction
                }
            );

            // Create work order
            const workOrder = await WorkOrder.create({
                serviceRequestId: requestId,
                providerId: providerProfile.id,
                status: 'IN_PROGRESS'
            }, { transaction });

            // Commit transaction IMMEDIATELY
            await transaction.commit();

            // Get category info for email (after transaction)
            const category = await Category.findByPk(serviceRequest.categoryId, {
                attributes: ['id', 'name']
            });

            // Prepare response data
            const responseData = {
                success: true,
                message: 'Proposal accepted successfully. Work order created.',
                data: {
                    proposalId: proposalId,
                    workOrderId: workOrder.id,
                    serviceRequestStatus: 'IN_PROGRESS'
                }
            };

            // Send response immediately (don't wait for emails)
            res.json(responseData);

            // Send emails asynchronously (non-blocking) - after response is sent
            // Use the providerProfile we already fetched (with user info) and get proposal price
            Promise.all([
                User.findByPk(req.user.id),
                Proposal.findByPk(proposalId, {
                    attributes: ['id', 'price', 'details']
                })
            ]).then(([customer, proposalData]) => {
                if (!customer || !proposalData) {
                    console.error('Missing customer or proposal data for email notification');
                    return;
                }

                // Use providerProfile that was already fetched (line 932-940) which has user info
                const customerName = customer.name || customer.email;
                const providerName = providerProfile?.user?.name || 'Provider';
                const providerEmail = providerProfile?.user?.email;
                const proposalPrice = proposalData.price;
                const proposalDetails = proposalData.details || '';
                const projectTitle = serviceRequest.projectTitle;
                const categoryName = category?.name || 'N/A';

                // Validate provider email exists
                if (!providerEmail) {
                    console.error('Provider email not found. ProviderProfile ID:', providerProfile?.id, 'User ID:', providerProfile?.userId);
                }

                // Send email to customer (non-blocking)
                if (customer.email) {
                    sendEmail({
                        to: customer.email,
                        subject: `Proposal Accepted - Work Started: ${projectTitle}`,
                        html: `
                            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f9f9f9;">
                                <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0;">
                                    <h1 style="margin: 0; font-size: 28px;">🎉 Proposal Accepted!</h1>
                                </div>
                                <div style="background-color: white; padding: 30px; border-radius: 0 0 8px 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
                                    <p style="color: #333; font-size: 16px; line-height: 1.6;">
                                        Hi ${customerName},
                                    </p>
                                    <p style="color: #333; font-size: 16px; line-height: 1.6;">
                                        Great news! Your payment has been processed and the proposal for <strong>${projectTitle}</strong> has been accepted.
                                    </p>
                                    <div style="background-color: #f0f9ff; padding: 20px; border-radius: 8px; margin: 20px 0;">
                                        <h3 style="color: #1e40af; margin-top: 0;">Service Details:</h3>
                                        <p style="color: #333; margin: 5px 0;"><strong>Category:</strong> ${categoryName}</p>
                                        <p style="color: #333; margin: 5px 0;"><strong>Provider:</strong> ${providerName}</p>
                                        <p style="color: #333; margin: 5px 0;"><strong>Amount Paid:</strong> $${parseFloat(proposalPrice).toFixed(2)}</p>
                                        <p style="color: #333; margin: 5px 0;"><strong>Status:</strong> <span style="color: #059669; font-weight: 600;">IN PROGRESS</span></p>
                                    </div>
                                    <p style="color: #333; font-size: 16px; line-height: 1.6;">
                                        Your service provider will now begin working on your project. You can track the progress in your dashboard.
                                    </p>
                                    <div style="text-align: center; margin-top: 30px;">
                                        <a href="${process.env.FRONTEND_URL || 'http://localhost:3000'}/user-dashboard/requests" 
                                           style="display: inline-block; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; 
                                                  padding: 14px 32px; text-decoration: none; border-radius: 8px; 
                                                  font-weight: 600; font-size: 16px; box-shadow: 0 4px 6px rgba(102, 126, 234, 0.3);">
                                            View Request
                                        </a>
                                    </div>
                                </div>
                            </div>
                        `
                    }).catch(err => console.error('Failed to send email to customer:', err));
                }

                // Send email to provider (non-blocking)
                if (providerEmail) {
                    sendEmail({
                        to: providerEmail,
                        subject: `🎉 Proposal Accepted - New Work Order: ${projectTitle}`,
                        html: `
                            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f9f9f9;">
                                <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0;">
                                    <h1 style="margin: 0; font-size: 28px;">✅ Proposal Accepted!</h1>
                                </div>
                                <div style="background-color: white; padding: 30px; border-radius: 0 0 8px 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
                                    <p style="color: #333; font-size: 16px; line-height: 1.6;">
                                        Hi ${providerName},
                                    </p>
                                    <p style="color: #333; font-size: 16px; line-height: 1.6;">
                                        <strong>Great news!</strong> Your proposal for <strong>${projectTitle}</strong> has been accepted by the customer and payment has been successfully processed.
                                    </p>
                                    <div style="background-color: #f0f9ff; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #667eea;">
                                        <h3 style="color: #1e40af; margin-top: 0;">📋 Project Details:</h3>
                                        <p style="color: #333; margin: 8px 0;"><strong>Customer:</strong> ${customerName}</p>
                                        <p style="color: #333; margin: 8px 0;"><strong>Service Category:</strong> ${categoryName}</p>
                                        <p style="color: #333; margin: 8px 0;"><strong>Project Title:</strong> ${projectTitle}</p>
                                        <p style="color: #333; margin: 8px 0;"><strong>Proposal Amount:</strong> <span style="color: #10b981; font-weight: 700; font-size: 1.1em;">$${parseFloat(proposalPrice).toFixed(2)}</span></p>
                                        <p style="color: #333; margin: 8px 0;"><strong>Status:</strong> <span style="color: #059669; font-weight: 600; background: #d1fae5; padding: 4px 12px; border-radius: 12px; display: inline-block;">IN PROGRESS</span></p>
                                    </div>
                                    ${proposalDetails ? `
                                    <div style="background-color: #fef3c7; padding: 15px; border-radius: 8px; margin: 20px 0;">
                                        <h4 style="color: #92400e; margin-top: 0; margin-bottom: 10px;">Your Proposal Details:</h4>
                                        <p style="color: #78350f; margin: 0; line-height: 1.6;">${proposalDetails}</p>
                                    </div>
                                    ` : ''}
                                    <div style="background-color: #ecfdf5; padding: 15px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #10b981;">
                                        <p style="color: #065f46; margin: 0; font-weight: 600;">
                                            <i style="margin-right: 8px;">💼</i>
                                            A new work order has been created for you. Please begin working on this project.
                                        </p>
                                    </div>
                                    <p style="color: #333; font-size: 16px; line-height: 1.6;">
                                        You can view and manage this work order in your dashboard. Remember to mark it as completed when you finish the work.
                                    </p>
                                    <div style="text-align: center; margin-top: 30px;">
                                        <a href="${process.env.FRONTEND_URL || 'http://localhost:3000'}/user-dashboard/work-orders" 
                                           style="display: inline-block; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; 
                                                  padding: 14px 32px; text-decoration: none; border-radius: 8px; 
                                                  font-weight: 600; font-size: 16px; box-shadow: 0 4px 6px rgba(102, 126, 234, 0.3);">
                                            <i style="margin-right: 8px;">📋</i>
                                            View Work Orders
                                        </a>
                                    </div>
                                    <p style="color: #718096; font-size: 14px; text-align: center; margin-top: 20px; padding-top: 20px; border-top: 1px solid #e2e8f0;">
                                        Thank you for being part of our service network!
                                    </p>
                                </div>
                            </div>
                        `
                    }).then(() => {
                        console.log(`✅ Email sent successfully to provider: ${providerEmail}`);
                    }).catch(err => {
                        console.error('❌ Failed to send email to provider:', err);
                        console.error('Provider email:', providerEmail, 'Provider name:', providerName);
                    });
                } else {
                    console.error('⚠️ Provider email not found. Cannot send notification email.');
                    console.error('ProviderProfile:', {
                        id: providerProfile?.id,
                        userId: providerProfile?.userId,
                        user: providerProfile?.user
                    });
                }

                // Log activity (non-blocking)
                logActivity({
                    type: 'proposal_accepted',
                    description: `Proposal accepted for service request "${projectTitle}"`,
                    userId: req.user.id,
                    metadata: {
                        serviceRequestId: requestId,
                        proposalId: proposalId,
                        providerId: providerProfile.id,
                        amount: proposalPrice
                    }
                }).catch(err => console.error('Failed to log activity:', err));
            }).catch(err => console.error('Error fetching data for emails:', err));
        } catch (error) {
            // Rollback transaction on error
            if (transaction && !transaction.finished) {
                await transaction.rollback().catch(rollbackErr => {
                    console.error('Error rolling back transaction:', rollbackErr);
                });
            }

            // Handle specific database errors
            if (error.name === 'SequelizeDatabaseError' || error.parent) {
                const errorMessage = error.message || error.parent?.message || '';
                if (errorMessage.includes('Lock wait timeout') || errorMessage.includes('deadlock')) {
                    console.error('Database lock timeout on accept proposal:', error);
                    return res.status(409).json({
                        success: false,
                        error: 'The request is being processed by another operation. Please try again in a moment.'
                    });
                }
            }

            throw error;
        }
    } catch (error) {
        console.error('Accept proposal error:', error);

        // Handle lock timeout specifically
        const errorMessage = error.message || error.parent?.message || '';
        if (errorMessage.includes('Lock wait timeout') || errorMessage.includes('deadlock')) {
            return res.status(409).json({
                success: false,
                error: 'The request is being processed. Please wait a moment and refresh the page.'
            });
        }

        res.status(500).json({
            success: false,
            error: error.message || 'Failed to accept proposal'
        });
    }
});

// @route   PATCH /api/service-requests/my/service-requests/:id/proposals/:proposalId/reject
// @desc    Reject a proposal (no payment required)
// @access  Private (Customer and Provider)
router.patch('/my/service-requests/:id/proposals/:proposalId/reject', protect, async (req, res) => {
    try {
        // Allow customers and providers (business_owner) to reject proposals for their requests
        if (req.user.role !== 'CUSTOMER' && req.user.role !== 'user' && req.user.role !== 'business_owner') {
            return res.status(403).json({
                success: false,
                error: 'Access denied. This endpoint is for customers and providers only.'
            });
        }

        // Get rejection reason from request body
        const { rejectionReason, rejectionReasonOther } = req.body;

        // Validate rejection reason
        const validReasons = ['TOO_FAR', 'TOO_EXPENSIVE', 'NOT_RELEVANT', 'OTHER'];
        if (rejectionReason && !validReasons.includes(rejectionReason)) {
            return res.status(400).json({
                success: false,
                error: 'Invalid rejection reason. Must be one of: TOO_FAR, TOO_EXPENSIVE, NOT_RELEVANT, OTHER'
            });
        }

        // If reason is OTHER, rejectionReasonOther is required
        if (rejectionReason === 'OTHER' && (!rejectionReasonOther || !rejectionReasonOther.trim())) {
            return res.status(400).json({
                success: false,
                error: 'Please provide a description when selecting "Other" as the rejection reason'
            });
        }

        const requestId = parseInt(req.params.id);
        const proposalIdParam = req.params.proposalId;

        if (isNaN(requestId)) {
            return res.status(400).json({
                success: false,
                error: 'Invalid request ID'
            });
        }

        // Find service request with category
        const serviceRequest = await ServiceRequest.findOne({
            where: {
                id: requestId,
                customerId: req.user.id
            },
            include: [{
                model: Category,
                as: 'category',
                attributes: ['id', 'name'],
                required: false
            }]
        });

        if (!serviceRequest) {
            return res.status(404).json({
                success: false,
                error: 'Service request not found'
            });
        }

        let proposal = null;
        let proposalId = null;
        let isPendingProposal = false;
        let leadId = null;
        let providerProfile = null;
        let providerUser = null;

        // Handle pending proposals (from leads) - format: "pending-{leadId}"
        if (proposalIdParam.startsWith('pending-')) {
            // Extract lead ID from "pending-{leadId}"
            leadId = parseInt(proposalIdParam.replace('pending-', ''));

            if (isNaN(leadId)) {
                return res.status(400).json({
                    success: false,
                    error: 'Invalid pending proposal ID'
                });
            }

            // Find the lead
            // Use try-catch to handle missing columns gracefully if migration hasn't been run
            let lead;
            try {
                lead = await Lead.findOne({
                    where: {
                        id: leadId
                    },
                    include: [
                        {
                            model: User,
                            as: 'provider',
                            attributes: ['id', 'name', 'email'],
                            required: false
                        }
                    ]
                });
            } catch (dbError) {
                // If error is about missing columns, try with explicit attributes (migration not run yet)
                if (dbError.message && dbError.message.includes('Unknown column')) {
                    console.log('Migration not run yet, using explicit attributes for lead in reject proposal...');
                    lead = await Lead.findOne({
                        where: {
                            id: leadId
                        },
                        attributes: [
                            'id', 'customerId', 'businessId', 'providerId', 'serviceType', 'categoryId',
                            'locationCity', 'locationState', 'locationPostalCode', 'description', 'budgetRange',
                            'preferredContact', 'customerName', 'customerEmail', 'customerPhone', 'membershipTierRequired',
                            'status', 'stripePaymentIntentId', 'leadCost', 'statusHistory', 'metadata', 'routedAt',
                            'createdAt', 'updatedAt'
                        ],
                        include: [
                            {
                                model: User,
                                as: 'provider',
                                attributes: ['id', 'name', 'email'],
                                required: false
                            }
                        ]
                    });
                } else {
                    throw dbError;
                }
            }

            if (!lead) {
                return res.status(404).json({
                    success: false,
                    error: 'Lead not found'
                });
            }

            // Check if lead has pending proposal in metadata
            if (!lead.metadata) {
                return res.status(404).json({
                    success: false,
                    error: 'Lead has no pending proposal'
                });
            }

            // Parse lead metadata
            let metadata;
            try {
                metadata = typeof lead.metadata === 'string'
                    ? JSON.parse(lead.metadata)
                    : lead.metadata;
            } catch (e) {
                console.error('Error parsing lead metadata:', e);
                return res.status(400).json({
                    success: false,
                    error: 'Invalid lead metadata'
                });
            }

            // Verify pending proposal exists and matches service request
            if (!metadata.pendingProposal || metadata.serviceRequestId !== requestId) {
                return res.status(404).json({
                    success: false,
                    error: 'Pending proposal not found in lead metadata or service request mismatch'
                });
            }

            // Check if proposal already exists (might have been created by webhook)
            proposal = await Proposal.findOne({
                where: {
                    serviceRequestId: requestId,
                    stripePaymentIntentId: lead.stripePaymentIntentId || null
                },
                include: [{
                    model: ProviderProfile,
                    as: 'provider',
                    attributes: ['id', 'userId'],
                    include: [{
                        model: User,
                        as: 'user',
                        attributes: ['id', 'name', 'email']
                    }]
                }]
            });

            // Get provider profile for email
            if (lead.providerId) {
                providerProfile = await ProviderProfile.findOne({
                    where: { userId: lead.providerId },
                    attributes: ['id', 'userId'],
                    include: [{
                        model: User,
                        as: 'user',
                        attributes: ['id', 'name', 'email']
                    }]
                });
            }

            // Use provider from lead if profile not found
            if (!providerProfile && lead.provider) {
                providerUser = lead.provider;
            } else if (providerProfile && providerProfile.user) {
                providerUser = providerProfile.user;
            }

            // If proposal exists, update it; otherwise just update lead metadata
            if (proposal) {
                // Update existing proposal
                if (proposal.status === 'SENT') {
                    proposal.status = 'REJECTED';
                    // Try to set rejection reasons, but handle gracefully if columns don't exist
                    try {
                        proposal.rejectionReason = rejectionReason || null;
                        proposal.rejectionReasonOther = rejectionReason === 'OTHER' ? rejectionReasonOther : null;
                    } catch (reasonError) {
                        // If setting rejection reasons fails, just log and continue
                        console.log('Could not set rejection reasons (migration may not be run yet):', reasonError.message);
                    }
                    await proposal.save();
                    proposalId = proposal.id;

                    // Also update lead status if it exists
                    if (leadId) {
                        await Lead.update(
                            { status: 'rejected' },
                            { where: { id: leadId } }
                        );
                        console.log(`✅ Updated lead ${leadId} status to rejected`);
                    }
                } else {
                    return res.status(400).json({
                        success: false,
                        error: 'Proposal already processed'
                    });
                }
            } else {
                // No proposal record exists yet - update lead metadata and status
                metadata.pendingProposal.status = 'REJECTED';
                lead.metadata = JSON.stringify(metadata);
                lead.status = 'rejected'; // Update lead status so provider dashboard can filter it
                await lead.save();
                console.log(`✅ Updated lead ${leadId} metadata and status to rejected`);
            }

            isPendingProposal = true;
        } else {
            // Regular proposal ID - parse as integer
            proposalId = parseInt(proposalIdParam);

            if (isNaN(proposalId)) {
                return res.status(400).json({
                    success: false,
                    error: 'Invalid proposal ID'
                });
            }

            // Find proposal
            proposal = await Proposal.findOne({
                where: {
                    id: proposalId,
                    serviceRequestId: requestId,
                    status: 'SENT'
                },
                include: [{
                    model: ProviderProfile,
                    as: 'provider',
                    attributes: ['id', 'userId'],
                    include: [{
                        model: User,
                        as: 'user',
                        attributes: ['id', 'name', 'email']
                    }]
                }]
            });

            if (!proposal) {
                return res.status(404).json({
                    success: false,
                    error: 'Proposal not found or already processed'
                });
            }

            // Update proposal status
            proposal.status = 'REJECTED';
            // Try to set rejection reasons, but handle gracefully if columns don't exist
            try {
                proposal.rejectionReason = rejectionReason || null;
                proposal.rejectionReasonOther = rejectionReason === 'OTHER' ? rejectionReasonOther : null;
            } catch (reasonError) {
                // If setting rejection reasons fails, just log and continue
                console.log('Could not set rejection reasons (migration may not be run yet):', reasonError.message);
            }
            // Use try-catch for save() to handle missing columns gracefully
            try {
                await proposal.save();
            } catch (saveError) {
                // If error is about missing columns, only update status (migration not run yet)
                if (saveError.message && saveError.message.includes('Unknown column')) {
                    console.log('Migration not run yet, updating only status field...');
                    proposal.rejectionReason = undefined;
                    proposal.rejectionReasonOther = undefined;
                    await proposal.save();
                    console.warn('⚠️ Rejection reasons provided but not saved - migration not run yet');
                } else {
                    throw saveError;
                }
            }
            proposalId = proposal.id;
            providerProfile = proposal.provider;
            providerUser = proposal.provider?.user;

            // Find and update associated lead (if exists)
            // Lead.providerId is User.id, Proposal.providerId is ProviderProfile.id
            // So we need to find lead by provider's userId and check metadata for serviceRequestId
            if (providerProfile && providerProfile.userId) {
                try {
                    // Find all leads for this provider
                    const providerLeads = await Lead.findAll({
                        where: {
                            providerId: providerProfile.userId // Lead.providerId = User.id
                        },
                        limit: 200 // Increased limit to catch more leads
                    });

                    console.log(`[Reject Proposal] Found ${providerLeads.length} leads for provider ${providerProfile.userId}`);

                    // Find the lead that matches this service request
                    let leadUpdated = false;
                    for (const lead of providerLeads) {
                        let shouldUpdate = false;

                        // Check metadata for serviceRequestId match
                        if (lead.metadata) {
                            try {
                                const metadata = typeof lead.metadata === 'string'
                                    ? JSON.parse(lead.metadata)
                                    : lead.metadata;

                                // Check if metadata has serviceRequestId matching this request
                                if (metadata.serviceRequestId === requestId) {
                                    shouldUpdate = true;
                                    console.log(`[Reject Proposal] Found matching lead ${lead.id} by serviceRequestId in metadata`);
                                }
                                // Also check if lead has pending proposal (might be related)
                                else if (metadata.pendingProposal && (lead.status === 'submitted' || lead.status === 'routed')) {
                                    // If this is the only active lead with pending proposal, it's likely related
                                    shouldUpdate = true;
                                    console.log(`[Reject Proposal] Found matching lead ${lead.id} by pending proposal in metadata`);
                                }
                            } catch (e) {
                                console.error(`[Reject Proposal] Error parsing metadata for lead ${lead.id}:`, e);
                                // Skip invalid metadata
                                continue;
                            }
                        }

                        // Also check by payment intent ID if proposal has one
                        if (!shouldUpdate && proposal.stripePaymentIntentId && lead.stripePaymentIntentId) {
                            if (lead.stripePaymentIntentId === proposal.stripePaymentIntentId) {
                                shouldUpdate = true;
                                console.log(`[Reject Proposal] Found matching lead ${lead.id} by stripePaymentIntentId`);
                            }
                        }

                        if (shouldUpdate && lead.status !== 'rejected') {
                            await Lead.update(
                                { status: 'rejected' },
                                { where: { id: lead.id } }
                            );
                            console.log(`✅ Updated associated lead ${lead.id} status to rejected for service request ${requestId}`);
                            leadUpdated = true;
                            break; // Found and updated, no need to continue
                        }
                    }

                    if (!leadUpdated) {
                        console.log(`[Reject Proposal] No matching lead found to update for service request ${requestId}, provider ${providerProfile.userId}`);
                    }
                } catch (error) {
                    console.error(`[Reject Proposal] Error finding/updating lead:`, error);
                    // Don't fail the proposal rejection if lead update fails
                }
            }
        }

        // Get customer info for email
        const customer = await User.findByPk(req.user.id);

        // Send email to provider (only if we have provider email)
        if (providerUser && providerUser.email) {
            sendEmail({
                to: providerUser.email,
                subject: `Proposal Update: ${serviceRequest.projectTitle}`,
                html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f9f9f9;">
                    <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0;">
                        <h1 style="margin: 0; font-size: 28px;">Proposal Update</h1>
                    </div>
                    <div style="background-color: white; padding: 30px; border-radius: 0 0 8px 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
                        <p style="color: #333; font-size: 16px; line-height: 1.6;">
                            Hi ${providerUser.name || 'Provider'},
                        </p>
                        <p style="color: #333; font-size: 16px; line-height: 1.6;">
                            We wanted to inform you that your proposal for <strong>${serviceRequest.projectTitle}</strong> has been declined by the customer.
                        </p>
                        <div style="background-color: #f8f9fa; padding: 15px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #6c757d;">
                            <p style="color: #333; font-size: 14px; margin: 0;">
                                <strong>Project:</strong> ${serviceRequest.projectTitle}<br/>
                                <strong>Category:</strong> ${serviceRequest.category?.name || 'N/A'}<br/>
                                <strong>Status:</strong> <span style="color: #dc3545; font-weight: 600;">REJECTED</span>
                            </p>
                        </div>
                        ${rejectionReason ? `
                        <div style="background-color: #fff3cd; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #ffc107;">
                            <h3 style="margin-top: 0; color: #856404;">Rejection Reason</h3>
                            <p style="margin: 5px 0; color: #856404;">
                                <strong>Reason:</strong> ${rejectionReason === 'TOO_FAR' ? 'Too Far' :
                            rejectionReason === 'TOO_EXPENSIVE' ? 'Too Expensive' :
                                rejectionReason === 'NOT_RELEVANT' ? 'Not Relevant Service Request' :
                                    'Other'}
                            </p>
                            ${rejectionReason === 'OTHER' && rejectionReasonOther ? `
                            <p style="margin: 5px 0; color: #856404; white-space: pre-wrap;"><strong>Details:</strong> ${rejectionReasonOther}</p>
                            ` : ''}
                        </div>
                        ` : ''}
                        <p style="color: #333; font-size: 16px; line-height: 1.6;">
                            Don't worry! You'll continue to receive new leads and opportunities. Keep up the great work!
                        </p>
                        <p style="color: #6c757d; font-size: 14px; line-height: 1.6; margin-top: 20px;">
                            <strong>Note:</strong> This lead will appear in your "Rejected" filter. You can view all your leads, including rejected ones, in your dashboard.
                        </p>
                        <div style="text-align: center; margin-top: 30px;">
                            <a href="${process.env.FRONTEND_URL || 'http://localhost:3000'}/user-dashboard/leads" 
                               style="display: inline-block; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; 
                                      padding: 14px 32px; text-decoration: none; border-radius: 8px; 
                                      font-weight: 600; font-size: 16px; box-shadow: 0 4px 6px rgba(102, 126, 234, 0.3);">
                                View Leads
                            </a>
                        </div>
                    </div>
                </div>
            `
            }).catch(err => console.error('Failed to send email to provider:', err));
        }

        // Log activity
        await logActivity({
            type: 'proposal_rejected',
            description: `Proposal rejected for service request "${serviceRequest.projectTitle}"`,
            userId: req.user.id,
            metadata: {
                serviceRequestId: serviceRequest.id,
                proposalId: proposalId || `pending-${leadId}`,
                providerId: providerProfile?.id || leadId,
                isPendingProposal: isPendingProposal
            }
        });

        res.json({
            success: true,
            message: 'Proposal rejected successfully',
            data: {
                proposalId: proposalId || `pending-${leadId}`,
                status: proposal ? proposal.status : 'REJECTED',
                isPendingProposal: isPendingProposal
            }
        });
    } catch (error) {
        console.error('Reject proposal error:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Failed to reject proposal'
        });
    }
});

// @route   PATCH /api/service-requests/my/service-requests/:id
// @desc    Update a service request (only allowed for early statuses)
// @access  Private (Customer and Provider)
router.patch('/my/service-requests/:id', protect, async (req, res) => {
    try {
        // Allow customers and providers (business_owner) to update their own requests
        if (req.user.role !== 'CUSTOMER' && req.user.role !== 'user' && req.user.role !== 'business_owner') {
            return res.status(403).json({
                success: false,
                error: 'Access denied. This endpoint is for customers and providers only.'
            });
        }

        const requestId = parseInt(req.params.id);
        if (isNaN(requestId)) {
            return res.status(400).json({
                success: false,
                error: 'Invalid request ID'
            });
        }

        // Find service request
        const serviceRequest = await ServiceRequest.findOne({
            where: {
                id: requestId,
                customerId: req.user.id
            }
        });

        if (!serviceRequest) {
            return res.status(404).json({
                success: false,
                error: 'Service request not found'
            });
        }

        // Check if request can be edited (only early statuses)
        const editableStatuses = ['REQUEST_CREATED'];
        if (!editableStatuses.includes(serviceRequest.status)) {
            return res.status(400).json({
                success: false,
                error: `Cannot edit request with status: ${serviceRequest.status}. Only requests with status REQUEST_CREATED can be edited.`
            });
        }

        // Allowed fields to update
        const allowedFields = ['projectTitle', 'projectDescription', 'preferredDate', 'preferredTime', 'attachments'];
        const updates = {};

        allowedFields.forEach(field => {
            if (req.body[field] !== undefined) {
                updates[field] = req.body[field];
            }
        });

        // Validate updates
        if (updates.projectTitle && (!updates.projectTitle.trim() || updates.projectTitle.trim().length < 3)) {
            return res.status(400).json({
                success: false,
                error: 'Project title must be at least 3 characters'
            });
        }

        if (updates.projectDescription && (!updates.projectDescription.trim() || updates.projectDescription.trim().length < 10)) {
            return res.status(400).json({
                success: false,
                error: 'Project description must be at least 10 characters'
            });
        }

        // Update service request
        Object.assign(serviceRequest, updates);
        await serviceRequest.save();

        // Log activity
        await logActivity({
            type: 'service_request_updated',
            description: `Service request "${serviceRequest.projectTitle}" updated by customer`,
            userId: req.user.id,
            metadata: { serviceRequestId: serviceRequest.id, updatedFields: Object.keys(updates) }
        });

        res.json({
            success: true,
            message: 'Service request updated successfully',
            data: serviceRequest
        });
    } catch (error) {
        console.error('Update service request error:', error);
        res.status(500).json({
            success: false,
            error: 'Server error'
        });
    }
});

// @route   POST /api/service-requests/:id/proposals
// @desc    Provider creates a proposal for a service request
// @access  Private (Provider only)
router.post('/:id/proposals', protect, async (req, res) => {
    try {
        // Only allow providers
        if (req.user.role !== 'PROVIDER' && req.user.role !== 'business_owner') {
            return res.status(403).json({
                success: false,
                error: 'Access denied. This endpoint is for providers only.'
            });
        }

        const requestId = parseInt(req.params.id);
        if (isNaN(requestId)) {
            return res.status(400).json({
                success: false,
                error: 'Invalid service request ID'
            });
        }

        // Get provider profile
        const providerProfile = await ProviderProfile.findOne({
            where: { userId: req.user.id },
            attributes: ['id', 'userId']
        });

        if (!providerProfile) {
            return res.status(404).json({
                success: false,
                error: 'Provider profile not found'
            });
        }

        // Find service request
        const serviceRequest = await ServiceRequest.findByPk(requestId, {
            include: [
                { model: User, as: 'customer', attributes: ['id', 'name', 'email', 'firstName', 'lastName'] },
                { model: Category, as: 'category', attributes: ['id', 'name'] }
            ]
        });

        if (!serviceRequest) {
            return res.status(404).json({
                success: false,
                error: 'Service request not found'
            });
        }

        // Validate proposal data
        const { details, price } = req.body;

        if (!details || !details.trim()) {
            return res.status(400).json({
                success: false,
                error: 'Proposal details are required'
            });
        }

        if (!price || parseFloat(price) <= 0) {
            return res.status(400).json({
                success: false,
                error: 'Valid price (greater than 0) is required'
            });
        }

        // Check if proposal already exists for this provider and service request
        const existingProposal = await Proposal.findOne({
            where: {
                serviceRequestId: requestId,
                providerId: providerProfile.id,
                status: { [Op.in]: ['SENT', 'ACCEPTED'] }
            }
        });

        if (existingProposal) {
            return res.status(400).json({
                success: false,
                error: 'You have already submitted a proposal for this service request'
            });
        }

        // Create proposal
        const proposal = await Proposal.create({
            serviceRequestId: requestId,
            providerId: providerProfile.id,
            details: details.trim(),
            price: parseFloat(price),
            status: 'SENT'
        });

        // Get provider info for email
        const provider = await User.findByPk(req.user.id, {
            attributes: ['id', 'name', 'email', 'firstName', 'lastName']
        });

        // Send email to customer (non-blocking)
        if (serviceRequest.customer && serviceRequest.customer.email) {
            const customerName = serviceRequest.customer.firstName && serviceRequest.customer.lastName
                ? `${serviceRequest.customer.firstName} ${serviceRequest.customer.lastName}`
                : serviceRequest.customer.name || 'Customer';

            const providerName = provider.firstName && provider.lastName
                ? `${provider.firstName} ${provider.lastName}`
                : provider.name || 'Provider';

            sendEmail({
                to: serviceRequest.customer.email,
                subject: `New proposal from ${providerName} for ${serviceRequest.projectTitle}`,
                html: `
                    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f9f9f9;">
                        <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0;">
                            <h1 style="margin: 0; font-size: 28px;">New Proposal Received!</h1>
                        </div>
                        <div style="background-color: white; padding: 30px; border-radius: 0 0 8px 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
                            <p style="color: #333; font-size: 16px; line-height: 1.6;">
                                Hi ${customerName},
                            </p>
                            <p style="color: #333; font-size: 16px; line-height: 1.6;">
                                Great news! <strong>${providerName}</strong> has sent you a proposal for your service request: <strong>${serviceRequest.projectTitle}</strong>.
                            </p>
                            
                            <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
                                <h3 style="margin-top: 0; color: #333;">Service Request</h3>
                                <p style="margin: 5px 0;"><strong>Project:</strong> ${serviceRequest.projectTitle}</p>
                                ${serviceRequest.category ? `<p style="margin: 5px 0;"><strong>Category:</strong> ${serviceRequest.category.name}</p>` : ''}
                            </div>

                            <div style="background-color: #e7f3ff; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #007bff;">
                                <h3 style="margin-top: 0; color: #004085;">Proposal Details</h3>
                                <p style="margin: 5px 0; color: #333; white-space: pre-wrap;">${details.trim()}</p>
                                <p style="margin: 15px 0 5px 0;"><strong>Price:</strong> $${parseFloat(price).toFixed(2)}</p>
                            </div>

                            <div style="text-align: center; margin-top: 30px; padding-top: 25px; border-top: 2px solid #e5e7eb;">
                                <a href="${process.env.FRONTEND_URL || 'http://localhost:3000'}/user-dashboard/requests" 
                                   style="display: inline-block; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; 
                                          padding: 14px 32px; text-decoration: none; border-radius: 8px; 
                                          font-weight: 600; font-size: 16px; box-shadow: 0 4px 6px rgba(102, 126, 234, 0.3);">
                                    View Proposal
                                </a>
                            </div>
                        </div>
                    </div>
                `
            }).catch(err => console.error('Failed to send proposal email to customer:', err));
        }

        // Log activity
        await logActivity({
            type: 'proposal_created',
            description: `Provider created proposal for service request "${serviceRequest.projectTitle}"`,
            userId: req.user.id,
            metadata: {
                proposalId: proposal.id,
                serviceRequestId: requestId,
                providerId: providerProfile.id
            }
        });

        res.json({
            success: true,
            message: 'Proposal created and sent successfully',
            data: {
                proposalId: proposal.id,
                serviceRequestId: requestId,
                price: proposal.price,
                status: proposal.status
            }
        });
    } catch (error) {
        console.error('Create proposal error:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Server error'
        });
    }
});

// @route   GET /api/service-requests/:id/proposals
// @desc    Get all proposals for a service request
// @access  Private (Customer or Provider)
router.get('/:id/proposals', protect, async (req, res) => {
    try {
        const requestId = parseInt(req.params.id);
        if (isNaN(requestId)) {
            return res.status(400).json({
                success: false,
                error: 'Invalid service request ID'
            });
        }

        // Find service request
        const serviceRequest = await ServiceRequest.findByPk(requestId);

        if (!serviceRequest) {
            return res.status(404).json({
                success: false,
                error: 'Service request not found'
            });
        }

        // Check access: customer can see their own requests, provider can see if they have a proposal
        if (req.user.role === 'CUSTOMER' || req.user.role === 'user') {
            if (serviceRequest.customerId !== req.user.id) {
                return res.status(403).json({
                    success: false,
                    error: 'Access denied. You can only view proposals for your own service requests.'
                });
            }
        } else if (req.user.role === 'PROVIDER' || req.user.role === 'business_owner') {
            // Provider can only see proposals if they have one for this request
            const providerProfile = await ProviderProfile.findOne({
                where: { userId: req.user.id },
                attributes: ['id']
            });

            if (providerProfile) {
                const hasProposal = await Proposal.findOne({
                    where: {
                        serviceRequestId: requestId,
                        providerId: providerProfile.id
                    }
                });

                if (!hasProposal) {
                    return res.status(403).json({
                        success: false,
                        error: 'Access denied. You can only view proposals for service requests you have proposals for.'
                    });
                }
            } else {
                return res.status(403).json({
                    success: false,
                    error: 'Provider profile not found'
                });
            }
        } else {
            return res.status(403).json({
                success: false,
                error: 'Access denied'
            });
        }

        // Define base attributes (columns that always exist)
        const baseAttributes = [
            'id', 'serviceRequestId', 'providerId', 'details', 'price',
            'status', 'stripePaymentIntentId', 'paymentStatus', 'paidAt',
            'createdAt', 'updatedAt'
        ];

        // Get all proposals for this service request
        const proposals = await Proposal.findAll({
            where: { serviceRequestId: requestId },
            attributes: baseAttributes,
            include: [
                {
                    model: ProviderProfile,
                    as: 'provider',
                    attributes: ['id', 'userId'],
                    include: [{
                        model: User,
                        as: 'user',
                        attributes: ['id', 'name', 'email', 'firstName', 'lastName', 'avatar']
                    }],
                    required: false
                }
            ],
            order: [['createdAt', 'DESC']]
        }).catch(async (error) => {
            // If error is due to missing columns, retry with base attributes only
            if (error.message && error.message.includes('Unknown column')) {
                console.log('Retrying proposal query with base attributes only (payout columns not migrated yet)');
                return await Proposal.findAll({
                    where: { serviceRequestId: requestId },
                    attributes: baseAttributes,
                    include: [
                        {
                            model: ProviderProfile,
                            as: 'provider',
                            attributes: ['id', 'userId'],
                            include: [{
                                model: User,
                                as: 'user',
                                attributes: ['id', 'name', 'email', 'firstName', 'lastName', 'avatar']
                            }],
                            required: false
                        }
                    ],
                    order: [['createdAt', 'DESC']]
                });
            }
            throw error;
        });

        // Only show provider contact info if proposal is ACCEPTED
        const formattedProposals = proposals.map(proposal => {
            const isAccepted = (proposal.status || 'SENT') === 'ACCEPTED';
            return {
                id: proposal.id,
                details: proposal.details,
                price: parseFloat(proposal.price),
                status: proposal.status,
                paymentStatus: proposal.paymentStatus,
                paidAt: proposal.paidAt,
                providerPayoutAmount: proposal.providerPayoutAmount ? parseFloat(proposal.providerPayoutAmount) : null,
                platformFeeAmount: proposal.platformFeeAmount ? parseFloat(proposal.platformFeeAmount) : null,
                payoutStatus: proposal.payoutStatus || null,
                payoutProcessedAt: proposal.payoutProcessedAt || null,
                provider: proposal.provider?.user ? {
                    id: proposal.provider.user.id,
                    name: proposal.provider.user.firstName && proposal.provider.user.lastName
                        ? `${proposal.provider.user.firstName} ${proposal.provider.user.lastName}`
                        : proposal.provider.user.name,
                    email: isAccepted ? (proposal.provider.user.email || null) : null,
                    phone: isAccepted ? (proposal.provider.user.phone || null) : null,
                    avatar: proposal.provider.user.avatar
                } : null,
                createdAt: proposal.createdAt,
                updatedAt: proposal.updatedAt
            };
        });

        res.json({
            success: true,
            data: formattedProposals,
            count: formattedProposals.length
        });
    } catch (error) {
        console.error('Get proposals error:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Server error'
        });
    }
});

// @route   POST /api/service-requests
// @desc    Create a new service request
// @access  Private (Customer only)
router.post('/', protect, async (req, res) => {
    try {
        // Validate required fields
        if (!req.body.categoryId || !req.body.projectTitle || !req.body.projectDescription || !req.body.zipCode) {
            return res.status(400).json({
                success: false,
                error: 'Category, project title, description, and zip code are required'
            });
        }

        // Verify category exists (using Category table)
        const category = await Category.findByPk(req.body.categoryId);
        if (!category) {
            return res.status(400).json({
                success: false,
                error: 'Invalid category'
            });
        }

        // Verify subcategory if provided (only if it's a valid non-empty value)
        // Normalize subCategoryId: convert empty string, null, undefined to null
        const subCategoryIdValue = req.body.subCategoryId;
        const categoryIdValue = parseInt(req.body.categoryId);

        console.log(`Validating subcategory - subCategoryId: ${subCategoryIdValue} (type: ${typeof subCategoryIdValue}), categoryId: ${categoryIdValue}`);

        if (subCategoryIdValue !== null && subCategoryIdValue !== undefined && subCategoryIdValue !== '') {
            const subCategoryId = parseInt(subCategoryIdValue);
            if (isNaN(subCategoryId) || subCategoryId <= 0) {
                console.error(`Invalid subCategoryId: ${subCategoryIdValue}, categoryId: ${categoryIdValue}`);
                return res.status(400).json({
                    success: false,
                    error: 'Invalid subcategory ID'
                });
            }

            const subCategory = await SubCategory.findByPk(subCategoryId);
            if (!subCategory) {
                console.error(`Subcategory not found: ${subCategoryId}, categoryId: ${categoryIdValue}`);
                return res.status(400).json({
                    success: false,
                    error: 'Subcategory not found'
                });
            }

            // Use strict comparison with both values as integers
            const subCategoryCategoryId = parseInt(subCategory.categoryId);
            if (subCategoryCategoryId !== categoryIdValue) {
                console.error(`Subcategory mismatch: subCategoryId ${subCategoryId} belongs to categoryId ${subCategoryCategoryId} (${typeof subCategoryCategoryId}), but request has categoryId ${categoryIdValue} (${typeof categoryIdValue})`);
                return res.status(400).json({
                    success: false,
                    error: 'Subcategory does not match the selected category'
                });
            }

            console.log(`Subcategory validation passed: subCategoryId ${subCategoryId} matches categoryId ${categoryIdValue}`);
        }

        // Validate selected business IDs if provided
        let selectedBusinessIds = [];
        if (req.body.selectedBusinessIds && Array.isArray(req.body.selectedBusinessIds)) {
            // Business is already imported at the top
            const validBusinessIds = await Business.findAll({
                where: { id: req.body.selectedBusinessIds },
                attributes: ['id']
            });
            selectedBusinessIds = validBusinessIds.map(b => b.id);
        }

        // Verify ServiceRequest is available
        if (!ServiceRequest || typeof ServiceRequest.create !== 'function') {
            console.error('ServiceRequest model is not properly loaded');
            return res.status(500).json({
                success: false,
                error: 'Service request model not available'
            });
        }

        // Create service request
        const serviceRequest = await ServiceRequest.create({
            customerId: req.user.id,
            categoryId: parseInt(req.body.categoryId),
            subCategoryId: (req.body.subCategoryId && req.body.subCategoryId !== '' && req.body.subCategoryId !== null)
                ? parseInt(req.body.subCategoryId)
                : null,
            zipCode: req.body.zipCode,
            projectTitle: req.body.projectTitle,
            projectDescription: req.body.projectDescription,
            attachments: req.body.attachments || [],
            preferredDate: req.body.preferredDate || null,
            preferredTime: req.body.preferredTime || null,
            selectedBusinessIds: selectedBusinessIds,
            status: 'REQUEST_CREATED'
        });

        // Log activity
        await logActivity({
            type: 'service_request_created',
            description: `Service request "${serviceRequest.projectTitle}" created`,
            userId: req.user.id,
            metadata: { serviceRequestId: serviceRequest.id, categoryId: serviceRequest.categoryId }
        });

        // Assign providers using matching logic
        let primary = null;
        let alternatives = [];
        let primaryLead = null;

        try {
            const result = await assignProvidersForRequest(serviceRequest.id);
            primary = result.primary;
            alternatives = result.alternatives || [];

            // Get customer info for lead creation
            const customer = await User.findByPk(req.user.id, {
                attributes: ['id', 'name', 'email', 'phone', 'firstName', 'lastName']
            });

            const customerName = customer.firstName && customer.lastName
                ? `${customer.firstName} ${customer.lastName}`
                : customer.name || customer.email;

            // Get category name for serviceType
            const categoryName = category.name;
            const subCategoryName = serviceRequest.subCategoryId
                ? (await SubCategory.findByPk(serviceRequest.subCategoryId))?.name || null
                : null;

            // Create Lead for primary provider if exists
            console.log('Checking primary provider for lead creation:', {
                primaryExists: !!primary,
                hasBusiness: !!(primary && primary.business),
                hasOwner: !!(primary && primary.owner),
                hasProviderProfile: !!(primary && primary.providerProfile),
                businessId: primary?.business?.id,
                ownerId: primary?.owner?.id,
                providerProfileId: primary?.providerProfile?.id
            });

            if (primary && primary.business && primary.owner) {
                try {
                    const locationCity = primary.business.city || null;
                    const locationState = primary.business.state || null;

                    console.log('Creating lead for primary provider...');
                    primaryLead = await Lead.create({
                        customerId: customer.id,
                        businessId: primary.business.id,
                        providerId: primary.owner.id, // User ID
                        serviceType: subCategoryName
                            ? `${categoryName} - ${subCategoryName}`
                            : categoryName,
                        categoryId: serviceRequest.categoryId,
                        locationCity: locationCity,
                        locationState: locationState,
                        locationPostalCode: serviceRequest.zipCode,
                        description: serviceRequest.projectDescription,
                        customerName: customerName,
                        customerEmail: customer.email,
                        customerPhone: customer.phone || null,
                        preferredContact: 'either',
                        status: 'submitted', // Status = PENDING (submitted = waiting for provider response)
                        routedAt: new Date(),
                        metadata: JSON.stringify({
                            serviceRequestId: serviceRequest.id,
                            projectTitle: serviceRequest.projectTitle,
                            preferredDate: serviceRequest.preferredDate,
                            preferredTime: serviceRequest.preferredTime,
                            attachments: serviceRequest.attachments
                        })
                    });

                    console.log(`✅ Lead created successfully: ID=${primaryLead.id}, businessId=${primary.business.id}, providerId=${primary.owner.id}`);

                    // Update service request with primary provider
                    if (primary.providerProfile && primary.providerProfile.id) {
                        await ServiceRequest.update(
                            { primaryProviderId: primary.providerProfile.id },
                            { where: { id: serviceRequest.id } }
                        );
                        console.log(`✅ Updated service request with primaryProviderId: ${primary.providerProfile.id}`);
                    } else {
                        console.warn(`⚠️ Cannot update primaryProviderId - providerProfile.id is missing`);
                    }
                } catch (leadCreateError) {
                    console.error('❌ Error creating lead:', leadCreateError);
                    console.error('Lead creation error details:', {
                        message: leadCreateError.message,
                        stack: leadCreateError.stack,
                        name: leadCreateError.name
                    });
                    // Don't throw - continue with email sending even if lead creation fails
                    primaryLead = null;
                }
            } else {
                console.warn('⚠️ Cannot create lead - missing required data:', {
                    primary: !!primary,
                    business: !!(primary && primary.business),
                    owner: !!(primary && primary.owner)
                });
            }

            // Create AlternativeProviderSelection entries for alternatives
            if (alternatives && alternatives.length > 0) {
                const alternativePromises = alternatives.map((alt, index) => {
                    if (!alt || !alt.business || !alt.owner) return null;

                    return AlternativeProviderSelection.create({
                        serviceRequestId: serviceRequest.id,
                        providerId: alt.providerProfile.id, // ProviderProfile ID
                        position: index + 1 // Position 1, 2, or 3
                    });
                });

                await Promise.all(alternativePromises.filter(p => p !== null));
            }

            // Update service request status to LEAD_ASSIGNED if primary was assigned
            if (primaryLead) {
                await ServiceRequest.update(
                    { status: 'LEAD_ASSIGNED' },
                    { where: { id: serviceRequest.id } }
                );
                serviceRequest.status = 'LEAD_ASSIGNED';
            }

            console.log(`Assigned providers for service request ${serviceRequest.id}: primary=${primary ? 'yes' : 'no'}, alternatives=${alternatives.length}`);
            if (primary) {
                console.log(`Primary provider details:`, {
                    businessId: primary.business?.id,
                    ownerId: primary.owner?.id,
                    ownerEmail: primary.owner?.email,
                    providerProfileId: primary.providerProfile?.id
                });
            }

        } catch (leadError) {
            console.error('❌ Error in provider assignment/lead creation block:', leadError);
            console.error('Error details:', {
                message: leadError.message,
                stack: leadError.stack,
                name: leadError.name
            });
            // Don't fail the service request creation if lead creation fails
            // But ensure primary and alternatives are set to safe defaults
            if (!primary) primary = null;
            if (!alternatives) alternatives = [];
            if (!primaryLead) primaryLead = null;
        }

        // Send notification to primary provider
        try {
            const sendEmail = require('../utils/sendEmail');
            const customer = await User.findByPk(req.user.id, {
                attributes: ['id', 'name', 'email', 'phone', 'firstName', 'lastName']
            });

            // Send email to primary provider if one was assigned (regardless of lead creation success)
            if (primary && primary.owner) {
                const providerEmail = primary.owner.email;
                console.log(`Attempting to send email to primary provider: ${providerEmail}`);
                if (providerEmail) {
                    const categoryName = category.name;
                    const subCategoryName = serviceRequest.subCategoryId
                        ? (await SubCategory.findByPk(serviceRequest.subCategoryId))?.name || 'Not specified'
                        : 'Not specified';
                    const preferredDate = serviceRequest.preferredDate
                        ? new Date(serviceRequest.preferredDate).toLocaleDateString('en-US', {
                            year: 'numeric',
                            month: 'long',
                            day: 'numeric'
                        })
                        : 'Not specified';
                    const preferredTime = serviceRequest.preferredTime || 'Not specified';

                    sendEmail({
                        to: providerEmail,
                        subject: `New lead: ${serviceRequest.projectTitle}`,
                        html: `
                        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f9fafb;">
                            <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 12px 12px 0 0;">
                                <h2 style="margin: 0; font-size: 28px; font-weight: 700;">New Service Request</h2>
                                <p style="margin: 10px 0 0 0; font-size: 16px; opacity: 0.9;">You have a new customer inquiry</p>
                            </div>
                            <div style="background-color: white; padding: 30px; border-radius: 0 0 12px 12px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
                                <div style="background-color: #f0f4ff; padding: 20px; border-radius: 8px; margin-bottom: 25px; border-left: 4px solid #667eea;">
                                    <h3 style="margin: 0 0 10px 0; color: #1a1d29; font-size: 20px;">${serviceRequest.projectTitle}</h3>
                                    <p style="margin: 0; color: #6b7280; font-size: 14px; line-height: 1.6;">${serviceRequest.projectDescription}</p>
                                </div>

                                <div style="margin-bottom: 25px;">
                                    <h4 style="margin: 0 0 15px 0; color: #374151; font-size: 16px; font-weight: 600; display: flex; align-items: center;">
                                        <span style="background-color: #667eea; color: white; width: 24px; height: 24px; border-radius: 50%; display: inline-flex; align-items: center; justify-content: center; margin-right: 10px; font-size: 12px;">1</span>
                                        Service Details
                                    </h4>
                                    <div style="background-color: #f9fafb; padding: 15px; border-radius: 8px;">
                                        <p style="margin: 5px 0; color: #374151;"><strong>Category:</strong> ${categoryName}</p>
                                        <p style="margin: 5px 0; color: #374151;"><strong>Sub-Category:</strong> ${subCategoryName}</p>
                                        <p style="margin: 5px 0; color: #374151;"><strong>Location:</strong> ${serviceRequest.zipCode}</p>
                                        <p style="margin: 5px 0; color: #374151;"><strong>Preferred Date:</strong> ${preferredDate}</p>
                                        <p style="margin: 5px 0; color: #374151;"><strong>Preferred Time:</strong> ${preferredTime}</p>
                                    </div>
                                </div>

                                ${serviceRequest.attachments && serviceRequest.attachments.length > 0 ? `
                                <div style="margin-bottom: 25px;">
                                    <h4 style="margin: 0 0 15px 0; color: #374151; font-size: 16px; font-weight: 600; display: flex; align-items: center;">
                                        <span style="background-color: #667eea; color: white; width: 24px; height: 24px; border-radius: 50%; display: inline-flex; align-items: center; justify-content: center; margin-right: 10px; font-size: 12px;">2</span>
                                        Attachments
                                    </h4>
                                    <p style="color: #6b7280; font-size: 14px;">Customer has attached ${serviceRequest.attachments.length} file(s) with this request.</p>
                                </div>
                                ` : ''}

                                <div style="text-align: center; margin-top: 30px; padding-top: 25px; border-top: 2px solid #e5e7eb;">
                                    <p style="color: #6b7280; font-size: 14px; margin-bottom: 20px;">
                                        This is an automated notification. Please respond to the customer as soon as possible.
                                    </p>
                                    <a href="${process.env.FRONTEND_URL || 'http://localhost:3000'}/user-dashboard/leads" 
                                       style="display: inline-block; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; 
                                              padding: 14px 32px; text-decoration: none; border-radius: 8px; 
                                              font-weight: 600; font-size: 16px; box-shadow: 0 4px 6px rgba(102, 126, 234, 0.3);">
                                        View Lead in Dashboard
                                    </a>
                                </div>
                            </div>
                            <div style="text-align: center; margin-top: 20px; color: #9ca3af; font-size: 12px;">
                                <p>You have been selected as the primary provider for this service request. Please respond as soon as possible.</p>
                            </div>
                        </div>
                    `
                    }).then(result => {
                        console.log(`✅ Email sent successfully to primary provider: ${providerEmail}`);
                        console.log(`Email message ID: ${result.messageId || 'N/A'}`);
                    }).catch(err => {
                        console.error(`❌ Failed to send email to primary provider: ${providerEmail}`, err);
                        console.error(`Error details:`, err.message || err);
                    });
                } else {
                    console.warn(`⚠️ Primary provider email not found. Provider owner:`, primary.owner);
                }
            } else {
                console.log(`ℹ️ No primary provider assigned or primary.owner missing. Primary:`, primary ? 'exists' : 'null');
            }

            // Send confirmation email to customer
            const customerName = customer.firstName && customer.lastName
                ? `${customer.firstName} ${customer.lastName}`
                : customer.name || customer.email;

            const categoryName = category.name;
            const subCategoryName = serviceRequest.subCategoryId
                ? (await SubCategory.findByPk(serviceRequest.subCategoryId))?.name || 'Not specified'
                : 'Not specified';
            const preferredDate = serviceRequest.preferredDate
                ? new Date(serviceRequest.preferredDate).toLocaleDateString('en-US', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric'
                })
                : 'Not specified';
            const preferredTime = serviceRequest.preferredTime || 'Not specified';

            // Calculate total businesses notified (primary + alternatives)
            const totalBusinessesNotified = (primary ? 1 : 0) + (alternatives ? alternatives.length : 0);
            const businessCountText = totalBusinessesNotified > 0
                ? `${totalBusinessesNotified} business${totalBusinessesNotified !== 1 ? 'es' : ''}`
                : 'relevant businesses';

            sendEmail({
                to: customer.email,
                subject: `Request received — ${serviceRequest.projectTitle}`,
                html: `
                    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f9fafb;">
                        <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 12px 12px 0 0;">
                            <h2 style="margin: 0; font-size: 28px; font-weight: 700;">Request Submitted Successfully!</h2>
                            <p style="margin: 10px 0 0 0; font-size: 16px; opacity: 0.9;">Thank you for using our service</p>
                        </div>
                        <div style="background-color: white; padding: 30px; border-radius: 0 0 12px 12px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
                            <p style="color: #333; margin-bottom: 25px; font-size: 16px; line-height: 1.6;">
                                Hi ${customerName},
                            </p>
                            <p style="color: #333; margin-bottom: 25px; font-size: 16px; line-height: 1.6;">
                                We've received your service request and have notified relevant businesses in your area. You'll receive responses from qualified service providers soon.
                            </p>

                            <div style="background-color: #f0f4ff; padding: 20px; border-radius: 8px; margin-bottom: 25px; border-left: 4px solid #667eea;">
                                <h3 style="margin: 0 0 15px 0; color: #1a1d29; font-size: 20px;">Request Summary</h3>
                                <div style="margin-bottom: 12px;">
                                    <strong style="color: #374151; display: block; margin-bottom: 4px;">Project:</strong>
                                    <span style="color: #1a1d29;">${serviceRequest.projectTitle}</span>
                                </div>
                                <div style="margin-bottom: 12px;">
                                    <strong style="color: #374151; display: block; margin-bottom: 4px;">Category:</strong>
                                    <span style="color: #1a1d29;">${categoryName}${subCategoryName !== 'Not specified' ? ' - ' + subCategoryName : ''}</span>
                                </div>
                                <div style="margin-bottom: 12px;">
                                    <strong style="color: #374151; display: block; margin-bottom: 4px;">Location:</strong>
                                    <span style="color: #1a1d29;">Zip Code: ${serviceRequest.zipCode}</span>
                                </div>
                                <div style="margin-bottom: 12px;">
                                    <strong style="color: #374151; display: block; margin-bottom: 4px;">Preferred Date & Time:</strong>
                                    <span style="color: #1a1d29;">${preferredDate} - ${preferredTime}</span>
                                </div>
                                <div>
                                    <strong style="color: #374151; display: block; margin-bottom: 4px;">Request ID:</strong>
                                    <span style="color: #667eea; font-weight: 600;">#${serviceRequest.id}</span>
                                </div>
                            </div>

                            <div style="background-color: #fef3c7; padding: 16px; border-radius: 8px; margin-bottom: 25px; border-left: 4px solid #f59e0b;">
                                <p style="margin: 0; color: #92400e; font-size: 14px; line-height: 1.6;">
                                    <strong>What's Next?</strong><br>
                                    • We've sent your request to ${businessCountText} in your area<br>
                                    • You'll receive responses from interested service providers<br>
                                    • You can track your request status in your dashboard
                                </p>
                            </div>

                            <div style="text-align: center; margin-top: 30px; padding-top: 25px; border-top: 2px solid #e5e7eb;">
                                <a href="${process.env.FRONTEND_URL || 'http://localhost:3000'}/user-dashboard/requests" 
                                   style="display: inline-block; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; 
                                          padding: 14px 32px; text-decoration: none; border-radius: 8px; 
                                          font-weight: 600; font-size: 16px; box-shadow: 0 4px 6px rgba(102, 126, 234, 0.3);">
                                    View My Requests
                                </a>
                            </div>

                            <p style="color: #6b7280; font-size: 14px; margin-top: 30px; line-height: 1.6;">
                                If you have any questions or need to make changes to your request, please contact our support team or visit your dashboard.
                            </p>
                        </div>
                        <div style="text-align: center; margin-top: 20px; color: #9ca3af; font-size: 12px;">
                            <p>This is an automated confirmation email. Please do not reply to this message.</p>
                        </div>
                    </div>
                `
            }).catch(err => {
                console.error('Failed to send customer confirmation email:', err);
            });
        } catch (emailError) {
            console.error('Error in notification system:', emailError);
            // Don't fail the request if email fails
        }

        // Reload with associations
        const createdRequest = await ServiceRequest.findByPk(serviceRequest.id, {
            include: [
                { model: Category, as: 'category', attributes: ['id', 'name', 'icon'] },
                { model: SubCategory, as: 'subCategory', attributes: ['id', 'name'], required: false }
            ]
        });

        res.status(201).json({
            success: true,
            message: 'Service request created successfully',
            serviceRequest: createdRequest
        });
    } catch (error) {
        console.error('Create service request error:', error);
        console.error('Error stack:', error.stack);
        console.error('ServiceRequest type:', typeof ServiceRequest);
        res.status(500).json({
            success: false,
            error: error.message || 'Failed to create service request'
        });
    }
});

// @route   PUT /api/service-requests/:id
// @desc    Update service request
// @access  Private (Customer or Admin)
router.put('/:id', protect, async (req, res) => {
    try {
        const serviceRequest = await ServiceRequest.findByPk(req.params.id);

        if (!serviceRequest) {
            return res.status(404).json({ error: 'Service request not found' });
        }

        // Check authorization
        if (req.user.role !== 'ADMIN' && req.user.role !== 'admin') {
            if (serviceRequest.customerId !== req.user.id) {
                return res.status(403).json({ error: 'Not authorized to update this request' });
            }
            // Only allow updates if status is REQUEST_CREATED
            if (serviceRequest.status !== 'REQUEST_CREATED') {
                return res.status(400).json({ error: 'Cannot update request after it has been processed' });
            }
        }

        // Update allowed fields
        const allowedFields = ['projectTitle', 'projectDescription', 'attachments', 'preferredDate', 'preferredTime', 'subCategoryId'];
        allowedFields.forEach(field => {
            if (req.body[field] !== undefined) {
                serviceRequest[field] = req.body[field];
            }
        });

        await serviceRequest.save();

        // Log activity
        await logActivity({
            type: 'service_request_updated',
            description: `Service request "${serviceRequest.projectTitle}" updated`,
            userId: req.user.id,
            metadata: { serviceRequestId: serviceRequest.id }
        });

        res.json({
            success: true,
            message: 'Service request updated successfully',
            serviceRequest
        });
    } catch (error) {
        console.error('Update service request error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// Export assignProvidersForRequest function for use in admin routes
module.exports = router;
module.exports.assignProvidersForRequest = assignProvidersForRequest;


