import React from 'react';
import { PackageX } from 'lucide-react';

interface EmptyProps {
  title?: string;
  description?: string;
}

export default function Empty({ title = "No data found", description = "There are no items to display." }: EmptyProps) {
  return (
    <div className="flex flex-col items-center justify-center py-12">
      <div className="bg-gray-100 rounded-full p-3 mb-4">
        <PackageX className="h-8 w-8 text-gray-400" />
      </div>
      <h3 className="text-lg font-medium text-gray-900">{title}</h3>
      <p className="mt-1 text-sm text-gray-500 max-w-sm text-center">{description}</p>
    </div>
  );
}
