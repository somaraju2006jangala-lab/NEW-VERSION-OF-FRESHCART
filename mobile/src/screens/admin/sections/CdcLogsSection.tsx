import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
} from 'react-native';
import {
  History,
  Search,
  RefreshCw,
  Trash2,
  Activity,
  CheckCircle2,
  X,
  Zap,
} from 'lucide-react-native';
import { InventoryLog } from '../../../types';

interface CdcLogsSectionProps {
  logs: InventoryLog[];
  adminToken: string | null;
  onRefresh: () => void;
  onClearLogs?: () => void;
  onDeleteLog?: (logId: string) => void;
  onSimulatePulse?: () => void;
}

export const CdcLogsSection: React.FC<CdcLogsSectionProps> = ({
  logs,
  adminToken,
  onRefresh,
  onClearLogs,
  onDeleteLog,
  onSimulatePulse,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<'ALL' | 'RESTOCK' | 'SALE' | 'AUDIT'>('ALL');
  const [isRefreshing, setIsRefreshing] = useState(false);

  const filteredLogs = useMemo(() => {
    return logs.filter((log) => {
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch =
        !q ||
        log.productTitle?.toLowerCase().includes(q) ||
        log.sku?.toLowerCase().includes(q) ||
        log.operator?.toLowerCase().includes(q) ||
        log.notes?.toLowerCase().includes(q) ||
        log.changeType?.toLowerCase().includes(q);

      if (!matchesSearch) return false;

      if (typeFilter !== 'ALL') {
        if (typeFilter === 'AUDIT' && !log.changeType?.includes('AUDIT')) return false;
        if (typeFilter !== 'AUDIT' && log.changeType !== typeFilter) return false;
      }

      return true;
    });
  }, [logs, searchQuery, typeFilter]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await onRefresh();
    setIsRefreshing(false);
  };

  const handleClearAll = () => {
    Alert.alert(
      'Clear All Logs',
      `Are you sure you want to clear all ${logs.length} CDC audit log entries? This only removes the log records; live inventory remains intact.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear All',
          style: 'destructive',
          onPress: () => {
            if (onClearLogs) onClearLogs();
          },
        },
      ]
    );
  };

  const handleDeleteSingle = (log: InventoryLog) => {
    Alert.alert(
      'Delete Log Record',
      `Delete audit record for "${log.productTitle || log.sku}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            if (onDeleteLog) onDeleteLog(log.id);
          },
        },
      ]
    );
  };

  const formatLogDateTime = (log: InventoryLog) => {
    if (log.date && log.time) {
      return { date: log.date, time: log.time };
    }
    if (log.timestamp) {
      try {
        const d = new Date(log.timestamp);
        return {
          date: d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }),
          time: d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true }),
        };
      } catch {}
    }
    return { date: 'Today', time: 'Just now' };
  };

  return (
    <View style={styles.container}>
      {/* Header Banner */}
      <View style={styles.headerCard}>
        <View style={styles.headerTop}>
          <View style={styles.headerLeft}>
            <View style={styles.titleRow}>
              <History size={18} color="#10b981" />
              <Text style={styles.heading}>Live CDC Ledger</Text>
            </View>
            <Text style={styles.subheading}>
              Real-time synchronization between Store #104 mini-fulfillment pod and customer clients.
            </Text>
          </View>

          <View style={styles.clusterBadge}>
            <View style={styles.pulseDot} />
            <Text style={styles.clusterText}>Cluster Healthy</Text>
          </View>
        </View>

        {/* Action Controls */}
        <View style={styles.headerActions}>
          <TouchableOpacity
            style={styles.refreshBtn}
            onPress={handleRefresh}
            disabled={isRefreshing}
          >
            <RefreshCw size={14} color="#f8fafc" />
            <Text style={styles.refreshBtnText}>Refresh</Text>
          </TouchableOpacity>

          {onSimulatePulse && (
            <TouchableOpacity style={styles.pulseBtn} onPress={onSimulatePulse}>
              <Zap size={14} color="#10b981" />
              <Text style={styles.pulseBtnText}>Simulate CDC Pulse</Text>
            </TouchableOpacity>
          )}

          {logs.length > 0 && onClearLogs && (
            <TouchableOpacity style={styles.clearBtn} onPress={handleClearAll}>
              <Trash2 size={14} color="#ef4444" />
              <Text style={styles.clearBtnText}>Clear Logs</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Search & Type Filters */}
      <View style={styles.searchBar}>
        <Search size={16} color="#64748b" style={{ marginRight: 8 }} />
        <TextInput
          style={styles.searchInput}
          placeholder="Filter by SKU, item name, operator..."
          placeholderTextColor="#64748b"
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
        {searchQuery.length > 0 && (
          <TouchableOpacity onPress={() => setSearchQuery('')}>
            <X size={16} color="#94a3b8" />
          </TouchableOpacity>
        )}
      </View>

      <View style={styles.filtersRow}>
        {(['ALL', 'RESTOCK', 'SALE', 'AUDIT'] as const).map((ft) => (
          <TouchableOpacity
            key={ft}
            style={[styles.filterChip, typeFilter === ft && styles.filterChipActive]}
            onPress={() => setTypeFilter(ft)}
          >
            <Text style={[styles.filterChipText, typeFilter === ft && styles.filterChipTextActive]}>
              {ft}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Logs List */}
      {filteredLogs.length === 0 ? (
        <View style={styles.emptyCard}>
          <Activity size={36} color="#64748b" />
          <Text style={styles.emptyTitle}>No CDC audit records found</Text>
          <Text style={styles.emptySubtitle}>
            Changes in inventory or dispatches will stream here automatically.
          </Text>
        </View>
      ) : (
        <View style={styles.logsList}>
          {filteredLogs.map((log) => {
            const dt = formatLogDateTime(log);
            const isRestock = log.changeType === 'RESTOCK';
            const isSale = log.changeType === 'SALE';
            return (
              <View key={log.id} style={styles.logCard}>
                <View style={styles.logLeft}>
                  <View
                    style={[
                      styles.typeTag,
                      isRestock
                        ? styles.typeTagRestock
                        : isSale
                        ? styles.typeTagSale
                        : styles.typeTagAudit,
                    ]}
                  >
                    <Text
                      style={[
                        styles.typeTagText,
                        isRestock
                          ? styles.typeTextRestock
                          : isSale
                          ? styles.typeTextSale
                          : styles.typeTextAudit,
                      ]}
                    >
                      {log.changeType}
                    </Text>
                  </View>

                  <View style={styles.logDetails}>
                    <Text style={styles.productTitle} numberOfLines={1}>
                      {log.productTitle || 'Product SKU'}
                    </Text>
                    <Text style={styles.logSku}>SKU: {log.sku || 'N/A'}</Text>
                    <Text style={styles.logNotes} numberOfLines={2}>
                      {log.notes} · Op: {log.operator || 'Admin'}
                    </Text>
                  </View>
                </View>

                <View style={styles.logRight}>
                  <Text
                    style={[
                      styles.qtyChange,
                      log.quantityChange > 0 ? styles.qtyPositive : styles.qtyNegative,
                    ]}
                  >
                    {log.quantityChange > 0 ? `+${log.quantityChange}` : log.quantityChange}
                  </Text>
                  <Text style={styles.dateTimeText}>DATE: {dt.date}</Text>
                  <Text style={styles.dateTimeText}>TIME: {dt.time}</Text>

                  {onDeleteLog && (
                    <TouchableOpacity
                      style={styles.deleteSingleBtn}
                      onPress={() => handleDeleteSingle(log)}
                    >
                      <Trash2 size={13} color="#94a3b8" />
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            );
          })}
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  headerCard: {
    backgroundColor: '#0f172a',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#1e293b',
    padding: 14,
    marginBottom: 12,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 12,
  },
  headerLeft: {
    flex: 1,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  heading: {
    fontSize: 15,
    fontWeight: '800',
    color: '#f8fafc',
  },
  subheading: {
    fontSize: 11,
    color: '#94a3b8',
    marginTop: 4,
    lineHeight: 16,
  },
  clusterBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#064e3b',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  pulseDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#10b981',
  },
  clusterText: {
    color: '#34d399',
    fontSize: 10,
    fontWeight: '700',
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#1e293b',
  },
  refreshBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#1e293b',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  refreshBtnText: {
    color: '#f8fafc',
    fontSize: 11,
    fontWeight: '600',
  },
  pulseBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#064e3b',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  pulseBtnText: {
    color: '#34d399',
    fontSize: 11,
    fontWeight: '700',
  },
  clearBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#7f1d1d',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    marginLeft: 'auto',
  },
  clearBtnText: {
    color: '#fca5a5',
    fontSize: 11,
    fontWeight: '600',
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0f172a',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#1e293b',
    paddingHorizontal: 12,
    height: 40,
    marginBottom: 10,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    color: '#f8fafc',
  },
  filtersRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 14,
  },
  filterChip: {
    backgroundColor: '#0f172a',
    borderWidth: 1,
    borderColor: '#1e293b',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 16,
  },
  filterChipActive: {
    backgroundColor: '#006b2c',
    borderColor: '#10b981',
  },
  filterChipText: {
    fontSize: 11,
    color: '#94a3b8',
    fontWeight: '600',
  },
  filterChipTextActive: {
    color: '#fff',
  },
  logsList: {
    gap: 8,
    paddingBottom: 24,
  },
  logCard: {
    flexDirection: 'row',
    backgroundColor: '#0f172a',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#1e293b',
    padding: 12,
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 10,
  },
  logLeft: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    flex: 1,
  },
  typeTag: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    marginTop: 2,
  },
  typeTagRestock: {
    backgroundColor: '#064e3b',
  },
  typeTagSale: {
    backgroundColor: '#312e81',
  },
  typeTagAudit: {
    backgroundColor: '#78350f',
  },
  typeTagText: {
    fontSize: 9,
    fontWeight: '800',
    fontFamily: 'monospace',
  },
  typeTextRestock: {
    color: '#34d399',
  },
  typeTextSale: {
    color: '#a5b4fc',
  },
  typeTextAudit: {
    color: '#fde047',
  },
  logDetails: {
    flex: 1,
  },
  productTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#f8fafc',
  },
  logSku: {
    fontSize: 10,
    color: '#94a3b8',
    marginTop: 1,
  },
  logNotes: {
    fontSize: 10,
    color: '#64748b',
    marginTop: 2,
  },
  logRight: {
    alignItems: 'flex-end',
  },
  qtyChange: {
    fontSize: 13,
    fontWeight: '800',
  },
  qtyPositive: {
    color: '#10b981',
  },
  qtyNegative: {
    color: '#ef4444',
  },
  dateTimeText: {
    fontSize: 9,
    color: '#64748b',
    marginTop: 1,
  },
  deleteSingleBtn: {
    padding: 4,
    marginTop: 4,
  },
  emptyCard: {
    alignItems: 'center',
    paddingVertical: 48,
    backgroundColor: '#0f172a',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#1e293b',
  },
  emptyTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#f8fafc',
    marginTop: 10,
  },
  emptySubtitle: {
    fontSize: 11,
    color: '#94a3b8',
    marginTop: 4,
    textAlign: 'center',
    paddingHorizontal: 20,
  },
});
