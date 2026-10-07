import React from 'react';

interface NavbarBrandProps {
  className?: string;
  onClick?: () => void;
}

export const NavbarBrand: React.FC<NavbarBrandProps> = ({ className = '', onClick }) => {
  return (
    <div 
      className={`inline-flex items-center cursor-pointer select-none ${className}`}
      onClick={onClick}
    >
      <img src="/logo-horizontal.png" alt="Zomindia" className="h-9 sm:h-10 w-auto object-contain -ml-1 scale-105 origin-left" />
    </div>
  );
};

export default NavbarBrand;
