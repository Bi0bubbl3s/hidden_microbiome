import React from 'react';
import { CheckCircle2, AlertCircle, X } from 'lucide-react';

const Toast = ({ message, type, onClose }) => {
  if (!message) return null;
  const isError = type === 'error';
  return (
    <div className={`fixed bottom-4 right-4 flex items-center p-4 rounded-lg shadow-lg text-white ${isError ? 'bg-red-600' : 'bg-emerald-600'} transition-opacity z-50`}>
      {isError ? <AlertCircle className="w-5 h-5 mr-2" /> : <CheckCircle2 className="w-5 h-5 mr-2" />}
      <span>{message}</span>
      <button onClick={onClose} className="ml-4 hover:text-gray-200">
        <X className="w-4 h-4" />
      </button>
    </div>
  );
};

export default Toast;