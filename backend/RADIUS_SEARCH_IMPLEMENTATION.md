# 20-Mile Radius Search Implementation

## Overview
The business search functionality has been updated to search for businesses within a 20-mile radius of the entered zip code, instead of requiring an exact zip code match.

## Implementation Details

### 1. Geolocation Utility (`backend/utils/geolocation.js`)
Created a utility module with the following functions:

- **`getCoordinatesFromZipCode(zipCode)`**: Converts a zip code to latitude/longitude coordinates
  - Uses OpenStreetMap Nominatim API (free, no API key required)
  - Falls back to Google Geocoding API if `GOOGLE_GEOCODING_API_KEY` is set in `.env`
  - Returns `{lat, lng}` or `null` if geocoding fails

- **`calculateDistance(lat1, lng1, lat2, lng2)`**: Calculates distance between two coordinates
  - Uses Haversine formula for accurate distance calculation
  - Returns distance in miles

- **`getBoundingBox(lat, lng, radiusMiles)`**: Creates a bounding box for efficient database queries
  - Returns `{minLat, maxLat, minLng, maxLng}` for pre-filtering
  - Reduces database load by filtering before exact distance calculation

### 2. Backend Route Updates (`backend/routes/businesses.js`)

#### Zip Code Filtering Logic:
1. **Geocoding**: When a zip code is provided, it's converted to coordinates
2. **Bounding Box Filter**: Uses bounding box to pre-filter businesses in the database
3. **Exact Distance Calculation**: Calculates exact distance for each business
4. **Radius Filtering**: Only includes businesses within 20 miles (or custom radius)
5. **Distance Sorting**: Results are sorted by distance (closest first)
6. **Distance Field**: Each business result includes a `distance` field (in miles)

#### Fallback Behavior:
- If geocoding fails, falls back to exact zip code matching
- If business has no coordinates, it's excluded from radius search results

#### Query Parameters:
- `zipCode`: The zip code to search around
- `radius`: Optional custom radius in miles (default: 20)

### 3. Frontend Updates (`frontend/src/pages/ServiceRequest.jsx`)

- Removed exact zip code matching from client-side filtering
- Backend now handles all zip code/radius filtering
- Client-side filtering now only checks:
  - Category match
  - Service match (if subcategory selected)

## How It Works

### Step-by-Step Flow:

1. **User enters zip code** (e.g., "10001")
2. **Frontend sends request**: `GET /api/businesses?zipCode=10001&category=5`
3. **Backend geocodes zip code**: Converts "10001" to coordinates (e.g., lat: 40.7505, lng: -73.9973)
4. **Backend creates bounding box**: Calculates approximate search area (±20 miles)
5. **Database query**: Filters businesses within bounding box that have coordinates
6. **Distance calculation**: Calculates exact distance for each business
7. **Radius filtering**: Keeps only businesses within 20 miles
8. **Sorting**: Sorts by distance (closest first)
9. **Pagination**: Applies pagination after filtering
10. **Response**: Returns businesses with `distance` field included

### Example Response:
```json
{
  "success": true,
  "count": 15,
  "total": 15,
  "page": 1,
  "pages": 1,
  "businesses": [
    {
      "id": 1,
      "name": "ABC Plumbing",
      "distance": 2.5,  // 2.5 miles away
      "latitude": 40.7520,
      "longitude": -73.9950,
      ...
    },
    {
      "id": 2,
      "name": "XYZ Plumbing",
      "distance": 8.3,  // 8.3 miles away
      ...
    }
  ]
}
```

## Requirements

### Database:
- Businesses must have `latitude` and `longitude` fields populated
- These fields are already in the Business model schema

### Dependencies:
- `axios`: For making HTTP requests to geocoding APIs
- Already added to `package.json`

### Environment Variables (Optional):
- `GOOGLE_GEOCODING_API_KEY`: For using Google Geocoding API as fallback
  - If not set, uses OpenStreetMap Nominatim (free, but has rate limits)

## Performance Considerations

1. **Bounding Box Pre-filtering**: Reduces database load by filtering before exact distance calculation
2. **Batch Processing**: Fetches up to 200 businesses initially, then filters and paginates
3. **Caching**: Consider caching zip code coordinates to reduce API calls
4. **Database Indexes**: Ensure indexes on `latitude` and `longitude` columns for faster queries

## Error Handling

- **Geocoding Failure**: Falls back to exact zip code matching
- **Invalid Coordinates**: Businesses without valid coordinates are excluded
- **API Timeout**: 5-second timeout on geocoding requests
- **Network Errors**: Logged and handled gracefully

## Testing

To test the implementation:

1. Enter a zip code in the service request form
2. Check that businesses within 20 miles are returned
3. Verify that results include a `distance` field
4. Verify that results are sorted by distance (closest first)
5. Test with a zip code that has no nearby businesses
6. Test with invalid zip codes (should fall back to exact match)

## Future Enhancements

- Cache zip code coordinates in database
- Add database indexes on latitude/longitude
- Allow users to adjust search radius
- Show distance in UI
- Add map visualization of results

