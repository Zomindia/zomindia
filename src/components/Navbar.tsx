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
      <img src="/logo-horizontal.png" alt="Zomindia" className="h-8 sm:h-9 w-auto object-contain" />
    </div>
  );
};

export default NavbarBrand;
