-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('CUSTOMER', 'PRO', 'ADMIN');

-- CreateEnum
CREATE TYPE "AuthProvider" AS ENUM ('EMAIL', 'GOOGLE', 'APPLE');

-- CreateEnum
CREATE TYPE "CleaningOnboardingStatus" AS ENUM ('BORRADOR', 'PENDIENTE_REVISION', 'REQUIERE_CORRECCION', 'APROBADO', 'ACTIVO');

-- CreateEnum
CREATE TYPE "CleaningWorkMode" AS ENUM ('SOLO', 'EQUIPO');

-- CreateEnum
CREATE TYPE "CleaningAvailabilityMode" AS ENUM ('FIJA', 'VARIABLE');

-- CreateEnum
CREATE TYPE "BookingStatus" AS ENUM ('CREATED', 'PENDING', 'PENDING_PAYMENT', 'PAYMENT_FAILED', 'CONFIRMED', 'ASSIGNED', 'ACCEPTED', 'IN_PROGRESS', 'COMPLETED', 'AWAITING_CUSTOMER_CONFIRMATION', 'PAYOUT_SCHEDULED', 'PAID_OUT', 'CANCELLED', 'DISPUTE', 'DISPUTE_OPEN', 'REFUNDED');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('PENDING', 'AUTHORIZED', 'PAID', 'FAILED', 'REFUNDED', 'PARTIAL_REFUNDED');

-- CreateEnum
CREATE TYPE "PayoutStatus" AS ENUM ('PENDING', 'PROCESSING', 'PAID', 'FAILED');

