# CityLocal 101 - MERN Stack Business Directory

A complete, production-ready business directory application built with the MERN stack (MySQL instead of MongoDB) featuring modern UI/UX, comprehensive business listings, reviews, categories, admin panel, and advanced search functionality.

## 🚀 Features

### For Users
- **Browse Businesses**: Explore businesses by category with advanced filtering
- **Search Functionality**: Real-time search suggestions for businesses and locations
- **Category Pages**: Dedicated pages for each category with filter sidebar
- **Business Details**: View complete business information, reviews, and ratings
- **Review System**: Write and manage reviews with star ratings
- **User Authentication**: Secure registration and login with JWT
- **Blog Reading**: Read blog posts with full content display
- **Responsive Design**: Works perfectly on desktop, tablet, and mobile

### For Business Owners
- **Add Business**: Submit business listings for approval
- **Manage Listings**: Update business information
- **View Reviews**: See and respond to customer reviews

### For Administrators
- **Admin Dashboard**: Complete admin panel with statistics
- **Business Management**: Approve/reject business listings
- **User Management**: Manage all users and their roles
- **Category Management**: Create and manage business categories
- **Review Management**: Moderate reviews
- **Blog Management**: Create and publish blog posts
- **Contact Management**: Handle customer inquiries
- **Activity Logs**: Track all system activities

## 🛠️ Tech Stack

### Backend
- **Node.js** + **Express.js** - RESTful API server
- **MySQL** - Relational database
- **Sequelize** - ORM for database operations
- **JWT** - Token-based authentication
- **bcryptjs** - Password hashing
- **Express Validator** - Input validation
- **CORS** - Cross-origin resource sharing

### Frontend
- **React 18** - Modern UI library
- **React Router v6** - Client-side routing
- **Axios** - HTTP client for API calls
- **Vite** - Fast build tool and dev server
- **Font Awesome** - Icon library
- **CSS3** - Modern styling with responsive design

## 📋 Prerequisites

- **Node.js** (v16 or higher)
- **MySQL** (v8.0 or higher)
- **npm** or **yarn**

## 🔧 Installation

### 1. Clone the Repository

```bash
git clone <repository-url>
cd Clone
```

### 2. Backend Setup

```bash
cd backend
npm install
```

Create a `.env` file in the `backend` directory:

```env
NODE_ENV=development
PORT=5000

# Database Configuration
DB_HOST=localhost
DB_PORT=3306
DB_NAME=citylocal101
DB_USER=root
DB_PASSWORD=your_mysql_password

# JWT Configuration
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production
JWT_EXPIRE=7d

# CORS Configuration
CORS_ORIGIN=http://localhost:3000
FRONTEND_URL=http://localhost:3000

# Database Sync
SYNC_DB=true
```

### 3. Database Setup

Create the MySQL database:

```sql
CREATE DATABASE citylocal101;
```

Or use MySQL command line:

```bash
mysql -u root -p
CREATE DATABASE citylocal101;
exit;
```

### 4. Seed Database (Optional but Recommended)

This will populate the database with sample data:

```bash
cd backend
npm run seed
```

This creates:
- Admin user (email: `admin@citylocal101.com`, password: `admin123`)
- 8 sample categories
- 20+ sample businesses across all categories
- Sample blog posts

### 5. Frontend Setup

```bash
cd frontend
npm install
```

Create a `.env` file in the `frontend` directory (optional):

```env
VITE_API_URL=http://localhost:5000/api
```

## 🚀 Running the Application

### Development Mode

**Terminal 1 - Backend Server:**
```bash
cd backend
npm run dev
```

**Terminal 2 - Frontend Development Server:**
```bash
cd frontend
npm run dev
```

Access the application:
- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:5000
- **API Endpoints**: http://localhost:5000/api

### Production Build

**Step 1: Build Frontend**
```bash
cd frontend
npm run build
```

**Step 2: Start Backend (serves frontend)**
```bash
cd backend
npm start
```

The backend will serve the built frontend from `frontend/dist`. Access at: http://localhost:5000

## 📁 Project Structure

