import { ReactNode } from 'react';
import { UniversalSearch } from '@/components/UniversalSearch';

interface PageHeaderProps {
  title: string;
  description?: string;
  children?: ReactNode;
  hideSearch?: boolean;
  actions?: ReactNode;
}

export const PageHeader = ({ title, description, children, hideSearch, actions }: PageHeaderProps) => {
  return (
    <header className="border-b bg-card">
      <div className="container mx-auto py-4 pl-14 md:pl-20 lg:pl-24">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-4 flex-1">
            <div className="flex-shrink-0">
              <h1 className="text-xl md:text-2xl font-bold">{title}</h1>
              {description && (
                <p className="text-sm text-muted-foreground">{description}</p>
              )}
            </div>
            {!hideSearch && (
              <div className="hidden md:block flex-1 max-w-xs ml-4">
                <UniversalSearch />
              </div>
            )}
          </div>
          <div className="flex items-center gap-3">
            {actions}
            {children}
          </div>
        </div>
      </div>
    </header>
  );
};
