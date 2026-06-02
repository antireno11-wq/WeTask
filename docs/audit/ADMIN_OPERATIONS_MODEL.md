# WeTask — Admin Operations Model

The Admin Panel is the central nervous system of a controlled marketplace. If it fails to provide the right tools, operations will drown in support tickets.

## Required Dashboards & Capabilities

### 1. Provider KYC & Approval Queue
- **State**: Needs a kanban-style view: `Pending Review` -> `Requires Correction` -> `Approved`.
- **Tools Needed**: 
  - Image viewer for IDs and Selfies.
  - "Reject with Reason" modal that triggers an automated email to the provider ("Your ID was blurry, please upload again").
  - One-click profile generation from the onboarding data.

### 2. Booking God Mode
- **State**: Admins must see a timeline of all active, upcoming, and disputed bookings.
- **Tools Needed**:
  - **Force Cancel**: Immediately cancels the booking, frees the slot, and triggers MercadoPago refund API.
  - **Reassign**: Move a booking from Provider A to Provider B if Provider A cancels last minute. (Must handle pricing diffs).

### 3. Financial Reconciliation (Payouts)
- **State**: List of `COMPLETED` bookings awaiting payout.
- **Tools Needed**:
  - Export CSV formatted exactly for BancoEstado/Santander bulk transfers.
  - "Mark Batch as Paid" which updates all selected `Payout` records to `PAID` and emails the providers.

### 4. Dispute Resolution Center
- **State**: Split-screen view. Left side: Customer complaint & photos. Right side: Provider response. Center: Chat history.
- **Tools Needed**:
  - **Full Refund**: Money to customer, Provider gets $0.
  - **Partial Refund**: Split the difference.
  - **Deny Refund**: Provider gets full payout.
  - Buttons must automatically interact with the MercadoPago Refund API so Admins don't have to log into the MercadoPago dashboard separately.
