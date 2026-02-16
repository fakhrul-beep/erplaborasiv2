import React from 'react';
import { Edit, Trash2, ChevronRight } from 'lucide-react';

interface Action {
  icon: React.ElementType;
  label: string;
  onClick: (id: string) => void;
  variant?: 'primary' | 'danger' | 'default';
}

interface MobileCardProps {
  id: string;
  title: string;
  subtitle?: string;
  status?: {
    label: string;
    color: string; // Tailwind color class e.g., 'bg-green-100 text-green-800'
  };
  details: { label: string; value: React.ReactNode }[];
  image?: string;
  actions?: Action[];
  onClick?: () => void;
}

export const MobileCard: React.FC<MobileCardProps> = ({
  id,
  title,
  subtitle,
  status,
  details,
  image,
  actions,
  onClick
}) => {
  return (
    <div 
      className="bg-white p-4 rounded-lg shadow-sm border border-gray-200 mb-4 active:bg-gray-50 transition-colors"
      onClick={onClick}
    >
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center space-x-3">
          {image && (
            <img 
              src={image} 
              alt={title} 
              className="h-12 w-12 rounded-full object-cover border border-gray-100" 
            />
          )}
          <div>
            <h3 className="text-base font-semibold text-gray-900 line-clamp-1">{title}</h3>
            {subtitle && <p className="text-sm text-gray-500 line-clamp-1">{subtitle}</p>}
          </div>
        </div>
        {status && (
          <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${status.color}`}>
            {status.label}
          </span>
        )}
      </div>

      <div className="space-y-2 mb-4">
        {details.map((detail, index) => (
          <div key={index} className="flex justify-between text-sm">
            <span className="text-gray-500">{detail.label}</span>
            <span className="text-gray-900 font-medium text-right">{detail.value}</span>
          </div>
        ))}
      </div>

      {actions && actions.length > 0 && (
        <div className="flex justify-end space-x-3 pt-3 border-t border-gray-100 mt-3">
          {actions.map((action, index) => (
            <button
              key={index}
              onClick={(e) => {
                e.stopPropagation();
                action.onClick(id);
              }}
              className={`inline-flex items-center px-3 py-2 border text-sm leading-4 font-medium rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-2 ${
                action.variant === 'danger' 
                  ? 'border-transparent text-white bg-red-600 hover:bg-red-700 focus:ring-red-500'
                  : action.variant === 'primary'
                  ? 'border-transparent text-primary bg-accent hover:bg-accent-hover focus:ring-accent'
                  : 'border-gray-300 text-gray-700 bg-white hover:bg-gray-50 focus:ring-primary'
              }`}
              aria-label={action.label}
            >
              <action.icon className="h-4 w-4 mr-1.5" />
              {action.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};
