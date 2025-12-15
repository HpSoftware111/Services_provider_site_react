const { sequelize } = require('../config/database');
const User = require('./User');
const Category = require('./Category');
const SubCategory = require('./SubCategory');
const Business = require('./Business');
const Review = require('./Review');
const Blog = require('./Blog');
const Contact = require('./Contact');
const Activity = require('./Activity');
const ReviewRequest = require('./ReviewRequest');
const ServiceRequest = require('./ServiceRequest');
const Lead = require('./Lead');
const Proposal = require('./Proposal');
const WorkOrder = require('./WorkOrder');
const ProviderProfile = require('./ProviderProfile');
const NotificationAudit = require('./NotificationAudit');
const NotificationPreference = require('./NotificationPreference');
const SubscriptionPlan = require('./SubscriptionPlan');
const UserSubscription = require('./UserSubscription');
const PhoneVerification = require('./PhoneVerification');

// Define associations
User.hasMany(Business, { foreignKey: 'ownerId', as: 'businesses' });
Business.belongsTo(User, { foreignKey: 'ownerId', as: 'owner' });

Category.hasMany(Business, { foreignKey: 'categoryId', as: 'businesses' });
Business.belongsTo(Category, { foreignKey: 'categoryId', as: 'category' });

// SubCategory associations
Category.hasMany(SubCategory, { foreignKey: 'categoryId', as: 'subcategories' });
SubCategory.belongsTo(Category, { foreignKey: 'categoryId', as: 'category' });

Business.belongsTo(SubCategory, { foreignKey: 'subCategoryId', as: 'subcategory' });
SubCategory.hasMany(Business, { foreignKey: 'subCategoryId', as: 'businesses' });

Business.hasMany(Review, { foreignKey: 'businessId', as: 'reviews' });
Review.belongsTo(Business, { foreignKey: 'businessId', as: 'business' });

User.hasMany(Review, { foreignKey: 'userId', as: 'reviews' });
Review.belongsTo(User, { foreignKey: 'userId', as: 'user' });

User.hasMany(Activity, { foreignKey: 'userId', as: 'activities' });
Activity.belongsTo(User, { foreignKey: 'userId', as: 'user' });

// ReviewRequest associations
Business.hasMany(ReviewRequest, { foreignKey: 'businessId', as: 'reviewRequests' });
ReviewRequest.belongsTo(Business, { foreignKey: 'businessId', as: 'business' });

User.hasMany(ReviewRequest, { foreignKey: 'requestedBy', as: 'sentReviewRequests' });
ReviewRequest.belongsTo(User, { foreignKey: 'requestedBy', as: 'requester' });

// Service Request associations
User.hasMany(ServiceRequest, { foreignKey: 'customerId', as: 'serviceRequests' });
ServiceRequest.belongsTo(User, { foreignKey: 'customerId', as: 'customer' });
ServiceRequest.belongsTo(Category, { foreignKey: 'categoryId', as: 'category' });
ServiceRequest.belongsTo(SubCategory, { foreignKey: 'subCategoryId', as: 'subCategory' });
ServiceRequest.belongsTo(ProviderProfile, { foreignKey: 'primaryProviderId', as: 'primaryProvider' });

// Provider Profile associations
User.hasOne(ProviderProfile, { foreignKey: 'userId', as: 'providerProfile' });
ProviderProfile.belongsTo(User, { foreignKey: 'userId', as: 'user' });

// Lead associations
User.hasMany(Lead, { foreignKey: 'customerId', as: 'customerLeads' });
User.hasMany(Lead, { foreignKey: 'providerId', as: 'providerLeads' });
Lead.belongsTo(User, { foreignKey: 'customerId', as: 'customer' });
Lead.belongsTo(User, { foreignKey: 'providerId', as: 'provider' });
Lead.belongsTo(Business, { foreignKey: 'businessId', as: 'business' });
Lead.belongsTo(Category, { foreignKey: 'categoryId', as: 'category' });

// Proposal associations
ServiceRequest.hasMany(Proposal, { foreignKey: 'serviceRequestId', as: 'proposals' });
Proposal.belongsTo(ServiceRequest, { foreignKey: 'serviceRequestId', as: 'serviceRequest' });
ProviderProfile.hasMany(Proposal, { foreignKey: 'providerId', as: 'proposals' });
Proposal.belongsTo(ProviderProfile, { foreignKey: 'providerId', as: 'provider' });

// Work Order associations
ServiceRequest.hasMany(WorkOrder, { foreignKey: 'serviceRequestId', as: 'workOrders' });
WorkOrder.belongsTo(ServiceRequest, { foreignKey: 'serviceRequestId', as: 'serviceRequest' });
ProviderProfile.hasMany(WorkOrder, { foreignKey: 'providerId', as: 'workOrders' });
WorkOrder.belongsTo(ProviderProfile, { foreignKey: 'providerId', as: 'provider' });

// Notification associations
User.hasMany(NotificationAudit, { foreignKey: 'userId', as: 'notificationAudits' });
NotificationAudit.belongsTo(User, { foreignKey: 'userId', as: 'user' });
User.hasOne(NotificationPreference, { foreignKey: 'userId', as: 'notificationPreference' });
NotificationPreference.belongsTo(User, { foreignKey: 'userId', as: 'user' });

// Subscription associations
User.hasOne(UserSubscription, { foreignKey: 'userId', as: 'subscription' });
UserSubscription.belongsTo(User, { foreignKey: 'userId', as: 'user' });
UserSubscription.belongsTo(SubscriptionPlan, { foreignKey: 'subscriptionPlanId', as: 'plan' });
SubscriptionPlan.hasMany(UserSubscription, { foreignKey: 'subscriptionPlanId', as: 'subscriptions' });

// Phone Verification associations
User.hasMany(PhoneVerification, { foreignKey: 'userId', as: 'phoneVerifications' });
PhoneVerification.belongsTo(User, { foreignKey: 'userId', as: 'user' });

module.exports = {
  sequelize,
  User,
  Category,
  SubCategory,
  Business,
  Review,
  Blog,
  Contact,
  Activity,
  ReviewRequest,
  ServiceRequest,
  Lead,
  Proposal,
  WorkOrder,
  ProviderProfile,
  NotificationAudit,
  NotificationPreference,
  SubscriptionPlan,
  UserSubscription,
  PhoneVerification
};