```
├── backend/
│   ├── config/
│   │   └── database.js          # Database configuration
│   ├── models/                   # Sequelize models
│   │   ├── User.js
│   │   ├── Business.js
│   │   ├── Category.js
│   │   ├── Review.js
│   │   ├── Blog.js
│   │   ├── Contact.js
│   │   ├── Activity.js
│   │   └── index.js
│   ├── routes/                   # API routes
│   │   ├── auth.js              # Authentication routes
│   │   ├── businesses.js        # Business CRUD
│   │   ├── categories.js       # Category management
│   │   ├── reviews.js          # Review management
│   │   ├── blogs.js            # Blog management
│   │   ├── search.js           # Search functionality
│   │   ├── contact.js          # Contact form
│   │   └── admin.js            # Admin routes
│   ├── middleware/
│   │   └── auth.js             # Authentication middleware
│   ├── utils/
│   │   ├── generateToken.js    # JWT token generation
│   │   ├── logActivity.js      # Activity logging
│   │   └── sendEmail.js        # Email utilities
│   ├── scripts/
│   │   ├── seed.js             # Database seeding
│   │   └── validate-env.js    # Environment validation
│   └── server.js               # Express server entry point
│
├── frontend/
│   ├── public/
│   │   └── assets/
│   │       └── images/
│   │           └── logo.png
│   ├── src/
│   │   ├── components/         # Reusable components
│   │   │   ├── Header.jsx
│   │   │   ├── Footer.jsx
│   │   │   ├── AdminLayout.jsx
│   │   │   └── ProtectedRoute.jsx
│   │   ├── pages/              # Page components
│   │   │   ├── Home.jsx
│   │   │   ├── Businesses.jsx
│   │   │   ├── BusinessDetail.jsx
│   │   │   ├── CategoryBusinesses.jsx
│   │   │   ├── Blog.jsx
│   │   │   ├── BlogDetail.jsx
│   │   │   ├── SearchResults.jsx
│   │   │   ├── Login.jsx
│   │   │   ├── Register.jsx
│   │   │   ├── AddBusiness.jsx
│   │   │   ├── WriteReview.jsx
│   │   │   ├── Support.jsx
│   │   │   └── admin/          # Admin pages
│   │   │       ├── AdminDashboard.jsx
│   │   │       ├── AdminBusinesses.jsx
│   │   │       ├── AdminUsers.jsx
│   │   │       ├── AdminReviews.jsx
│   │   │       ├── AdminCategories.jsx
│   │   │       ├── AdminBlogs.jsx
│   │   │       ├── AdminContacts.jsx
│   │   │       └── AdminActivities.jsx
│   │   ├── context/
│   │   │   └── AuthContext.jsx # Authentication context
│   │   ├── services/
│   │   │   └── api.js          # API service layer
│   │   ├── App.jsx             # Main app component
│   │   ├── main.jsx            # Entry point
│   │   └── index.css           # Global styles
│   └── vite.config.js          # Vite configuration
│
└── README.md
```

## 🔐 Default Admin Credentials

After running the seed script:
- **Email**: `admin@citylocal101.com`
- **Password**: `admin123`

⚠️ **Important**: Change the admin password immediately in production!

## 📝 API Endpoints

### Authentication
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login user
- `GET /api/auth/me` - Get current user profile
- `PUT /api/auth/updateprofile` - Update user profile
- `PUT /api/auth/changepassword` - Change password
- `POST /api/auth/logout` - Logout user

### Businesses
- `GET /api/businesses` - Get all businesses (with filters: category, city, state, rating, featured, search)
- `GET /api/businesses/:id` - Get single business details
- `POST /api/businesses` - Create business (Protected)
- `PUT /api/businesses/:id` - Update business (Protected - Owner/Admin)
- `DELETE /api/businesses/:id` - Delete business (Protected - Owner/Admin)

### Categories
- `GET /api/categories` - Get all categories
- `GET /api/categories/:id` - Get single category
- `POST /api/categories` - Create category (Admin only)
- `PUT /api/categories/:id` - Update category (Admin only)
- `DELETE /api/categories/:id` - Delete category (Admin only)

### Reviews
- `GET /api/reviews` - Get reviews (with filters)
- `GET /api/reviews/:id` - Get single review
- `POST /api/reviews` - Create review (Protected)
- `PUT /api/reviews/:id` - Update review (Protected)
- `DELETE /api/reviews/:id` - Delete review (Protected)

### Blogs
- `GET /api/blogs` - Get all published blogs
- `GET /api/blogs/:slug` - Get blog by slug
- `POST /api/blogs` - Create blog (Admin only)
- `PUT /api/blogs/:id` - Update blog (Admin only)
- `DELETE /api/blogs/:id` - Delete blog (Admin only)

