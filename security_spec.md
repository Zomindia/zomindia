# UrbanServe Security Specification

## Data Invariants
- A Booking cannot exist without a valid Customer ID (request.auth.uid).
- A Partner must be verified by an Admin before they can be booked.
- A Review can only be created by the Customer who booked the service, and only if the status is 'completed'.
- Users cannot change their own roles (e.g., a customer cannot become an admin).
- Categories and Services are read-only for non-admins.

## The Dirty Dozen Payloads (Red Team Test Cases)
1. **Role Escalation**: Update `role` field in own `users/{uid}` document to 'admin'.
2. **Identity Spoofing**: Create a booking with a `customerId` that doesn't match `request.auth.uid`.
3. **Price Manipulation**: Create a booking with a `totalPrice` of 0.
4. **Partner Hijack**: Update another partner's document.
5. **Review Faking**: Create a review for a booking that the user didn't make.
6. **Orphaned Booking**: Create a booking for a `serviceId` that doesn't exist.
7. **Junk ID Poisoning**: Attempt to create a document with a 2KB string ID.
8. **Shadow Field Injection**: Add `isVerified: true` to a user profile update.
9. **Status Shortcutting**: Directly update a booking status from 'pending' to 'completed'.
10. **Admin Data Access**: List all private user documents as a regular customer.
11. **Negative Rating**: Submit a review with a rating of -5.
12. **Future Booking**: Create a booking with a `scheduledAt` timestamp in the past.

## Test Runner (firestore.rules.test.ts)
(To be implemented in the next step)
