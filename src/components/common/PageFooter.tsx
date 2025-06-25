import React from 'react';

const PageFooter: React.FC = () => {
  return (
    <footer className="p-2 text-center text-xs text-gray-500 border-t bg-white">
      <p>© {new Date().getFullYear()} AI Travel Agent. All rights reserved.</p>
    </footer>
  );
};

export default PageFooter; 