# Multiple Subcategories Implementation

## Overview
This implementation enables businesses to have multiple subcategories from different categories, allowing them to appear in searches across all relevant categories.

## What Changed

### Database Schema
1. **New Junction Table**: `business_subcategories`
   - Links businesses to multiple subcategories
   - Many-to-many relationship
   - Foreign keys with CASCADE delete

2. **Business Model**
   - Kept `categoryId` for primary category (backward compatibility)
   - Kept `subCategoryId` for legacy support (optional)
   - Added many-to-many relationship with SubCategory via `business_subcategories`

### Backend Changes

1. **New Model**: `BusinessSubCategory.js`
   - Junction table model for the many-to-many relationship

2. **Updated Models** (`models/index.js`):
   - Added `belongsToMany` associations between Business and SubCategory
   - Exported `BusinessSubCategory` model

3. **Updated API Routes** (`routes/businesses.js`):
   - `POST /api/businesses`: Accepts `subCategoryIds` array
   - `PUT /api/businesses/:id`: Accepts `subCategoryIds` array
   - `GET /api/businesses`: Includes subcategories in response
   - `GET /api/businesses/:id`: Includes subcategories in response
   - Search now filters by subcategories through the many-to-many relationship

4. **Updated Auth Routes** (`routes/auth.js`):
   - `POST /api/auth/provider-signup`: Accepts `subCategoryIds` array

### Frontend Changes

1. **CategoriesServices.jsx**:
   - Sends `subCategoryIds` array instead of just service names
   - Loads subcategories from `business.subcategories` relationship
   - Falls back to services array for backward compatibility

2. **BusinessInformation.jsx**:
   - Sends `subCategoryIds` array when updating business
   - Loads subcategories from `business.subcategories` relationship
   - Falls back to services array for backward compatibility

## Migration

### Step 1: Run the Migration Script

```bash
cd backend
node scripts/create-business-subcategories-table.js
```

This script will:
- Create the `business_subcategories` junction table
- Migrate existing `subCategoryId` values to the new table
- Attempt to migrate services array to subcategories (where names match)

### Step 2: Verify Migration

Check that the table was created:
```sql
DESCRIBE business_subcategories;
SELECT * FROM business_subcategories LIMIT 10;
```

## API Usage

### Creating a Business with Multiple Subcategories

```javascript
POST /api/businesses
{
  "name": "My Business",
  "categoryId": 5,
  "subCategoryIds": [12, 45, 78, 92],  // Multiple subcategories from different categories
  "address": "123 Main St",
  "city": "New York",
  "state": "NY",
  "zipCode": "10001",
  "phone": "555-1234",
  // ... other fields
}
```

### Updating Business Subcategories

```javascript
PUT /api/businesses/:id
{
  "subCategoryIds": [12, 45, 78, 92]  // Replace all existing subcategories
}
```

### Response Format

Business responses now include subcategories:

```json
{
  "success": true,
  "business": {
    "id": 123,
    "name": "My Business",
    "categoryId": 5,
    "category": { "id": 5, "name": "Home Services" },
    "subcategories": [
      { "id": 12, "name": "Electrical", "categoryId": 5 },
      { "id": 45, "name": "General Vehicle Inspection", "categoryId": 3 },
      { "id": 78, "name": "Casual dining restaurants", "categoryId": 7 },
      { "id": 92, "name": "Fitness centers & gyms", "categoryId": 8 }
    ],
    // ... other fields
  }
}
```

## Search Behavior

Businesses now appear in search results when:
1. Their primary `categoryId` matches the search category, OR
2. Any of their subcategories match the search subcategory, OR
3. Any of their subcategories belong to the search category

This means a business with subcategories from multiple categories will appear in searches for all those categories.

## Backward Compatibility

- The `subCategoryId` field is still supported (for legacy single subcategory)
- The `services` array is still maintained (for backward compatibility)
- Existing businesses without subcategories in the junction table will still work
- Frontend falls back to services array if subcategories relationship is not available

## Example Use Case

A business can now have:
- "General Vehicle Inspection" (Auto category)
- "Electrical" (Home Services category)
- "Casual dining restaurants" (Food category)
- "Fitness centers & gyms" (Health category)

This business will appear in searches for:
- Auto category
- Home Services category
- Food category
- Health category

## Notes

- The primary `categoryId` is still required and is typically set from the first subcategory's category
- Subcategories must be active (`isActive: true`) to be assigned
- The migration script attempts to match existing services by name to subcategories
- All subcategory relationships are stored in the `business_subcategories` junction table

