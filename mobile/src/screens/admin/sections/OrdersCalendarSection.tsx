import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  ShoppingBag,
  CreditCard,
  Banknote,
  CheckCircle2,
  Clock,
  XCircle,
  RefreshCw,
  TrendingUp,
  MapPin,
  Phone,
} from 'lucide-react-native';
import {
  DailyReportData,
  DailyReportOrder,
  MonthDayActivity,
} from '../../../types';
import { adminApi } from '../../../services/apiClient';

interface OrdersCalendarSectionProps {
  adminToken: string | null;
}

const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

const WEEKDAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export const OrdersCalendarSection: React.FC<OrdersCalendarSectionProps> = ({
  adminToken,
}) => {
  const getTodayStr = () => {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  };

  const todayStr = getTodayStr();
  const [selectedDate, setSelectedDate] = useState<string>(todayStr);

  const initialDateObj = new Date();
  const [viewYear, setViewYear] = useState<number>(initialDateObj.getFullYear());
  const [viewMonth, setViewMonth] = useState<number>(initialDateObj.getMonth() + 1); // 1-12

  // Month activity map
  const [monthDays, setMonthDays] = useState<Record<string, MonthDayActivity>>({});
  const [isLoadingMonth, setIsLoadingMonth] = useState(false);

  // Daily report data
  const [dailyReport, setDailyReport] = useState<DailyReportData | null>(null);
  const [isLoadingReport, setIsLoadingReport] = useState(false);

  // Orders filter within selected date
  const [orderFilter, setOrderFilter] = useState<'all' | 'upi' | 'cod' | 'verified' | 'pending'>(
    'all'
  );

  // Fetch month summary
  const loadMonthSummary = useCallback(async () => {
    if (!adminToken) return;
    setIsLoadingMonth(true);
    try {
      const res = await adminApi.getCalendarMonthSummary(adminToken, viewYear, viewMonth);
      if (res.success && res.days) {
        setMonthDays(res.days);
      }
    } catch (err: any) {
      console.warn('Could not load calendar month summary:', err);
    } finally {
      setIsLoadingMonth(false);
    }
  }, [adminToken, viewYear, viewMonth]);

  // Fetch daily report for selected date
  const loadDailyReport = useCallback(async () => {
    if (!adminToken || !selectedDate) return;
    setIsLoadingReport(true);
    try {
      const res = await adminApi.getDailyReport(adminToken, selectedDate);
      if (res.success && res.report) {
        setDailyReport(res.report);
      }
    } catch (err: any) {
      console.warn('Could not load daily report:', err);
    } finally {
      setIsLoadingReport(false);
    }
  }, [adminToken, selectedDate]);

  useEffect(() => {
    loadMonthSummary();
  }, [loadMonthSummary]);

  useEffect(() => {
    loadDailyReport();
  }, [loadDailyReport]);

  const handlePrevMonth = () => {
    if (viewMonth === 1) {
      setViewYear((y) => y - 1);
      setViewMonth(12);
    } else {
      setViewMonth((m) => m - 1);
    }
  };

  const handleNextMonth = () => {
    if (viewMonth === 12) {
      setViewYear((y) => y + 1);
      setViewMonth(1);
    } else {
      setViewMonth((m) => m + 1);
    }
  };

  const handleSelectDay = (dateStr: string) => {
    setSelectedDate(dateStr);
  };

  const handleJumpToToday = () => {
    const now = new Date();
    setViewYear(now.getFullYear());
    setViewMonth(now.getMonth() + 1);
    setSelectedDate(todayStr);
  };

  // Calendar grid construction
  const calendarDays = useMemo(() => {
    const daysInMonth = new Date(viewYear, viewMonth, 0).getDate();
    const firstDayIndex = new Date(viewYear, viewMonth - 1, 1).getDay(); // 0 for Sun

    const days: Array<{
      dateStr: string;
      dayNum: number;
      isCurrentMonth: boolean;
      orderCount: number;
      isSelected: boolean;
      isToday: boolean;
    }> = [];

    // Empty cells for days before the 1st
    for (let i = 0; i < firstDayIndex; i++) {
      days.push({
        dateStr: `prev-${i}`,
        dayNum: 0,
        isCurrentMonth: false,
        orderCount: 0,
        isSelected: false,
        isToday: false,
      });
    }

    // Days in this month
    for (let day = 1; day <= daysInMonth; day++) {
      const dayStr = String(day).padStart(2, '0');
      const mStr = String(viewMonth).padStart(2, '0');
      const fullDateStr = `${viewYear}-${mStr}-${dayStr}`;
      const activity = monthDays[fullDateStr];
      const count = activity?.orderCount || 0;

      days.push({
        dateStr: fullDateStr,
        dayNum: day,
        isCurrentMonth: true,
        orderCount: count,
        isSelected: fullDateStr === selectedDate,
        isToday: fullDateStr === todayStr,
      });
    }

    return days;
  }, [viewYear, viewMonth, monthDays, selectedDate, todayStr]);

  // Filtered orders for selected date
  const filteredOrders = useMemo(() => {
    if (!dailyReport?.orders) return [];
    return dailyReport.orders.filter((ord) => {
      const isUpi = ord.paymentMethod?.toLowerCase().includes('upi');
      const isCod = ord.paymentMethod?.toLowerCase().includes('cod');
      const isPaid = ord.paymentStatus === 'PAID' || ord.paymentStatus === 'COMPLETED';

      if (orderFilter === 'upi') return isUpi;
      if (orderFilter === 'cod') return isCod;
      if (orderFilter === 'verified') return isPaid;
      if (orderFilter === 'pending') return !isPaid;

      return true;
    });
  }, [dailyReport, orderFilter]);

  const formattedSelectedDate = useMemo(() => {
    try {
      const parts = selectedDate.split('-');
      if (parts.length === 3) {
        const d = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
        return d.toLocaleDateString('en-IN', {
          weekday: 'short',
          day: '2-digit',
          month: 'short',
          year: 'numeric',
        });
      }
    } catch {}
    return selectedDate;
  }, [selectedDate]);

  return (
    <View style={styles.container}>
      {/* Top Header */}
      <View style={styles.headerCard}>
        <View style={styles.headerTop}>
          <View>
            <View style={styles.titleRow}>
              <CalendarIcon size={18} color="#10b981" />
              <Text style={styles.heading}>Orders & Transactions Calendar</Text>
            </View>
            <Text style={styles.subheading}>
              Inspect daily fulfillment volume, UPI payments, and cash-on-delivery collections.
            </Text>
          </View>

          <TouchableOpacity style={styles.todayBtn} onPress={handleJumpToToday}>
            <Text style={styles.todayBtnText}>Today</Text>
          </TouchableOpacity>
        </View>

        {/* Month Navigation */}
        <View style={styles.monthNav}>
          <TouchableOpacity style={styles.navArrowBtn} onPress={handlePrevMonth}>
            <ChevronLeft size={18} color="#f8fafc" />
          </TouchableOpacity>

          <View style={styles.monthLabelBox}>
            <Text style={styles.monthLabelText}>
              {MONTH_NAMES[viewMonth - 1]} {viewYear}
            </Text>
            {isLoadingMonth && (
              <ActivityIndicator size="small" color="#10b981" style={{ marginLeft: 6 }} />
            )}
          </View>

          <TouchableOpacity style={styles.navArrowBtn} onPress={handleNextMonth}>
            <ChevronRight size={18} color="#f8fafc" />
          </TouchableOpacity>
        </View>

        {/* Weekday Header */}
        <View style={styles.weekdayRow}>
          {WEEKDAY_NAMES.map((name, i) => (
            <Text
              key={name}
              style={[
                styles.weekdayText,
                (i === 0 || i === 6) && styles.weekdayWeekend,
              ]}
            >
              {name}
            </Text>
          ))}
        </View>

        {/* Calendar Grid */}
        <View style={styles.calendarGrid}>
          {calendarDays.map((item, idx) => {
            if (!item.isCurrentMonth) {
              return <View key={idx} style={styles.calendarCellEmpty} />;
            }

            return (
              <TouchableOpacity
                key={item.dateStr}
                style={[
                  styles.calendarCell,
                  item.isToday && styles.cellToday,
                  item.isSelected && styles.cellSelected,
                ]}
                onPress={() => handleSelectDay(item.dateStr)}
              >
                <Text
                  style={[
                    styles.cellDayText,
                    item.isToday && styles.cellDayTextToday,
                    item.isSelected && styles.cellDayTextSelected,
                  ]}
                >
                  {item.dayNum}
                </Text>

                {item.orderCount > 0 ? (
                  <View
                    style={[
                      styles.orderBadge,
                      item.isSelected ? styles.orderBadgeSelected : styles.orderBadgeActive,
                    ]}
                  >
                    <Text
                      style={[
                        styles.orderBadgeText,
                        item.isSelected ? styles.orderBadgeTextSelected : styles.orderBadgeTextActive,
                      ]}
                    >
                      {item.orderCount}
                    </Text>
                  </View>
                ) : (
                  <View style={styles.noOrderDot} />
                )}
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {/* Selected Day Report Section */}
      <View style={styles.reportSection}>
        <View style={styles.reportHeader}>
          <View>
            <Text style={styles.reportDateTitle}>
              Operations Report: {formattedSelectedDate}
            </Text>
            <Text style={styles.reportDateSub}>
              Detailed audit trail for selected calendar date
            </Text>
          </View>

          <TouchableOpacity
            style={styles.refreshReportBtn}
            onPress={loadDailyReport}
            disabled={isLoadingReport}
          >
            <RefreshCw
              size={13}
              color="#f8fafc"
              style={isLoadingReport ? { transform: [{ rotate: '45deg' }] } : {}}
            />
          </TouchableOpacity>
        </View>

        {isLoadingReport ? (
          <View style={styles.loadingBox}>
            <ActivityIndicator size="large" color="#10b981" />
            <Text style={styles.loadingText}>Fetching day's transactions...</Text>
          </View>
        ) : !dailyReport ? (
          <View style={styles.emptyReportBox}>
            <ShoppingBag size={36} color="#64748b" />
            <Text style={styles.emptyTitle}>No report records for this date</Text>
          </View>
        ) : (
          <>
            {/* Daily Metric Cards */}
            <View style={styles.metricGrid}>
              <View style={[styles.metricCard, { borderColor: '#10b981' }]}>
                <View style={styles.metricIconRow}>
                  <ShoppingBag size={14} color="#10b981" />
                  <Text style={styles.metricCardLabel}>Total Orders</Text>
                </View>
                <Text style={styles.metricCardVal}>{dailyReport.totalOrders}</Text>
                <Text style={styles.metricCardSub}>
                  {dailyReport.upiOrdersCount} UPI · {dailyReport.codOrdersCount} COD
                </Text>
              </View>

              <View style={[styles.metricCard, { borderColor: '#3b82f6' }]}>
                <View style={styles.metricIconRow}>
                  <TrendingUp size={14} color="#3b82f6" />
                  <Text style={styles.metricCardLabel}>Revenue Collected</Text>
                </View>
                <Text style={[styles.metricCardVal, { color: '#38bdf8' }]}>
                  ₹{dailyReport.totalCollectedAmount.toLocaleString('en-IN')}
                </Text>
                <Text style={styles.metricCardSub}>
                  UPI: ₹{dailyReport.totalUpiTransactions} · COD: ₹{dailyReport.totalCodCollections}
                </Text>
              </View>

              <View style={[styles.metricCard, { borderColor: '#f59e0b' }]}>
                <View style={styles.metricIconRow}>
                  <Clock size={14} color="#f59e0b" />
                  <Text style={styles.metricCardLabel}>Pending UPI</Text>
                </View>
                <Text style={[styles.metricCardVal, { color: '#f59e0b' }]}>
                  {dailyReport.pendingUpiCount}
                </Text>
                <Text style={styles.metricCardSub}>
                  ₹{dailyReport.pendingUpiAmount} awaiting verification
                </Text>
              </View>

              <View style={[styles.metricCard, { borderColor: '#ef4444' }]}>
                <View style={styles.metricIconRow}>
                  <XCircle size={14} color="#ef4444" />
                  <Text style={styles.metricCardLabel}>Rejected Payments</Text>
                </View>
                <Text style={[styles.metricCardVal, { color: '#ef4444' }]}>
                  {dailyReport.rejectedUpiCount}
                </Text>
                <Text style={styles.metricCardSub}>
                  ₹{dailyReport.rejectedUpiAmount} rejected
                </Text>
              </View>
            </View>

            {/* Orders Filter Tabs */}
            <View style={styles.ordersFilterRow}>
              {[
                { key: 'all' as const, label: `All (${dailyReport.orders?.length || 0})` },
                { key: 'upi' as const, label: `UPI (${dailyReport.upiOrdersCount || 0})` },
                { key: 'cod' as const, label: `COD (${dailyReport.codOrdersCount || 0})` },
                { key: 'verified' as const, label: 'Verified' },
                { key: 'pending' as const, label: 'Pending' },
              ].map((tab) => (
                <TouchableOpacity
                  key={tab.key}
                  style={[styles.orderFilterChip, orderFilter === tab.key && styles.orderFilterChipActive]}
                  onPress={() => setOrderFilter(tab.key)}
                >
                  <Text
                    style={[
                      styles.orderFilterText,
                      orderFilter === tab.key && styles.orderFilterTextActive,
                    ]}
                  >
                    {tab.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Orders List */}
            {filteredOrders.length === 0 ? (
              <View style={styles.noOrdersCard}>
                <Text style={styles.noOrdersText}>No orders match this filter.</Text>
              </View>
            ) : (
              <View style={styles.ordersList}>
                {filteredOrders.map((ord) => {
                  const isPaid = ord.paymentStatus === 'PAID' || ord.paymentStatus === 'COMPLETED';
                  const isRejected = ord.paymentStatus === 'REJECTED';
                  return (
                    <View key={ord.id} style={styles.orderItemCard}>
                      <View style={styles.orderItemHeader}>
                        <View>
                          <Text style={styles.orderItemId}>{ord.id}</Text>
                          <Text style={styles.orderItemCust}>{ord.customerName}</Text>
                        </View>
                        <View style={styles.orderItemTotalBox}>
                          <Text style={styles.orderItemTotal}>₹{ord.total}</Text>
                          <View
                            style={[
                              styles.paymentPill,
                              isPaid
                                ? styles.paymentPillPaid
                                : isRejected
                                ? styles.paymentPillRejected
                                : styles.paymentPillPending,
                            ]}
                          >
                            <Text
                              style={[
                                styles.paymentPillText,
                                isPaid
                                  ? styles.paymentTextPaid
                                  : isRejected
                                  ? styles.paymentTextRejected
                                  : styles.paymentTextPending,
                              ]}
                            >
                              {ord.paymentMethod} · {ord.paymentStatus}
                            </Text>
                          </View>
                        </View>
                      </View>

                      {ord.customerPhone ? (
                        <View style={styles.detailRow}>
                          <Phone size={11} color="#94a3b8" />
                          <Text style={styles.detailText}>{ord.customerPhone}</Text>
                        </View>
                      ) : null}

                      {ord.deliveryAddress ? (
                        <View style={styles.detailRow}>
                          <MapPin size={11} color="#94a3b8" />
                          <Text style={styles.detailText} numberOfLines={1}>
                            {ord.deliveryAddress}
                          </Text>
                        </View>
                      ) : null}
                    </View>
                  );
                })}
              </View>
            )}
          </>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 30,
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
    gap: 8,
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
  todayBtn: {
    backgroundColor: '#006b2c',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  todayBtnText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '700',
  },
  monthNav: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginVertical: 12,
    paddingVertical: 6,
    backgroundColor: '#1e293b',
    borderRadius: 8,
    paddingHorizontal: 8,
  },
  navArrowBtn: {
    padding: 6,
  },
  monthLabelBox: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  monthLabelText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#f8fafc',
  },
  weekdayRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  weekdayText: {
    width: '14.28%',
    textAlign: 'center',
    fontSize: 10,
    fontWeight: '700',
    color: '#94a3b8',
  },
  weekdayWeekend: {
    color: '#f87171',
  },
  calendarGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  calendarCellEmpty: {
    width: '14.28%',
    height: 44,
  },
  calendarCell: {
    width: '14.28%',
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
    marginVertical: 2,
  },
  cellToday: {
    borderWidth: 1,
    borderColor: '#38bdf8',
  },
  cellSelected: {
    backgroundColor: '#006b2c',
    borderWidth: 1,
    borderColor: '#10b981',
  },
  cellDayText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#f8fafc',
  },
  cellDayTextToday: {
    color: '#38bdf8',
    fontWeight: '800',
  },
  cellDayTextSelected: {
    color: '#fff',
    fontWeight: '800',
  },
  orderBadge: {
    marginTop: 2,
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 6,
  },
  orderBadgeActive: {
    backgroundColor: '#064e3b',
  },
  orderBadgeSelected: {
    backgroundColor: '#fff',
  },
  orderBadgeText: {
    fontSize: 8,
    fontWeight: '800',
  },
  orderBadgeTextActive: {
    color: '#34d399',
  },
  orderBadgeTextSelected: {
    color: '#006b2c',
  },
  noOrderDot: {
    width: 3,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: '#334155',
    marginTop: 3,
  },
  reportSection: {
    backgroundColor: '#0f172a',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#1e293b',
    padding: 14,
  },
  reportHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  reportDateTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#f8fafc',
  },
  reportDateSub: {
    fontSize: 11,
    color: '#94a3b8',
    marginTop: 2,
  },
  refreshReportBtn: {
    padding: 6,
    backgroundColor: '#1e293b',
    borderRadius: 6,
  },
  loadingBox: {
    alignItems: 'center',
    paddingVertical: 30,
  },
  loadingText: {
    fontSize: 12,
    color: '#94a3b8',
    marginTop: 8,
  },
  emptyReportBox: {
    alignItems: 'center',
    paddingVertical: 36,
  },
  emptyTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#94a3b8',
    marginTop: 8,
  },
  metricGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12,
  },
  metricCard: {
    flex: 1,
    minWidth: '47%',
    backgroundColor: '#1e293b',
    borderRadius: 10,
    borderLeftWidth: 3,
    padding: 10,
  },
  metricIconRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  metricCardLabel: {
    fontSize: 11,
    color: '#94a3b8',
    fontWeight: '600',
  },
  metricCardVal: {
    fontSize: 16,
    fontWeight: '800',
    color: '#f8fafc',
    marginTop: 4,
  },
  metricCardSub: {
    fontSize: 9,
    color: '#64748b',
    marginTop: 2,
  },
  ordersFilterRow: {
    flexDirection: 'row',
    gap: 6,
    marginVertical: 10,
  },
  orderFilterChip: {
    backgroundColor: '#1e293b',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  orderFilterChipActive: {
    backgroundColor: '#006b2c',
  },
  orderFilterText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#94a3b8',
  },
  orderFilterTextActive: {
    color: '#fff',
  },
  ordersList: {
    gap: 8,
  },
  orderItemCard: {
    backgroundColor: '#1e293b',
    borderRadius: 10,
    padding: 10,
  },
  orderItemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  orderItemId: {
    fontSize: 13,
    fontWeight: '800',
    color: '#f8fafc',
  },
  orderItemCust: {
    fontSize: 11,
    color: '#94a3b8',
    marginTop: 1,
  },
  orderItemTotalBox: {
    alignItems: 'flex-end',
  },
  orderItemTotal: {
    fontSize: 14,
    fontWeight: '800',
    color: '#10b981',
  },
  paymentPill: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    marginTop: 3,
  },
  paymentPillPaid: {
    backgroundColor: '#064e3b',
  },
  paymentPillRejected: {
    backgroundColor: '#7f1d1d',
  },
  paymentPillPending: {
    backgroundColor: '#78350f',
  },
  paymentPillText: {
    fontSize: 9,
    fontWeight: '700',
  },
  paymentTextPaid: {
    color: '#34d399',
  },
  paymentTextRejected: {
    color: '#fca5a5',
  },
  paymentTextPending: {
    color: '#fde047',
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: 4,
  },
  detailText: {
    fontSize: 10,
    color: '#94a3b8',
    flex: 1,
  },
  noOrdersCard: {
    padding: 20,
    alignItems: 'center',
  },
  noOrdersText: {
    fontSize: 12,
    color: '#64748b',
  },
});
