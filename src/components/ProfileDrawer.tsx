import React from 'react';
import AccountPopup, { AccountPopupProps, AccountNavTab } from './AccountPopup';
import { UserProfile } from '../types';

export type { AccountPopupProps, AccountNavTab };

export interface ProfileDrawerProps extends Partial<AccountPopupProps> {
  isOpen: boolean;
  onClose: () => void;
  profile?: UserProfile | null;
  currentView?: string;
  onNavigate?: (tab: any, subTabOrArg?: string | null) => void;
  onOpenWallet?: () => void;
  onOpenProfileSettings?: () => void;
  onOpenBookings?: () => void;
  onOpenOffers?: () => void;
  onOpenAddresses?: () => void;
  onOpenAmc?: () => void;
  onOpenZomini?: () => void;
  onOpenAiSupport?: () => void;
  onLogout?: () => Promise<void> | void;
  mode?: "auto" | "desktop" | "mobile";
}

/**
 * ProfileDrawer:
 * Alias wrapper around AccountPopup to guarantee complete backward & modular compatibility.
 * Provides interactive sheet/popup for User Profile, Wallet, Bookings, Addresses, AMC, and ZOMINI support.
 */
export const ProfileDrawer: React.FC<ProfileDrawerProps> = ({
  isOpen,
  onClose,
  profile = null,
  onNavigate = () => {},
  onOpenAiSupport = () => {},
  onLogout = () => {},
  ...rest
}) => {
  return (
    <AccountPopup
      isOpen={isOpen}
      onClose={onClose}
      profile={profile || null}
      onNavigate={onNavigate}
      onOpenAiSupport={onOpenAiSupport}
      onLogout={onLogout}
      {...rest}
    />
  );
};

export default ProfileDrawer;
