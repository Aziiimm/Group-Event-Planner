# HuddleUp - Project Scope

## Project Overview

A mobile app to help coordinate events with friends and circles. Users organize friend groups ("circles") and plan events, share availability, upload photos, and split expenses within those circles.

## Core Features

### ✅ 1. Create & Join Circles

**Status:** ✅ **IMPLEMENTED**

- Users can create circles with a name and optional description
- Circle owners can invite other users to join their circles
- Users can search for other users by display name to send invitations
- Users can accept or decline pending invitations
- Circle detail pages show all members and pending invitations
- Role-based permissions (owner, admin, member)

### ⏳ 2. Plan & Join Events

**Status:** ⏳ **NOT STARTED**

**Specifications:**

- Events are **tied to a specific circle** (only circle members can see/join events)
- **Fields:**
  - Title (required)
  - Date & Time (required)
  - Location (required)
  - Description (optional)
  - Host (the user who created the event)
  - RSVP list (people who have confirmed attendance)
- **Status:**
  - `upcoming` (event has been created and is waiting for the event date)
  - `completed` (event date has passed)
- **Access:** Only circle members can view and RSVP to events
- Non-circle members cannot be invited to events

**MVP Functionality:**

- Create event (circle members only)
- View events for a circle
- RSVP to events (going/not going)
- View event details (who's going, location, date/time)
- Mark events as completed (auto or manual)

### ⏳ 3. Share Availability & Heatmap

**Status:** ⏳ **NOT STARTED**

**Specifications:**

- **Time Selection:** Hourly blocks (e.g., 9:00 AM - 10:00 AM, 10:00 AM - 11:00 AM)
- **Date Range:** Monthly view (MVP)
- **Visualization:** Calendar grid heatmap showing overlapping availability
  - Days with the most overlapping availability should be highlighted (lightest or darkest color)
  - Shows which days/times work best for the group
- **Use Case:** Helps circle members find the best time to schedule events

**MVP Functionality:**

- Users can mark their availability for a given month
- Availability is stored as hourly blocks
- Heatmap visualizes group availability for the month
- Used when planning events (suggest optimal times based on availability)

### ⏳ 4. Upload Photos to Shared Album

**Status:** ⏳ **NOT STARTED**

**Specifications:**

- **Scope:** Per circle (MVP - simpler than per-event)
  - Future consideration: Per-event albums (can be added later if needed)
- **File Limits:**
  - Size limit enforced (not too strict, but reasonable)
  - Reasonable upload limits to prevent abuse
- **Permissions:**
  - All circle members can view all photos in the circle album
  - All circle members can upload photos
  - Users can delete only photos they uploaded
- **Features:**
  - View photos in gallery/grid view
  - Upload photos (image picker)
  - Delete own photos
  - No comments/likes (MVP - can add later if needed)

### ⏳ 5. Split Expenses

**Status:** ⏳ **NOT STARTED**

**Specifications:**

- **Linkage:** Expenses are linked to events (each event can have multiple expenses)
- **Split Types:** Custom splits
  - Equal split (e.g., split restaurant bill equally among attendees)
  - Per-person/individual (e.g., each person pays for their own order)
  - Custom percentages/amounts (e.g., user A pays 60%, user B pays 40%)
- **Use Case:** Track who owes what for event-related expenses

**MVP Functionality:**

- Create expense for an event
- Select attendees from event RSVP list
- Choose split type (equal, individual, custom)
- Track individual balances (who owes how much)
- View expense summary for an event

### ⏳ 6. Invite Links (expo-linking)

**Status:** ⏳ **NOT STARTED**

**Future Enhancement:**

- Generate shareable invite links for circles
- Deep linking to accept invitations via app links
- Currently using in-app invitation system

## Tech Stack

### Frontend

**Currently Using:**

- **Framework:** React Native (Expo) + TypeScript
- **Styling:** NativeWind (Tailwind CSS for React Native)
- **Navigation:** expo-router
- **State Management:** React Context API (AuthContext)
- **Data Fetching:** Direct fetch calls with custom API client
- **Storage:** @react-native-async-storage/async-storage
- **Icons:** @expo/vector-icons
- **UI Components:** Custom components with NativeWind

**Planned/Future:**

- **Data Fetching:** TanStack Query (planned for better caching/state management)
- **Form Handling:** react-hook-form + zod (planned for better form validation)
- **Deep Linking:** expo-linking (for invite links - not yet implemented)
- **Maps:** react-native-maps (uncertain - may be needed for event locations)
- **Device Permissions:** Expo SDK (for camera, location, notifications)

### Backend

**Currently Using:**

- **Framework:** NestJS (Node.js + TypeScript)
- **Database + Auth:** Supabase (PostgreSQL + Built-in Auth)
- **Validation:** class-validator + class-transformer (for DTOs)
- **API Architecture:** RESTful API with NestJS controllers/services

**Planned/Future:**

- **Database Migrations:** Supabase Migrations (for schema versioning)
- **Realtime Updates:** Supabase Realtime (for live updates on events, availability, etc.)
- **File Storage:** Supabase Storage (for photo uploads)
- **Image Processing:** Supabase Storage Transformations (or AWS Lambda Sharp for resizing/optimization)
- **Notifications/Reminders:** Redis + BullMQ (for event reminders, notification queuing)
- **Alternative Storage:** AWS S3 + CloudFront (if Supabase Storage doesn't meet needs)

### Hosting

- **Backend:** Render
- **Frontend:** Expo (for mobile apps), Web deployment TBD
- **Database:** Supabase (managed PostgreSQL)

## Data Model Overview

### Implemented Tables

- `users` - User profiles (display_name, first_name, last_name, email)
- `circles` - Circle/groups (name, description, owner_id)
- `circle_members` - Circle membership (user_id, circle_id, role, joined_at)
- `invitations` - Circle invitations (inviter_id, invitee_id, circle_id, status)

### Planned Tables (Not Yet Created)

- `events` - Event information (title, date_time, location, description, circle_id, host_id, status)
- `event_rsvps` - Event RSVPs (event_id, user_id, status: going/not_going)
- `availability` - User availability blocks (user_id, circle_id, date, hour_block, is_available)
- `photos` - Photo metadata (circle_id, uploaded_by, file_path, created_at)
- `expenses` - Expense records (event_id, title, amount, paid_by, split_type, created_at)
- `expense_splits` - Individual expense allocations (expense_id, user_id, amount_owed)

## Feature Dependencies

### Current State

1. ✅ **Authentication** → ✅ **Circles** (complete)
2. ⏳ **Circles** → ⏳ **Events** (events require circles to exist)
3. ⏳ **Events** → ⏳ **Expenses** (expenses are linked to events)
4. ⏳ **Events** → ⏳ **Availability** (availability helps plan events)
5. ⏳ **Circles** → ⏳ **Photos** (photos are per circle)

### Recommended Implementation Order

Based on dependency analysis:

1. **Events** (highest priority - enables other features)

   - Required for: Expenses, Photos (potentially), Availability use cases
   - Depends on: Circles ✅ (already implemented)

2. **Availability/Heatmap** (independent, can be built in parallel)

   - Helps with event planning
   - Can be used even before events exist (general availability)

3. **Photos** (independent of events in MVP)

   - Per-circle albums (simpler)
   - Can be enhanced later with per-event albums

4. **Expenses** (requires Events)

   - Must wait for Events implementation
   - Depends on: Events, Event RSVPs

5. **Invite Links** (enhancement, low priority)
   - Nice-to-have improvement over current invitation system

## MVP Priorities

### Phase 1: Core Event Management (Recommended Starting Point)

- Events CRUD
- Event RSVP system
- Event listing for circles
- Basic event detail views

### Phase 2: Event Planning Tools

- Availability sharing
- Heatmap visualization
- Integration with event creation (suggest best times)

### Phase 3: Social Features

- Circle photo albums
- Event photo uploads (future enhancement)

### Phase 4: Financial Management

- Expense tracking
- Custom split calculations
- Balance tracking per event/user

## Notes

- All features are scoped within circles (users must be circle members)
- MVP focuses on core functionality; advanced features can be added incrementally
- Tech stack items marked as "Planned/Future" are in the roadmap but not yet implemented
- Photo storage decision (per-circle vs per-event) is flexible and can be adjusted based on complexity and cost considerations