-- CreateEnum
CREATE TYPE "TicketStatus" AS ENUM ('OPEN', 'IN_REVIEW', 'RESOLVED', 'CLOSED');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "phone" TEXT,
    "birthDate" TIMESTAMP(3),
    "mercadoPagoCustomerId" TEXT,
    "mpAccessToken" TEXT,
    "mpRefreshToken" TEXT,
    "mpUserId" TEXT,
    "mpTokenExpiresAt" TIMESTAMP(3),
    "mpAccountStatus" TEXT,
    "mpConnectedAt" TIMESTAMP(3),
    "role" "UserRole" NOT NULL DEFAULT 'CUSTOMER',
    "authProvider" "AuthProvider" NOT NULL DEFAULT 'EMAIL',
    "passwordHash" TEXT,
    "termsAcceptedAt" TIMESTAMP(3),
    "termsVersionId" TEXT,
    "emailVerifiedAt" TIMESTAMP(3),
    "deletedAt" TIMESTAMP(3),
    "scheduledDeletionAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CustomerPaymentMethod" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "provider" TEXT NOT NULL DEFAULT 'MERCADOPAGO',
    "providerCustomerId" TEXT NOT NULL,
    "providerCardId" TEXT NOT NULL,
    "paymentMethodId" TEXT,
    "brand" TEXT,
    "last4" TEXT NOT NULL,
    "expirationMonth" INTEGER,
    "expirationYear" INTEGER,
    "cardholderName" TEXT,
    "payerEmail" TEXT,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CustomerPaymentMethod_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Role" (
    "id" TEXT NOT NULL,
    "code" "UserRole" NOT NULL,
    "label" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Role_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserRoleAssignment" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "roleId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserRoleAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmailVerificationToken" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EmailVerificationToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PasswordResetToken" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PasswordResetToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuthSession" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuthSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Category" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "minHours" INTEGER NOT NULL DEFAULT 1,
    "slotMinutes" INTEGER NOT NULL DEFAULT 60,
    "basePlatformFeePct" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "urgencyFeeClp" INTEGER NOT NULL DEFAULT 0,
    "materialFeeDefaultClp" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Category_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Service" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "basePriceClp" INTEGER NOT NULL,
    "durationMin" INTEGER NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "categoryId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Service_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProfessionalProfile" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "avatarUrl" TEXT,
    "avatarPositionX" INTEGER NOT NULL DEFAULT 50,
    "avatarPositionY" INTEGER NOT NULL DEFAULT 34,
    "bio" TEXT,
    "isVerified" BOOLEAN NOT NULL DEFAULT false,
    "verificationStatus" TEXT NOT NULL DEFAULT 'PENDING_REVIEW',
    "idDocumentType" TEXT,
    "idDocumentNumber" TEXT,
    "idDocumentUrl" TEXT,
    "backgroundCheckUrl" TEXT,
    "ratingAvg" DECIMAL(3,2) NOT NULL DEFAULT 0,
    "ratingsCount" INTEGER NOT NULL DEFAULT 0,
    "coverageStreet" TEXT,
    "coverageComuna" TEXT,
    "coverageCity" TEXT,
    "coveragePostal" TEXT,
    "coverageLatitude" DOUBLE PRECISION,
    "coverageLongitude" DOUBLE PRECISION,
    "serviceRadiusKm" INTEGER NOT NULL DEFAULT 8,
    "hourlyRateFromClp" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProfessionalProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TaskerService" (
    "id" TEXT NOT NULL,
    "professionalProfileId" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "serviceId" TEXT NOT NULL,
    "priceClp" INTEGER NOT NULL,
    "minBooking" INTEGER NOT NULL DEFAULT 1,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TaskerService_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TaskerCategoryProfile" (
    "id" TEXT NOT NULL,
    "professionalProfileId" TEXT NOT NULL,
    "categorySlug" TEXT NOT NULL,
    "hourlyRateClp" INTEGER NOT NULL,
    "minBookingHours" INTEGER NOT NULL DEFAULT 1,
    "serviceCommunes" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "offeredServices" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "experienceTypes" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "scopeData" JSONB,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TaskerCategoryProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AvailabilitySlot" (
    "id" TEXT NOT NULL,
    "professionalProfileId" TEXT NOT NULL,
    "serviceId" TEXT,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "isAvailable" BOOLEAN NOT NULL DEFAULT true,
    "holdExpiresAt" TIMESTAMP(3),
    "heldByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AvailabilitySlot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Address" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "label" TEXT,
    "street" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "postalCode" TEXT NOT NULL,
    "region" TEXT,
    "country" TEXT NOT NULL DEFAULT 'CL',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Address_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Booking" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "proId" TEXT,
    "serviceId" TEXT NOT NULL,
    "bookedSlotId" TEXT,
    "addressId" TEXT,
    "status" "BookingStatus" NOT NULL DEFAULT 'PENDING',
    "scheduledAt" TIMESTAMP(3) NOT NULL,
    "addressLine1" TEXT NOT NULL,
    "comuna" TEXT NOT NULL,
    "region" TEXT NOT NULL,
    "city" TEXT,
    "postalCode" TEXT,
    "notes" TEXT,
    "hours" INTEGER NOT NULL DEFAULT 1,
    "slotMinutes" INTEGER NOT NULL DEFAULT 60,
    "autoAssign" BOOLEAN NOT NULL DEFAULT false,
    "hourlyPriceClp" INTEGER NOT NULL DEFAULT 0,
    "subtotalClp" INTEGER NOT NULL DEFAULT 0,
    "extrasTotalClp" INTEGER NOT NULL DEFAULT 0,
    "platformFeeClp" INTEGER NOT NULL DEFAULT 0,
    "totalPriceClp" INTEGER NOT NULL,
    "paymentStatus" "PaymentStatus" NOT NULL DEFAULT 'PENDING',
    "proReviewRating" INTEGER,
    "proReviewComment" TEXT,
    "proReviewedAt" TIMESTAMP(3),
    "onTheWayAt" TIMESTAMP(3),
    "checkInAt" TIMESTAMP(3),
    "checkInLat" DOUBLE PRECISION,
    "checkInLng" DOUBLE PRECISION,
    "checkInPhotoKey" TEXT,
    "checkOutAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Booking_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BookingExtra" (
    "id" TEXT NOT NULL,
    "bookingId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "priceClp" INTEGER NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BookingExtra_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Message" (
    "id" TEXT NOT NULL,
    "bookingId" TEXT NOT NULL,
    "senderId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "imageUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Message_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Payment" (
    "id" TEXT NOT NULL,
    "bookingId" TEXT NOT NULL,
    "provider" TEXT NOT NULL DEFAULT 'MERCADOPAGO',
    "providerPaymentId" TEXT,
    "providerStatus" TEXT,
    "currency" TEXT NOT NULL DEFAULT 'CLP',
    "paymentMethod" TEXT,
    "last4" TEXT,
    "payerEmail" TEXT,
    "rawResponseJson" JSONB,
    "refundedAt" TIMESTAMP(3),
    "idempotencyKey" TEXT,
    "errorCode" TEXT,
    "errorMessage" TEXT,
    "amountClp" INTEGER NOT NULL,
    "platformFeeClp" INTEGER NOT NULL DEFAULT 0,
    "applicationFeeClp" INTEGER,
    "collectorMpUserId" TEXT,
    "escrowStatus" TEXT,
    "escrowReleasedAt" TIMESTAMP(3),
    "status" "PaymentStatus" NOT NULL DEFAULT 'PENDING',
    "paidAt" TIMESTAMP(3),
    "boletaFolio" TEXT,
    "boletaUrl" TEXT,
    "boletaStatus" TEXT,
    "boletaEmittedAt" TIMESTAMP(3),
    "boletaErrorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Payment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Payout" (
    "id" TEXT NOT NULL,
    "bookingId" TEXT NOT NULL,
    "proId" TEXT NOT NULL,
    "amountClp" INTEGER NOT NULL,
    "status" "PayoutStatus" NOT NULL DEFAULT 'PENDING',
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "paidAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Payout_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Review" (
    "id" TEXT NOT NULL,
    "bookingId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "rating" INTEGER NOT NULL,
    "punctuality" INTEGER,
    "quality" INTEGER,
    "communication" INTEGER,
    "comment" TEXT,
    "providerReply" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Review_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DisputeTicket" (
    "id" TEXT NOT NULL,
    "bookingId" TEXT NOT NULL,
    "openedById" TEXT,
    "category" TEXT,
    "reason" TEXT NOT NULL,
    "evidence" JSONB,
    "resolution" TEXT,
    "refundAmountClp" INTEGER,
    "refundedProviderPaymentId" TEXT,
    "refundedAt" TIMESTAMP(3),
    "resolvedAt" TIMESTAMP(3),
    "resolvedById" TEXT,
    "dueDateAt" TIMESTAMP(3),
    "status" "TicketStatus" NOT NULL DEFAULT 'OPEN',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DisputeTicket_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "bookingId" TEXT,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ServiceLead" (
    "id" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "comuna" TEXT NOT NULL,
    "serviceNeeded" TEXT NOT NULL,
    "problemDescription" TEXT NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'landing',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ServiceLead_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CoverageWaitlist" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "commune" TEXT,
    "address" TEXT,
    "source" TEXT NOT NULL DEFAULT 'coverage_gate',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CoverageWaitlist_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CleaningOnboarding" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "status" "CleaningOnboardingStatus" NOT NULL DEFAULT 'BORRADOR',
    "currentStep" INTEGER NOT NULL DEFAULT 1,
    "categorySlug" TEXT NOT NULL DEFAULT 'limpieza',
    "baseCommune" TEXT,
    "referenceAddress" TEXT,
    "documentId" TEXT,
    "birthDate" TIMESTAMP(3),
    "profilePhotoPositionX" INTEGER NOT NULL DEFAULT 50,
    "profilePhotoPositionY" INTEGER NOT NULL DEFAULT 34,
    "nationality" TEXT,
    "migrationStatus" TEXT,
    "emergencyContactName" TEXT,
    "emergencyContactPhone" TEXT,
    "workReferences" TEXT,
    "profilePhotoUrl" TEXT,
    "shortDescription" TEXT,
    "yearsExperience" INTEGER,
    "workMode" "CleaningWorkMode",
    "experienceTypes" JSONB,
    "offeredServices" JSONB,
    "cleaningScope" JSONB,
    "petScope" JSONB,
    "babysitterScope" JSONB,
    "trainerScope" JSONB,
    "teacherScope" JSONB,
    "chefScope" JSONB,
    "makeupScope" JSONB,
    "ironingScope" JSONB,
    "acceptsHomesWithPets" BOOLEAN,
    "acceptsHomesWithChildren" BOOLEAN,
    "acceptsHomesWithElderly" BOOLEAN,
    "worksWithClientProducts" BOOLEAN,
    "bringsOwnProducts" BOOLEAN,
    "bringsOwnTools" BOOLEAN,
    "languages" JSONB,
    "serviceCommunes" JSONB,
    "coverageLatitude" DOUBLE PRECISION,
    "coverageLongitude" DOUBLE PRECISION,
    "maxTravelKm" INTEGER,
    "chargesTravelExtra" BOOLEAN,
    "availabilityMode" "CleaningAvailabilityMode",
    "availabilityBlocks" JSONB,
    "maxServicesPerDay" INTEGER,
    "acceptsUrgentBookings" BOOLEAN,
    "hourlyRateClp" INTEGER,
    "minBookingHours" INTEGER,
    "weekendSurchargePct" INTEGER,
    "holidaySurchargePct" INTEGER,
    "remoteCommuneSurchargeClp" INTEGER,
    "deepCleaningHourlyRateClp" INTEGER,
    "serviceRates" JSONB,
    "identityDocumentFile" TEXT,
    "identityDocumentFrontFile" TEXT,
    "identityDocumentBackFile" TEXT,
    "identitySelfieFile" TEXT,
    "criminalRecordFile" TEXT,
    "bankAccountHolder" TEXT,
    "bankAccountHolderRut" TEXT,
    "bankName" TEXT,
    "bankAccountType" TEXT,
    "bankAccountNumber" TEXT,
    "billingType" TEXT,
    "phoneVerificationCodeHash" TEXT,
    "phoneVerificationExpiresAt" TIMESTAMP(3),
    "phoneValidatedAt" TIMESTAMP(3),
    "trainingTopics" JSONB,
    "trainingCompletedAt" TIMESTAMP(3),
    "acceptsCancellationPolicy" BOOLEAN,
    "acceptsServiceProtocol" BOOLEAN,
    "acceptsDataProcessing" BOOLEAN,
    "confirmsCleaningScope" BOOLEAN,
    "submittedAt" TIMESTAMP(3),
    "reviewedAt" TIMESTAMP(3),
    "approvedAt" TIMESTAMP(3),
    "activatedAt" TIMESTAMP(3),
    "adminReviewNotes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CleaningOnboarding_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProcessedWebhookEvent" (
    "id" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "payloadJson" JSONB,
    "processedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProcessedWebhookEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdminAuditLog" (
    "id" TEXT NOT NULL,
    "actorId" TEXT,
    "action" TEXT NOT NULL,
    "targetType" TEXT NOT NULL,
    "targetId" TEXT,
    "beforeJson" JSONB,
    "afterJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AdminAuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MercadoPagoOAuthState" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MercadoPagoOAuthState_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OnboardingReviewEvent" (
    "id" TEXT NOT NULL,
    "onboardingId" TEXT NOT NULL,
    "actorId" TEXT,
    "action" TEXT NOT NULL,
    "notes" TEXT,
    "statusBefore" "CleaningOnboardingStatus",
    "statusAfter" "CleaningOnboardingStatus",
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OnboardingReviewEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TermsVersion" (
    "id" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "publishedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TermsVersion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_mpUserId_idx" ON "User"("mpUserId");

-- CreateIndex
CREATE UNIQUE INDEX "CustomerPaymentMethod_providerCardId_key" ON "CustomerPaymentMethod"("providerCardId");

-- CreateIndex
CREATE INDEX "CustomerPaymentMethod_userId_createdAt_idx" ON "CustomerPaymentMethod"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "CustomerPaymentMethod_userId_isDefault_idx" ON "CustomerPaymentMethod"("userId", "isDefault");

-- CreateIndex
CREATE UNIQUE INDEX "Role_code_key" ON "Role"("code");

-- CreateIndex
CREATE INDEX "UserRoleAssignment_roleId_idx" ON "UserRoleAssignment"("roleId");

-- CreateIndex
CREATE UNIQUE INDEX "UserRoleAssignment_userId_roleId_key" ON "UserRoleAssignment"("userId", "roleId");

-- CreateIndex
CREATE UNIQUE INDEX "EmailVerificationToken_tokenHash_key" ON "EmailVerificationToken"("tokenHash");

-- CreateIndex
CREATE INDEX "EmailVerificationToken_userId_expiresAt_idx" ON "EmailVerificationToken"("userId", "expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "PasswordResetToken_tokenHash_key" ON "PasswordResetToken"("tokenHash");

-- CreateIndex
CREATE INDEX "PasswordResetToken_userId_expiresAt_idx" ON "PasswordResetToken"("userId", "expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "AuthSession_tokenHash_key" ON "AuthSession"("tokenHash");

-- CreateIndex
CREATE INDEX "AuthSession_userId_expiresAt_idx" ON "AuthSession"("userId", "expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "Category_slug_key" ON "Category"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "Service_slug_key" ON "Service"("slug");

-- CreateIndex
CREATE INDEX "Service_categoryId_isActive_idx" ON "Service"("categoryId", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "ProfessionalProfile_userId_key" ON "ProfessionalProfile"("userId");

-- CreateIndex
CREATE INDEX "TaskerService_professionalProfileId_isActive_idx" ON "TaskerService"("professionalProfileId", "isActive");

-- CreateIndex
CREATE INDEX "TaskerService_categoryId_isActive_idx" ON "TaskerService"("categoryId", "isActive");

-- CreateIndex
CREATE INDEX "TaskerService_serviceId_isActive_idx" ON "TaskerService"("serviceId", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "TaskerService_professionalProfileId_serviceId_key" ON "TaskerService"("professionalProfileId", "serviceId");

-- CreateIndex
CREATE INDEX "TaskerCategoryProfile_professionalProfileId_isActive_idx" ON "TaskerCategoryProfile"("professionalProfileId", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "TaskerCategoryProfile_professionalProfileId_categorySlug_key" ON "TaskerCategoryProfile"("professionalProfileId", "categorySlug");

-- CreateIndex
CREATE INDEX "AvailabilitySlot_professionalProfileId_startsAt_isAvailable_idx" ON "AvailabilitySlot"("professionalProfileId", "startsAt", "isAvailable");

-- CreateIndex
CREATE INDEX "AvailabilitySlot_holdExpiresAt_idx" ON "AvailabilitySlot"("holdExpiresAt");

-- CreateIndex
CREATE INDEX "Address_userId_city_idx" ON "Address"("userId", "city");

-- CreateIndex
CREATE INDEX "Booking_customerId_status_idx" ON "Booking"("customerId", "status");

-- CreateIndex
CREATE INDEX "Booking_proId_status_idx" ON "Booking"("proId", "status");

-- CreateIndex
CREATE INDEX "Booking_scheduledAt_status_idx" ON "Booking"("scheduledAt", "status");

-- CreateIndex
CREATE INDEX "Booking_bookedSlotId_idx" ON "Booking"("bookedSlotId");

-- CreateIndex
CREATE INDEX "BookingExtra_bookingId_idx" ON "BookingExtra"("bookingId");

-- CreateIndex
CREATE INDEX "Message_bookingId_createdAt_idx" ON "Message"("bookingId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Payment_bookingId_key" ON "Payment"("bookingId");

-- CreateIndex
CREATE UNIQUE INDEX "Payment_idempotencyKey_key" ON "Payment"("idempotencyKey");

-- CreateIndex
CREATE INDEX "Payment_provider_providerPaymentId_idx" ON "Payment"("provider", "providerPaymentId");

-- CreateIndex
CREATE INDEX "Payment_providerStatus_idx" ON "Payment"("providerStatus");

-- CreateIndex
CREATE INDEX "Payment_status_createdAt_idx" ON "Payment"("status", "createdAt");

-- CreateIndex
CREATE INDEX "Payment_collectorMpUserId_idx" ON "Payment"("collectorMpUserId");

-- CreateIndex
CREATE UNIQUE INDEX "Payout_bookingId_key" ON "Payout"("bookingId");

-- CreateIndex
CREATE UNIQUE INDEX "Review_bookingId_key" ON "Review"("bookingId");

-- CreateIndex
CREATE INDEX "Review_rating_idx" ON "Review"("rating");

-- CreateIndex
CREATE INDEX "DisputeTicket_bookingId_status_idx" ON "DisputeTicket"("bookingId", "status");

-- CreateIndex
CREATE INDEX "DisputeTicket_status_createdAt_idx" ON "DisputeTicket"("status", "createdAt");

-- CreateIndex
CREATE INDEX "DisputeTicket_dueDateAt_idx" ON "DisputeTicket"("dueDateAt");

-- CreateIndex
CREATE INDEX "Notification_userId_createdAt_idx" ON "Notification"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "Notification_userId_isRead_idx" ON "Notification"("userId", "isRead");

-- CreateIndex
CREATE INDEX "ServiceLead_createdAt_idx" ON "ServiceLead"("createdAt");

-- CreateIndex
CREATE INDEX "ServiceLead_comuna_serviceNeeded_idx" ON "ServiceLead"("comuna", "serviceNeeded");

-- CreateIndex
CREATE INDEX "CoverageWaitlist_email_idx" ON "CoverageWaitlist"("email");

-- CreateIndex
CREATE INDEX "CoverageWaitlist_commune_createdAt_idx" ON "CoverageWaitlist"("commune", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "CleaningOnboarding_userId_key" ON "CleaningOnboarding"("userId");

-- CreateIndex
CREATE INDEX "CleaningOnboarding_status_createdAt_idx" ON "CleaningOnboarding"("status", "createdAt");

-- CreateIndex
CREATE INDEX "CleaningOnboarding_baseCommune_idx" ON "CleaningOnboarding"("baseCommune");

-- CreateIndex
CREATE INDEX "ProcessedWebhookEvent_processedAt_idx" ON "ProcessedWebhookEvent"("processedAt");

-- CreateIndex
CREATE UNIQUE INDEX "ProcessedWebhookEvent_provider_eventId_key" ON "ProcessedWebhookEvent"("provider", "eventId");

-- CreateIndex
CREATE INDEX "AdminAuditLog_actorId_createdAt_idx" ON "AdminAuditLog"("actorId", "createdAt");

-- CreateIndex
CREATE INDEX "AdminAuditLog_targetType_targetId_idx" ON "AdminAuditLog"("targetType", "targetId");

-- CreateIndex
CREATE UNIQUE INDEX "MercadoPagoOAuthState_state_key" ON "MercadoPagoOAuthState"("state");

-- CreateIndex
CREATE INDEX "MercadoPagoOAuthState_userId_expiresAt_idx" ON "MercadoPagoOAuthState"("userId", "expiresAt");

-- CreateIndex
CREATE INDEX "OnboardingReviewEvent_onboardingId_createdAt_idx" ON "OnboardingReviewEvent"("onboardingId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "TermsVersion_version_key" ON "TermsVersion"("version");

-- CreateIndex
CREATE INDEX "TermsVersion_publishedAt_idx" ON "TermsVersion"("publishedAt");

-- AddForeignKey
ALTER TABLE "CustomerPaymentMethod" ADD CONSTRAINT "CustomerPaymentMethod_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserRoleAssignment" ADD CONSTRAINT "UserRoleAssignment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserRoleAssignment" ADD CONSTRAINT "UserRoleAssignment_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "Role"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmailVerificationToken" ADD CONSTRAINT "EmailVerificationToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PasswordResetToken" ADD CONSTRAINT "PasswordResetToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuthSession" ADD CONSTRAINT "AuthSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Service" ADD CONSTRAINT "Service_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProfessionalProfile" ADD CONSTRAINT "ProfessionalProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskerService" ADD CONSTRAINT "TaskerService_professionalProfileId_fkey" FOREIGN KEY ("professionalProfileId") REFERENCES "ProfessionalProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskerService" ADD CONSTRAINT "TaskerService_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskerService" ADD CONSTRAINT "TaskerService_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "Service"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskerCategoryProfile" ADD CONSTRAINT "TaskerCategoryProfile_professionalProfileId_fkey" FOREIGN KEY ("professionalProfileId") REFERENCES "ProfessionalProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AvailabilitySlot" ADD CONSTRAINT "AvailabilitySlot_professionalProfileId_fkey" FOREIGN KEY ("professionalProfileId") REFERENCES "ProfessionalProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AvailabilitySlot" ADD CONSTRAINT "AvailabilitySlot_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "Service"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Address" ADD CONSTRAINT "Address_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_proId_fkey" FOREIGN KEY ("proId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "Service"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_bookedSlotId_fkey" FOREIGN KEY ("bookedSlotId") REFERENCES "AvailabilitySlot"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_addressId_fkey" FOREIGN KEY ("addressId") REFERENCES "Address"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BookingExtra" ADD CONSTRAINT "BookingExtra_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Message" ADD CONSTRAINT "Message_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Message" ADD CONSTRAINT "Message_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payout" ADD CONSTRAINT "Payout_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payout" ADD CONSTRAINT "Payout_proId_fkey" FOREIGN KEY ("proId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Review" ADD CONSTRAINT "Review_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Review" ADD CONSTRAINT "Review_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DisputeTicket" ADD CONSTRAINT "DisputeTicket_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CleaningOnboarding" ADD CONSTRAINT "CleaningOnboarding_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdminAuditLog" ADD CONSTRAINT "AdminAuditLog_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MercadoPagoOAuthState" ADD CONSTRAINT "MercadoPagoOAuthState_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OnboardingReviewEvent" ADD CONSTRAINT "OnboardingReviewEvent_onboardingId_fkey" FOREIGN KEY ("onboardingId") REFERENCES "CleaningOnboarding"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OnboardingReviewEvent" ADD CONSTRAINT "OnboardingReviewEvent_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