### Search
- `GET /api/search` - Search businesses
- `GET /api/search/suggestions` - Get search suggestions

### Contact
- `POST /api/contact` - Submit contact form

### Admin
- `GET /api/admin/stats` - Get dashboard statistics (Admin)
- `GET /api/admin/users` - Get all users (Admin)
- `GET /api/admin/businesses` - Get all businesses (Admin)
- `PUT /api/admin/businesses/:id/approve` - Approve business (Admin)
- `PUT /api/admin/reviews/:id/approve` - Approve review (Admin)

## 🎨 Key Features Explained

### Category Pages with Filters
- Click any category from the home page
- View all businesses in that category
- **Filter Sidebar** includes:
  - Search by business name/description
  - Category selector (switch categories)
  - City filter
  - State filter
  - Minimum rating filter
  - Featured businesses only
  - Clear all filters button

### Search Suggestions
- **Business Search**: Type 2+ characters to see business suggestions
- **Location Search**: Type 2+ characters to see location suggestions
- Click suggestions to navigate directly
- Real-time dropdown with icons

### Admin Panel
- Access at `/admin` (requires admin login)
- Dashboard with statistics
- Manage businesses, users, reviews, categories, blogs
- View activity logs and contact submissions

## 🔒 Security Features

- **JWT Authentication**: Secure token-based authentication
- **Password Hashing**: bcrypt with salt rounds
- **Input Validation**: Express Validator for all inputs
- **SQL Injection Protection**: Sequelize ORM parameterized queries
- **CORS Configuration**: Controlled cross-origin requests
- **Environment Variables**: Sensitive data in `.env` files
- **Protected Routes**: Middleware for authentication and authorization

## 📱 Responsive Design

The application is fully responsive and optimized for:
- **Desktop** (1920px+): Full layout with sidebar filters
- **Tablet** (768px - 1024px): Adjusted layouts
- **Mobile** (480px - 768px): Stacked layouts, mobile menu
- **Small Mobile** (< 480px): Optimized for small screens

## 🚀 Deployment

### Backend Deployment

1. Set environment variables:
   ```env
   NODE_ENV=production
   DB_HOST=your_production_db_host
   DB_NAME=your_production_db_name
   DB_USER=your_production_db_user
   DB_PASSWORD=your_production_db_password
   JWT_SECRET=your_strong_secret_key
   CORS_ORIGIN=https://yourdomain.com
   FRONTEND_URL=https://yourdomain.com
   ```

2. Build and start:
   ```bash
   npm start
   ```

### Frontend Deployment

1. Build the frontend:
   ```bash
   cd frontend
   npm run build
   ```

2. The `dist` folder contains the production build
3. Serve with backend or static file server (Nginx, Apache, etc.)

### Recommended Hosting

- **Backend**: Heroku, Railway, DigitalOcean, AWS EC2
- **Database**: AWS RDS, DigitalOcean Managed Database, PlanetScale
- **Frontend**: Vercel, Netlify, or serve with backend

## 🧪 Testing

### Test Business Submission
1. Register a new account
2. Click "Add Business" in header
3. Fill out the form
4. Submit for approval
5. Admin can approve in admin panel

### Test Category Filtering
1. Click any category on home page
2. Use filter sidebar to refine results
3. Try search, location, and rating filters

### Test Search Suggestions
1. Go to home page
2. Type in business search box
3. See suggestions appear
4. Click a suggestion to navigate

## 🤝 Contributing

Contributions are welcome! Please follow these steps:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🆘 Support

For support:
- Open an issue on GitHub
- Email: support@citylocal101.com
- Use the support form in the application

## 🎯 Future Enhancements

- [ ] Image upload for businesses and reviews
- [ ] Advanced analytics dashboard
- [ ] Email notifications
- [ ] Social media integration
- [ ] Payment integration
- [ ] Multi-language support
- [ ] Mobile app (React Native)
- [ ] Real-time chat support
- [ ] Business analytics for owners
- [ ] Advanced reporting features

## 🙏 Acknowledgments

- Built with React, Express, MySQL, and Sequelize
- Icons by Font Awesome
- UI/UX inspired by modern web applications

---

**Built with ❤️ using the MERN Stack (MySQL variant)**

For questions or issues, please open an issue on GitHub.
