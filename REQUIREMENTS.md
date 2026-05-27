# zomindia - Product Requirements

## Project Overview
A full-stack mobile-responsive web application for on-demand home services including cleaning, repairs, salon, and professional assistance.

## 1. User Stories

### User Registration & Profile
- **As a new user**, I want to register using my phone number and OTP so that I can securely access the platform.
- **As a customer**, I want to save multiple addresses (Home, Office, Other) so that I can quickly select the service location.
- **As a user**, I want to view my booking history and personal profile details to track my usage.

### Service Browsing & Discovery
- **As a user**, I want to browse services by category (e.g., Cleaning, Salon, Repairs) so that I can find what I need intuitively.
- **As a customer**, I want to see detailed descriptions, transparent pricing, and what’s included in a service to avoid surprises.
- **As a user**, I want to search for services directly via a search bar to save time.

### Booking Workflow
- **As a customer**, I want to select a preferred date and time slot from available options so that the service fits my schedule.
- **As a user**, I want to see a final summary of my selection and applied discounts before confirming my booking.
- **As a customer**, I want to receive real-time updates when a professional is assigned and when they arrive.

### Payment Integration
- **As a user**, I want to choose between multiple payment methods (UPI, Cards, Cash) to provide flexibility in how I pay.
- **As a customer**, I want my payment details to be stored securely and to receive an invoice immediately after the service is completed.

### Review & Feedback Submission
- **As a customer**, I want to rate my service experience and the professional using a star system and comments to ensure quality control.
- **As a user**, I want to see photos and reviews from other customers before booking to build trust in the service.

## 2. Feature List

- **User Authentication:** 
  - OTP-based login (Integration with Firebase Auth/Twilio).
  - Profile & Account Management.
- **Service Discovery:**
  - Dynamic Category/Service Listing.
  - Search & Filtering logic.
- **Booking Engine:**
  - Time-slot management.
  - Conflict detection (prevent double-booking).
  - Cart & Checkout flow.
- **Payment Gateway:**
  - Secure checkouts (Razorpay/Stripe integration).
  - Invoicing system.
- **Real-time Notifications:**
  - Status tracking (Requested -> Assigned -> In Progress -> Completed).
  - In-app notifications.
- **Rating & Reviews:**
  - Post-service feedback loop.
  - Review moderation panel (Admin).
- **Admin Dashboard:**
  - User and Partner management.
  - Revenue analytics.
