/**
 * Finance Domain — React Native UI component for transaction list.
 *
 * @traceability CANONICAL-DOMAIN-MODEL.md: Aggregate 3 (ResourceAggregate)
 * @traceability DOC-021: Physical Data Model transaction_record fields
 */

import React, { useMemo } from 'react';
import { View, Text, FlatList, StyleSheet, Pressable } from 'react-native';
import type { TransactionRecord } from './types';

export interface TransactionTableProps {
  transactions: ReadonlyArray<TransactionRecord>;
  isLoading: boolean;
  onTransactionPress?: (tx: TransactionRecord) => void;
}

type TransactionColorMap = Record<TransactionRecord['state'], string>;

const stateColors: TransactionColorMap = {
  draft: '#f59e0b',
  pending: '#3b82f6',
  approved: '#22c55e',
  rejected: '#ef4444',
};

/**
 * Renders a scrollable table of financial transactions.
 * Color-codes each row by its lifecycle state.
 */
export function TransactionTable({
  transactions,
  isLoading,
  onTransactionPress,
}: TransactionTableProps): React.ReactElement {
  const formattedTransactions = useMemo(
    () =>
      transactions.map((tx) => ({
        ...tx,
        formattedAmount: formatAmount(tx.amount, tx.type),
        stateColor: stateColors[tx.state],
      })),
    [transactions],
  );

  if (isLoading || formattedTransactions.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyText}>
          {isLoading ? 'Loading transactions...' : 'No transactions found'}
        </Text>
      </View>
    );
  }

  return (
    <FlatList
      data={formattedTransactions}
      keyExtractor={(item) => item.id}
      renderItem={({ item }) => (
        <Pressable
          style={styles.row}
          onPress={() => onTransactionPress?.(item)}
        >
          <View style={[styles.stateBadge, { backgroundColor: item.stateColor }]} />
          <View style={styles.rowContent}>
            <Text style={styles.description}>{item.description}</Text>
            <Text style={styles.meta}>
              {item.state.toUpperCase()} · {formatDateShort(item.transactionDate)}
            </Text>
          </View>
          <Text style={[styles.amount, getAmountColor(item.type)]}>
            {item.formattedAmount}
          </Text>
        </Pressable>
      )}
    />
  );
}

function formatAmount(amount: number, type: TransactionRecord['type']): string {
  const decimals = amount % 100;
  const whole = Math.floor(amount / 100);
  const sign = type === 'expense' ? '-' : type === 'transfer' ? '' : '';
  return `${sign}${whole}.${decimals.toString().padStart(2, '0')}`;
}

function formatDateShort(dateStr: string): string {
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  } catch {
    return dateStr.slice(0, 10);
  }
}

function getAmountColor(type: TransactionRecord['type']): { color: string } {
  return type === 'income' ? { color: '#22c55e' } : { color: '#ef4444' };
}

const styles = StyleSheet.create({
  emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32 },
  emptyText: { fontSize: 16, color: '#a0a0a0' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
  },
  stateBadge: { width: 8, height: 8, borderRadius: 4, flexShrink: 0 },
  rowContent: { flex: 1, gap: 2 },
  description: { fontSize: 15, fontWeight: '500', color: '#ffffff' },
  meta: { fontSize: 12, color: '#707070' },
  amount: { fontSize: 15, fontWeight: '600', fontVariant: ['tabular-nums'] },
});
