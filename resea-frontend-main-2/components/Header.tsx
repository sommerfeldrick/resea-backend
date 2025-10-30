import React from 'react';

interface HeaderProps {
  onBack?: () => void;
}

export const Header: React.FC<HeaderProps> = ({ onBack }) => {
  return (
    <div className="flex justify-end items-center px-6 py-4 bg-white border-b border-gray-200">
      {/* Theme toggle está no LandingPage */}
    </div>
  );
};
