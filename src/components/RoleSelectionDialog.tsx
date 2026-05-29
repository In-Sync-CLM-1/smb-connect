import { useState, useMemo } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { UserRole } from '@/hooks/useUserRole';
import { AvailableRoles } from '@/contexts/RoleContext';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem } from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Building2, Users, Shield, User, Check, ChevronsUpDown } from 'lucide-react';
import { cn } from '@/lib/utils';

interface RoleSelectionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  availableRoles: AvailableRoles;
  onSelectRole: (role: UserRole, associationId?: string, companyId?: string) => void;
  loading?: boolean;
}

export const RoleSelectionDialog = ({ 
  open, 
  onOpenChange, 
  availableRoles,
  onSelectRole,
  loading = false
}: RoleSelectionDialogProps) => {
  const [selectedRoleType, setSelectedRoleType] = useState<'admin' | 'association' | 'company' | 'member' | ''>('');
  const [selectedEntityId, setSelectedEntityId] = useState('');
  const [openRolePopover, setOpenRolePopover] = useState(false);
  const [openEntityPopover, setOpenEntityPopover] = useState(false);

  const roleTypes = useMemo(() => {
    const types = [];
    
    if (availableRoles.isAdmin) {
      types.push({
        value: 'admin' as const,
        label: availableRoles.isPlatformAdmin ? 'Platform Admin' : availableRoles.isSuperAdmin ? 'Super Admin' : 'Platform Admin',
        icon: Shield,
      });
    }
    
    if (availableRoles.associations.length > 0) {
      types.push({
        value: 'association' as const,
        label: 'Association Manager',
        icon: Users,
      });
    }
    
    if (availableRoles.companies.length > 0) {
      types.push({
        value: 'company' as const,
        label: 'Company Admin',
        icon: Building2,
      });
    }
    
    if (availableRoles.isMember) {
      types.push({
        value: 'member' as const,
        label: 'Member View',
        icon: User,
      });
    }
    
    return types;
  }, [availableRoles]);

  const entities = useMemo(() => {
    if (selectedRoleType === 'association') {
      return availableRoles.associations.map(assoc => ({
        id: assoc.id,
        name: assoc.name,
      }));
    }
    
    if (selectedRoleType === 'company') {
      return availableRoles.companies.map(company => ({
        id: company.id,
        name: company.name,
      }));
    }
    
    return [];
  }, [selectedRoleType, availableRoles]);

  const needsEntitySelection = selectedRoleType === 'association' || selectedRoleType === 'company';

  const handleConfirm = () => {
    if (!selectedRoleType) return;
    
    if (needsEntitySelection && !selectedEntityId) return;
    
    let role: UserRole;
    let associationId: string | undefined;
    let companyId: string | undefined;
    
    if (selectedRoleType === 'admin') {
      role = availableRoles.isPlatformAdmin ? 'platform-admin' : 'admin';
    } else if (selectedRoleType === 'association') {
      role = 'association';
      associationId = selectedEntityId;
    } else if (selectedRoleType === 'company') {
      role = 'company';
      companyId = selectedEntityId;
    } else {
      role = 'member';
    }
    
    onSelectRole(role, associationId, companyId);
    onOpenChange(false);
  };

  const handleRoleTypeChange = (value: string) => {
    setSelectedRoleType(value as any);
    setSelectedEntityId('');
    setOpenRolePopover(false);
  };

  const selectedRoleTypeData = roleTypes.find(rt => rt.value === selectedRoleType);
  const selectedEntity = entities.find(e => e.id === selectedEntityId);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Select Your Role</DialogTitle>
          <DialogDescription>
            You have access to multiple roles. Please select which role you want to use for this session.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="space-y-4">
            <div className="space-y-2">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-10 w-full" />
            </div>
            <div className="space-y-2">
              <Skeleton className="h-4 w-40" />
              <Skeleton className="h-10 w-full" />
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Role Type Selection */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Select Role Type</label>
              <Popover open={openRolePopover} onOpenChange={setOpenRolePopover}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={openRolePopover}
                    className="w-full justify-between"
                  >
                    {selectedRoleTypeData ? (
                      <div className="flex items-center gap-2">
                        <selectedRoleTypeData.icon className="h-4 w-4" />
                        {selectedRoleTypeData.label}
                      </div>
                    ) : (
                      "Select role type..."
                    )}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-full p-0" align="start">
                  <Command>
                    <CommandInput placeholder="Search role type..." />
                    <CommandEmpty>No role type found.</CommandEmpty>
                    <CommandGroup>
                      {roleTypes.map((roleType) => {
                        const Icon = roleType.icon;
                        return (
                          <CommandItem
                            key={roleType.value}
                            value={roleType.value}
                            onSelect={handleRoleTypeChange}
                          >
                            <Check
                              className={cn(
                                "mr-2 h-4 w-4",
                                selectedRoleType === roleType.value ? "opacity-100" : "opacity-0"
                              )}
                            />
                            <Icon className="mr-2 h-4 w-4" />
                            {roleType.label}
                          </CommandItem>
                        );
                      })}
                    </CommandGroup>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>

            {/* Entity Selection (for association/company) */}
            {needsEntitySelection && (
              <div className="space-y-2">
                <label className="text-sm font-medium">
                  Select {selectedRoleType === 'association' ? 'Association' : 'Company'}
                </label>
                <Popover open={openEntityPopover} onOpenChange={setOpenEntityPopover}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      role="combobox"
                      aria-expanded={openEntityPopover}
                      className="w-full justify-between"
                    >
                      {selectedEntity ? selectedEntity.name : `Select ${selectedRoleType}...`}
                      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-full p-0" align="start">
                    <Command>
                      <CommandInput placeholder={`Search ${selectedRoleType}...`} />
                      <CommandEmpty>No {selectedRoleType} found.</CommandEmpty>
                      <CommandGroup className="max-h-[200px] overflow-auto">
                        {entities.map((entity) => (
                          <CommandItem
                            key={entity.id}
                            value={entity.name}
                            onSelect={() => {
                              setSelectedEntityId(entity.id);
                              setOpenEntityPopover(false);
                            }}
                          >
                            <Check
                              className={cn(
                                "mr-2 h-4 w-4",
                                selectedEntityId === entity.id ? "opacity-100" : "opacity-0"
                              )}
                            />
                            {entity.name}
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </Command>
                  </PopoverContent>
                </Popover>
              </div>
            )}
          </div>
        )}

        <div className="flex justify-end gap-2 mt-4">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={loading}
          >
            Cancel
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={loading || !selectedRoleType || (needsEntitySelection && !selectedEntityId)}
          >
            Continue
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
