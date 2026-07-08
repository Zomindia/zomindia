/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { auth } from './firebase';

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  }
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  // If error is already a JSON string from handleFirestoreError, don't wrap it again
  if (error instanceof Error && error.message.includes('{"error":')) {
    console.error('Firestore Error Details (Relayed):', error.message);
    throw error;
  }

  let rawError = error instanceof Error ? error.message : String(error);
  const lowerError = rawError.toLowerCase();
  if (lowerError.includes('permission') || lowerError.includes('unauthorized') || lowerError.includes('insufficient_permissions') || lowerError.includes('permission-denied') || lowerError.includes('insufficient permissions')) {
    rawError = 'Action not allowed';
  }

  const errInfo: FirestoreErrorInfo = {
    error: rawError,
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData?.map(provider => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || []
    },
    operationType,
    path
  };
  
  const errorMessage = JSON.stringify(errInfo);
  console.error('Firestore Error Details:', errorMessage);
  throw new Error(errorMessage);
}
