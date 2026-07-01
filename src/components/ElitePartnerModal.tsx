import React from 'react';
import SignUpAsPartner from './SignUpAsPartner';
import { UserProfile } from '../types';

interface ElitePartnerModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialFullName?: string;
  initialPhone?: string;
}

export default function ElitePartnerModal({
  isOpen,
  onClose,
  initialFullName = '',
  initialPhone = ''
}: ElitePartnerModalProps) {
  const dummyProfile: UserProfile = {
    uid: '',
    displayName: initialFullName,
    fullName: initialFullName,
    phoneNumber: initialPhone,
    role: 'customer',
    email: '',
    createdAt: new Date().toISOString()
  };

  return (
    <SignUpAsPartner
      profile={dummyProfile}
      onSuccess={onClose}
      isOpen={isOpen}
      onClose={onClose}
    />
  );
}
