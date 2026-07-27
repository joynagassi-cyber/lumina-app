/**
 * OrganizationPicker — Multi-org switcher.
 *
 * Switches the active org_id in session from a list of user memberships
 * (resolved from JWT claim or sync data).
 *
 * Traceability: ORG-002 (multi-org handling)
 *              BR-ORG-001 (user must be member of an org to act)
 */

import React from 'react';
import { cn } from '@/utils';
import { Pressable, Text, View, Modal as RnModal, FlatList } from 'react-native';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export interface Membership {
  /** Unique org ID. */
  organizationId: string;
  /** Display name of the organization. */
  organizationName: string;
  /** User's role within this org (e.g. 'admin', 'member'). */
  role?: string;
}

export interface OrganizationPickerProps {
  /** Current active organization ID. */
  currentOrgId: string;
  /** List of all organizations the user belongs to. */
  organizations: Membership[];
  /** Called when user switches org — caller persists in session. */
  onOrgChange: (orgId: string) => void;
  /** When true, shows only the current org name without a picker. */
  compact?: boolean;
  /** Additional className overrides. */
  className?: string;
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export function OrganizationPicker({
  currentOrgId,
  organizations,
  onOrgChange,
  compact = false,
  className,
}: OrganizationPickerProps) {
  const [pickerOpen, setPickerOpen] = React.useState(false);
  const [searchQuery, setSearchQuery] = React.useState('');

  const currentOrg = organizations.find((o) => o.organizationId === currentOrgId);

  const filtered = organizations.filter((o) =>
    o.organizationName.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  if (compact || !currentOrg) {
    return (
      <View
        className={cn(
          'flex-row items-center gap-2 rounded-lg bg-lumina-surface px-3 py-2',
          className,
        )}
      >
        <Text className="text-sm font-medium text-lumina-text" numberOfLines={1}>
          {currentOrg?.organizationName ?? 'Select org'}
        </Text>
        {!compact && (
          <Pressable
            onPress={() => setPickerOpen(true)}
            style={{ minHeight: 44 }}
            accessibilityRole="button"
            accessibilityLabel="Switch organization"
          >
            <Text className="text-base text-lumina-accent">{"▾"}</Text>
          </Pressable>
        )}
      </View>
    );
  }

  return (
    <>
      <Pressable
        onPress={() => setPickerOpen(true)}
        className={cn(
          'flex-row items-center gap-2 rounded-lg bg-lumina-surface px-3 py-2',
          className,
        )}
        style={{ minHeight: 44 }}
        accessibilityRole="button"
        accessibilityLabel={`Current org: ${currentOrg.organizationName}. Tap to switch.`}
      >
        <Text className="flex-1 text-sm font-medium text-lumina-text" numberOfLines={1}>
          {currentOrg.organizationName}
        </Text>
        <Text className="text-base text-lumina-accent">{"▾"}</Text>
      </Pressable>

      <RnModal
        visible={pickerOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setPickerOpen(false)}
      >
        <Pressable
          className="flex-1 items-end bg-black/50"
          onPress={() => setPickerOpen(false)}
        >
          <View className="h-[70%] w-full min-w-[280px] max-w-md overflow-hidden rounded-t-2xl bg-lumina-elevated">
            {/* Search */}
            <View className="border-b border-lumina-border p-4">
              <Text className="mb-2 text-lg font-bold text-lumina-text">Switch Organization</Text>
              <View className="rounded-lg border border-lumina-border bg-lumina-surface px-3 py-2">
                <Text className="text-sm text-lumina-text-muted">Search organizations...</Text>
              </View>
            </View>

            <FlatList
              data={filtered}
              keyExtractor={(item) => item.organizationId}
              contentContainerStyle={{ padding: 8 }}
              ItemSeparatorComponent={() => <View className="h-px bg-lumina-border mx-4" />}
              renderItem={({ item }) => (
                <Pressable
                  onPress={() => {
                    onOrgChange(item.organizationId);
                    setPickerOpen(false);
                  }}
                  className={cn(
                    'flex-row items-center rounded-lg px-4 py-3',
                    item.organizationId === currentOrgId && 'bg-lumina-accent/20',
                  )}
                  style={{ minHeight: 44 }}
                  accessibilityRole="option"
                  accessibilityLabel={`${item.organizationName}${item.role ? ` (${item.role})` : ''}`}
                  accessibilityState={{ selected: item.organizationId === currentOrgId }}
                >
                  <View className="flex-1">
                    <Text
                      className={cn(
                        'text-base',
                        item.organizationId === currentOrgId
                          ? 'font-semibold text-lumina-text'
                          : 'text-lumina-text-secondary',
                      )}
                      numberOfLines={1}
                    >
                      {item.organizationName}
                    </Text>
                    {item.role && (
                      <Text className="text-xs text-lumina-text-muted capitalize">{item.role}</Text>
                    )}
                  </View>
                  {item.organizationId === currentOrgId && (
                    <Text className="text-sm font-bold text-lumina-accent">{"✓"}</Text>
                  )}
                </Pressable>
              )}
            />
          </View>
        </Pressable>
      </RnModal>
    </>
  );
}
