import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import Header from './components/Header';
import Footer from './components/Footer';
import AdminLayout from './components/AdminLayout';
import UserDashboardLayout from './components/UserDashboardLayout';
import ProtectedRoute from './components/ProtectedRoute';
import Home from './pages/Home';
import Businesses from './pages/Businesses';
import BusinessDetail from './pages/BusinessDetail';
import BusinessProfile from './pages/BusinessProfile';
import CategoryBusinesses from './pages/CategoryBusinesses';
import AllCategories from './pages/AllCategories';
import AllProfiles from './pages/AllProfiles';
import Blog from './pages/Blog';
import BlogDetail from './pages/BlogDetail';
import SearchResults from './pages/SearchResults';
import Login from './pages/Login';
import Register from './pages/Register';
import AddBusiness from './pages/AddBusiness';
import WriteReview from './pages/WriteReview';
import Support from './pages/Support';
import VerifyEmail from './pages/VerifyEmail';
import AdminDashboard from './pages/admin/AdminDashboard';
import AdminBusinesses from './pages/admin/AdminBusinesses';
import AdminUsers from './pages/admin/AdminUsers';
import AdminReviews from './pages/admin/AdminReviews';
import AdminCategories from './pages/admin/AdminCategories';
import AdminBlogs from './pages/admin/AdminBlogs';
import AdminContacts from './pages/admin/AdminContacts';
import AdminActivities from './pages/admin/AdminActivities';
import AdminBusinessProfiles from './pages/admin/AdminBusinessProfiles';
import AdminServiceRequests from './pages/admin/AdminServiceRequests';
import AdminLeads from './pages/admin/AdminLeads';
import AdminProposals from './pages/admin/AdminProposals';
import AdminWorkOrders from './pages/admin/AdminWorkOrders';
import AdminProviders from './pages/admin/AdminProviders';
import AdminLogin from './pages/admin/AdminLogin';
import MyBusiness from './pages/MyBusiness';
import BusinessInformation from './pages/BusinessInformation';
import CategoriesServices from './pages/CategoriesServices';
import PhotosVideos from './pages/PhotosVideos';
import BusinessLocation from './pages/BusinessLocation';
import DealsPromotions from './pages/DealsPromotions';
import VerifyBusiness from './pages/VerifyBusiness';
import DashboardReviews from './pages/DashboardReviews';
import AccountSettings from './pages/AccountSettings';
import MyRequests from './pages/MyRequests';
import ServiceRequest from './pages/ServiceRequest';
import ProviderLeads from './pages/ProviderLeads';
import ProviderWorkOrders from './pages/ProviderWorkOrders';
import ProviderPayouts from './pages/ProviderPayouts';
import Subscriptions from './pages/Subscriptions';
import './App.css';

function App() {
  return (
    <AuthProvider>
      <Routes>
        {/* Admin Login - Public route (separate from main site) */}
        <Route path="/admin/login" element={<AdminLogin />} />

        {/* Admin Dashboard Routes - Protected (ONLY ADMIN) */}
        <Route
          path="/admin/*"
          element={
            <ProtectedRoute requiredRole="admin">
              <AdminLayout>
                <Routes>
                  <Route index element={<AdminDashboard />} />
                  <Route path="dashboard" element={<Navigate to="/admin" replace />} />
                  <Route path="businesses" element={<AdminBusinesses />} />
                  <Route path="users" element={<AdminUsers />} />
                  <Route path="reviews" element={<AdminReviews />} />
                  <Route path="categories" element={<AdminCategories />} />
                  <Route path="service-requests" element={<AdminServiceRequests />} />
                  <Route path="leads" element={<AdminLeads />} />
                  <Route path="proposals" element={<AdminProposals />} />
                  <Route path="work-orders" element={<AdminWorkOrders />} />
                  <Route path="providers" element={<AdminProviders />} />
                  <Route path="blogs" element={<AdminBlogs />} />
                  <Route path="contacts" element={<AdminContacts />} />
                  <Route path="activities" element={<AdminActivities />} />
                  <Route path="business-profiles" element={<AdminBusinessProfiles />} />
                  <Route path="login" element={<Navigate to="/admin" replace />} />
                </Routes>
              </AdminLayout>
            </ProtectedRoute>
          }
        />

        {/* User Dashboard Routes */}
        <Route
          path="/user-dashboard/*"
          element={
            <ProtectedRoute>
              <UserDashboardLayout>
                <Routes>
                  <Route index element={<Navigate to="/user-dashboard/my-business" replace />} />
                  <Route path="my-business" element={<MyBusiness />} />
                  <Route path="business-information" element={<BusinessInformation />} />
                  <Route path="business-information/:businessId" element={<BusinessInformation />} />
                  <Route path="categories-services" element={<CategoriesServices />} />
                  <Route path="photos-videos" element={<PhotosVideos />} />
                  <Route path="business-location" element={<BusinessLocation />} />
                  <Route path="deals-promotions" element={<DealsPromotions />} />
                  <Route path="verify-business" element={<VerifyBusiness />} />
                  <Route path="reviews" element={<DashboardReviews />} />
                  <Route path="account-settings" element={<AccountSettings />} />
                  <Route path="requests" element={<MyRequests />} />
                  <Route path="leads" element={<ProviderLeads />} />
                  <Route path="work-orders" element={<ProviderWorkOrders />} />
                  <Route path="payouts" element={<ProviderPayouts />} />
                  <Route path="subscriptions" element={<Subscriptions />} />
                </Routes>
              </UserDashboardLayout>
            </ProtectedRoute>
          }
        />

        {/* Public User Routes */}
        <Route path="/*" element={
          <div className="App">
            <Header />
            <main className="main-content">
              <Routes>
                <Route path="/" element={<Home />} />
                <Route path="/businesses" element={<Businesses />} />
                <Route path="/businesses/:id" element={<BusinessDetail />} />
                <Route path="/profile/:userId" element={<BusinessProfile />} />
                <Route path="/profiles" element={<AllProfiles />} />
                <Route path="/category/:slug" element={<CategoryBusinesses />} />
                <Route path="/categories" element={<AllCategories />} />
                <Route path="/blog" element={<Blog />} />
                <Route path="/blog/:slug" element={<BlogDetail />} />
                <Route path="/search" element={<SearchResults />} />
                <Route path="/login" element={<Login />} />
                <Route path="/register" element={<Register />} />
                <Route path="/add-business" element={<AddBusiness />} />
                <Route path="/write-review" element={<WriteReview />} />
                <Route path="/support" element={<Support />} />
                <Route path="/verify-email" element={<VerifyEmail />} />
                <Route path="/service-request" element={<ServiceRequest />} />
                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </main>
            <Footer />
          </div>
        } />
      </Routes>
    </AuthProvider>
  );
}

export default App;

