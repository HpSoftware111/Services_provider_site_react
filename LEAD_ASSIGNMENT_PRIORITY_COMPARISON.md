# Lead Assignment Priority - Current vs Required Logic

## Client Requirement
**Featured providers and Pro package service providers should get leads FIRST. After that, the rest gets them.**

## Current Implementation (Before Update)
### How it worked:
1. **Scoring System**: Each provider gets a score based on:
   - Business rating (max 50 points)
   - Review count (max 20 points)
   - Category match (+10 points)
   - Subcategory match (+10 points)
   - Zip code match (+5 points)
   - Selected business bonus (+20 points)
   - Subscription priority boost points (if active subscription)

2. **Sorting**: All providers sorted by total score (descending)
   - Highest score = Primary provider
   - Next 3 highest = Alternative providers

3. **Issue**: Featured/Pro providers were only getting priority boost points added to their score, but they could still be outranked by non-priority providers with higher overall scores.

## New Implementation (After Update)
### How it works now:
1. **Priority Detection**: 
   - Checks if provider has `isFeatured = true` OR `tier = 'PRO'`
   - Flags these providers as `isPriorityProvider = true`

2. **Two-Tier Sorting**:
   - **First Priority Group**: Featured providers OR Pro tier subscribers
   - **Second Priority Group**: All other providers
   - Within each group, sorted by score (descending)

3. **Result**: 
   - Featured/Pro providers **always** get leads first (regardless of score)
   - After all Featured/Pro providers are assigned, remaining providers get leads
   - Within each priority group, highest scores win

## Example Scenario

### Before Update:
- Provider A (Basic plan, score: 100) → Gets lead
- Provider B (Pro plan, score: 85) → Alternative
- Provider C (Featured, score: 80) → Alternative

### After Update:
- Provider B (Pro plan, score: 85) → Gets lead FIRST (priority)
- Provider C (Featured, score: 80) → Alternative (priority)
- Provider A (Basic plan, score: 100) → Alternative (non-priority, but highest score in non-priority group)

## Code Changes

### File: `backend/routes/service-requests.js`

1. **Added Priority Flag**:
   ```javascript
   let isPriorityProvider = false;
   isPriorityProvider = subscriptionBenefits.isFeatured === true || subscriptionBenefits.tier === 'PRO';
   ```

2. **Updated Sorting Logic**:
   ```javascript
   .sort((a, b) => {
       // Priority providers first
       if (a.isPriorityProvider && !b.isPriorityProvider) return -1;
       if (!a.isPriorityProvider && b.isPriorityProvider) return 1;
       // Then by score
       return b.score - a.score;
   });
   ```

3. **Enhanced Logging**:
   - Logs when priority providers are detected
   - Shows priority status in selection logs

## Benefits

✅ **Meets Client Requirement**: Featured/Pro providers get leads FIRST
✅ **Fair System**: Within priority groups, highest scores still win
✅ **Backward Compatible**: Non-priority providers still get leads, just after priority ones
✅ **Transparent**: Logging shows priority status for debugging

## Testing Recommendations

1. Create service request with:
   - 1 Featured provider (score: 50)
   - 1 Pro tier provider (score: 60)
   - 1 Basic provider (score: 100)

2. Expected Result:
   - Primary: Pro tier provider (priority, score: 60)
   - Alternative 1: Featured provider (priority, score: 50)
   - Alternative 2: Basic provider (non-priority, score: 100)
