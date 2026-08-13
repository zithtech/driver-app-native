import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Animated } from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { ms, vs, s } from '../../../lib/scale';
import moment from 'moment';

// --- Header Section ---
export const HeaderSection = ({ isOnline, onToggleStatus, theme, isDark, t }: any) => {
  return (
    <View style={[styles.headerContainer, { backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : '#F0F4FF' }]}>
      <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center' }}>
        <View style={styles.onlineRing}>
          <View style={[styles.onlineDot, !isOnline && { backgroundColor: '#EF4444' }]} />
        </View>
        <View style={{ flex: 1, marginLeft: ms(12) }}>
          <Text style={[styles.headerTitle, { color: theme.colors.text }]}>
            {isOnline ? "You're Online" : "You're Offline"}
          </Text>
          <Text style={[styles.headerSubtitle, { color: theme.colors.paragraphText }]}>
            You will receive scheduled ride requests as per your availability.
          </Text>
        </View>
      </View>
    </View>
  );
};

// --- Top Tabs Section ---
export const TopTabs = ({ activeTab, onTabChange, theme, isDark, t }: any) => {
  return (
    <View style={[styles.tabsWrapper, { backgroundColor: isDark ? 'rgba(255,255,255,0.1)' : '#FFF', borderColor: isDark ? theme.colors.border : '#E2E8F0' }]}>
      <TouchableOpacity 
        style={[styles.tab, activeTab === 'live' && styles.activeTab]}
        onPress={() => onTabChange('live')}
      >
        <Ionicons name="radio-outline" size={ms(18)} color={activeTab === 'live' ? '#2563EB' : theme.colors.textMuted} />
        <Text style={[styles.tabText, { color: activeTab === 'live' ? '#2563EB' : theme.colors.textMuted }]}>
          Live Rides
        </Text>
      </TouchableOpacity>
      
      <TouchableOpacity 
        style={[styles.tab, activeTab === 'scheduled' && styles.activeTab, activeTab === 'scheduled' && { borderBottomColor: '#2563EB' }]}
        onPress={() => onTabChange('scheduled')}
      >
        <Ionicons name="calendar-outline" size={ms(18)} color={activeTab === 'scheduled' ? '#2563EB' : theme.colors.textMuted} />
        <Text style={[styles.tabText, { color: activeTab === 'scheduled' ? '#2563EB' : theme.colors.textMuted }]}>
          Scheduled Rides
        </Text>
      </TouchableOpacity>
    </View>
  );
};

// --- Date Selector Section ---
export const DateSelectorSection = ({ selectedDate, onDateSelect, onFilterPress, theme, isDark, t }: any) => {
  const dates = useMemo(() => {
    const list = [];
    for (let i = 0; i < 4; i++) {
      const d = moment().add(i, 'days');
      list.push({
        id: d.format('YYYY-MM-DD'),
        dayName: i === 0 ? 'Today' : d.format('ddd'),
        dateNum: d.format('DD'),
        month: d.format('MMM')
      });
    }
    return list;
  }, []);

  return (
    <View style={styles.sectionContainer}>
      <View style={styles.sectionHeader}>
        <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Upcoming Schedule</Text>
        <TouchableOpacity style={[styles.filterBtn, { borderColor: isDark ? theme.colors.border : '#E2E8F0' }]} onPress={onFilterPress}>
          <Ionicons name="filter" size={ms(14)} color="#2563EB" />
          <Text style={[styles.filterBtnText, { color: '#2563EB' }]}>Filter</Text>
        </TouchableOpacity>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.dateList}>
        {dates.map((dateItem) => {
          const isActive = selectedDate === dateItem.id;
          return (
            <TouchableOpacity
              key={dateItem.id}
              style={[
                styles.dateCard,
                { 
                  backgroundColor: isActive ? '#2563EB' : (isDark ? theme.colors.card : '#FFF'),
                  borderColor: isActive ? '#2563EB' : (isDark ? theme.colors.border : '#E2E8F0')
                }
              ]}
              onPress={() => onDateSelect(dateItem.id)}
            >
              <Text style={[styles.dateDayText, { color: isActive ? '#BFDBFE' : theme.colors.paragraphText }]}>{dateItem.dayName}</Text>
              <Text style={[styles.dateNumText, { color: isActive ? '#FFF' : theme.colors.text }]}>{dateItem.dateNum}</Text>
              <Text style={[styles.dateMonthText, { color: isActive ? '#BFDBFE' : theme.colors.paragraphText }]}>{dateItem.month}</Text>
            </TouchableOpacity>
          );
        })}
        <TouchableOpacity style={[styles.dateCard, { backgroundColor: isDark ? theme.colors.card : '#FFF', borderColor: isDark ? theme.colors.border : '#E2E8F0', justifyContent: 'center' }]}>
          <Ionicons name="calendar-outline" size={ms(24)} color={theme.colors.textMuted} style={{ alignSelf: 'center', marginBottom: vs(4) }}/>
          <Text style={[styles.dateDayText, { color: theme.colors.textMuted }]}>Pick Date</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
};

// --- Stats Row ---
export const StatsRow = ({ stats, theme, isDark, t }: any) => {
  return (
    <View style={[styles.statsContainer, { backgroundColor: isDark ? theme.colors.card : '#FFF', borderColor: isDark ? theme.colors.border : '#E2E8F0' }]}>
      <View style={styles.statItem}>
        <Ionicons name="calendar-outline" size={ms(18)} color="#3B82F6" />
        <Text style={[styles.statValue, { color: theme.colors.text }]}>{stats.totalRides || 0}</Text>
        <Text style={[styles.statLabel, { color: theme.colors.paragraphText }]}>Total Rides</Text>
      </View>
      <View style={styles.statDivider} />
      <View style={styles.statItem}>
        <Ionicons name="time-outline" size={ms(18)} color="#8B5CF6" />
        <Text style={[styles.statValue, { color: theme.colors.text }]}>{stats.totalTime || '0h'}</Text>
        <Text style={[styles.statLabel, { color: theme.colors.paragraphText }]}>Total Time</Text>
      </View>
      <View style={styles.statDivider} />
      <View style={styles.statItem}>
        <Ionicons name="map-outline" size={ms(18)} color="#10B981" />
        <Text style={[styles.statValue, { color: theme.colors.text }]}>{stats.totalDistance || 0} km</Text>
        <Text style={[styles.statLabel, { color: theme.colors.paragraphText }]}>Total Distance</Text>
      </View>
      <View style={styles.statDivider} />
      <View style={styles.statItem}>
        <Ionicons name="cash-outline" size={ms(18)} color="#10B981" />
        <Text style={[styles.statValue, { color: theme.colors.text }]}>₹{stats.estEarnings || 0}</Text>
        <Text style={[styles.statLabel, { color: theme.colors.paragraphText }]}>Est. Earnings</Text>
        <Ionicons name="information-circle-outline" size={ms(12)} color={theme.colors.textMuted} style={{ position: 'absolute', right: ms(2), bottom: vs(2) }} />
      </View>
    </View>
  );
};

// --- Scheduled Ride Card ---
export const ScheduledRideCard = ({ item, getRemainingTime, theme, isDark, t, onPress }: any) => {
  const { text: timeText, isUrgent } = getRemainingTime(item.startTime);
  const startTimeObj = moment(item.startTime);
  const timeStr = startTimeObj.format('hh:mm A');
  const dateStr = startTimeObj.calendar(null, {
    sameDay: '[Today] DD MMM',
    nextDay: '[Tomorrow] DD MMM',
    nextWeek: 'ddd DD MMM',
    lastDay: '[Yesterday] DD MMM',
    lastWeek: 'ddd DD MMM',
    sameElse: 'DD MMM'
  });

  const getRideTypeLabel = (type: string) => {
    const map: any = {
      'one_way': 'One-way',
      'round_trip': 'Round-trip',
      'outstation_one_way': 'Outstation One-way',
      'outstation_round_trip': 'Outstation Round-trip'
    };
    return map[type?.toLowerCase()] || type || 'One-way';
  };

  const getStatusColor = (status: string) => {
    if (status === 'ACCEPTED' || status === 'PENDING') return '#F59E0B'; // Orange
    return '#2563EB'; // Blue for Upcoming
  };

  const getStatusText = (status: string) => {
    if (status === 'ACCEPTED') return 'Pending'; // Matches design where accepted but not started is pending/upcoming
    return 'Upcoming';
  };

  const isAccepted = item.trip_status === 'ACCEPTED';
  const displayStatus = isAccepted ? 'Pending' : 'Upcoming';
  const statusColor = getStatusColor(displayStatus);

  return (
    <TouchableOpacity 
      style={[styles.rideCard, { backgroundColor: isDark ? theme.colors.card : '#FFF', borderColor: isDark ? theme.colors.border : '#F3F4F6' }]}
      onPress={() => onPress(item)}
      activeOpacity={0.8}
    >
      <View style={styles.cardRow}>
        {/* Left Side: Time */}
        <View style={styles.timeCol}>
          <Text style={[styles.cardTimeText, { color: theme.colors.text }]}>{startTimeObj.format('hh:mm')}</Text>
          <Text style={[styles.cardAmPmText, { color: theme.colors.text }]}>{startTimeObj.format('A')}</Text>
          <Text style={[styles.cardDateText, { color: theme.colors.textMuted }]}>{dateStr}</Text>
        </View>

        {/* Middle Side: Timeline & Locations */}
        <View style={styles.timelineCol}>
          <View style={styles.timelineGraphic}>
            <View style={[styles.dot, { backgroundColor: '#10B981' }]} />
            <View style={[styles.line, { backgroundColor: isDark ? theme.colors.border : '#E2E8F0' }]} />
            <View style={[styles.dot, { backgroundColor: '#EF4444' }]} />
          </View>
          <View style={styles.addressList}>
            <Text style={[styles.addressText, { color: theme.colors.text, marginBottom: vs(24) }]} numberOfLines={2}>
              {item.pickup_address}
            </Text>
            <Text style={[styles.addressText, { color: theme.colors.text }]} numberOfLines={2}>
              {item.drop_address}
            </Text>
            
            <View style={styles.badgesRow}>
              <View style={[styles.badge, { backgroundColor: '#E0E7FF' }]}>
                <Text style={[styles.badgeText, { color: '#4F46E5' }]}>{getRideTypeLabel(item.ride_type)}</Text>
              </View>
              <View style={[styles.badge, { backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : '#F1F5F9' }]}>
                <Ionicons name="person-outline" size={ms(10)} color={isDark ? theme.colors.textMuted : '#64748B'} />
                <Text style={[styles.badgeText, { color: isDark ? theme.colors.textMuted : '#64748B', marginLeft: s(4) }]}>
                  {item.passenger_count || 1} Passenger
                </Text>
              </View>
            </View>
          </View>
        </View>

        {/* Right Side: Status & Distance */}
        <View style={styles.statusCol}>
          <View style={[styles.statusBadge, { backgroundColor: statusColor }]}>
            <Text style={styles.statusBadgeText}>{displayStatus}</Text>
          </View>
          
          <View style={{ alignItems: 'flex-end', marginTop: vs(12) }}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Ionicons name="time-outline" size={ms(12)} color={theme.colors.textMuted} />
              <Text style={[styles.otpTimeText, { color: theme.colors.text }]}> {timeStr}</Text>
            </View>
            <Text style={[styles.otpSubText, { color: theme.colors.textMuted }]}>OTP at Pickup</Text>
          </View>
          
          <View style={{ alignItems: 'flex-end', marginTop: vs(12), flexDirection: 'row', justifyContent: 'flex-end', gap: ms(4) }}>
            <View style={{ alignItems: 'flex-end' }}>
               <Text style={[styles.distanceText, { color: theme.colors.text }]}>{Math.round(item.distance_km || 0)} km</Text>
               <Text style={[styles.distanceSubText, { color: theme.colors.textMuted }]}>Est. Distance</Text>
            </View>
            <Ionicons name="chevron-forward" size={ms(16)} color={theme.colors.textMuted} style={{ alignSelf: 'center' }} />
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );
};


const styles = StyleSheet.create({
  // Header
  headerContainer: {
    padding: ms(10),
    borderRadius: ms(12),
    marginHorizontal: ms(16),
    marginBottom: vs(8),
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  onlineRing: {
    width: ms(24),
    height: ms(24),
    borderRadius: ms(12),
    backgroundColor: '#DBEAFE',
    justifyContent: 'center',
    alignItems: 'center',
  },
  onlineDot: {
    width: ms(10),
    height: ms(10),
    borderRadius: ms(5),
    backgroundColor: '#2563EB',
  },
  headerTitle: {
    fontSize: ms(14),
    fontWeight: '700',
  },
  headerSubtitle: {
    fontSize: ms(10),
    marginTop: vs(0),
    lineHeight: vs(12),
  },
  offlineBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: ms(12),
    paddingVertical: vs(8),
    borderRadius: ms(20),
    gap: ms(4),
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  offlineBtnText: {
    fontSize: ms(12),
    fontWeight: '600',
  },

  // Tabs
  tabsWrapper: {
    flexDirection: 'row',
    marginHorizontal: ms(16),
    borderRadius: ms(12),
    borderWidth: 1,
    overflow: 'hidden',
    marginTop: vs(8),
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: vs(8),
    gap: ms(6),
  },
  activeTab: {
    borderBottomWidth: 2,
  },
  tabText: {
    fontSize: ms(14),
    fontWeight: '600',
  },

  // Date Selector
  sectionContainer: {
    paddingTop: vs(10),
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: ms(16),
    marginBottom: vs(8),
  },
  sectionTitle: {
    fontSize: ms(16),
    fontWeight: '700',
  },
  filterBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    paddingHorizontal: ms(12),
    paddingVertical: vs(6),
    borderRadius: ms(20),
    gap: ms(4),
  },
  filterBtnText: {
    fontSize: ms(12),
    fontWeight: '600',
  },
  dateList: {
    paddingHorizontal: ms(16),
    justifyContent: 'space-between',
    flexGrow: 1,
  },
  dateCard: {
    width: ms(56),
    height: ms(56),
    borderRadius: ms(10),
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
  },
  dateDayText: {
    fontSize: ms(9),
    fontWeight: '500',
  },
  dateNumText: {
    fontSize: ms(16),
    fontWeight: '700',
    marginVertical: vs(0),
  },
  dateMonthText: {
    fontSize: ms(9),
    fontWeight: '500',
  },

  // Stats Row
  statsContainer: {
    flexDirection: 'row',
    marginHorizontal: ms(16),
    marginVertical: vs(10),
    borderRadius: ms(10),
    padding: ms(8),
    borderWidth: 1,
    justifyContent: 'space-between',
  },
  statItem: {
    alignItems: 'center',
    flex: 1,
  },
  statValue: {
    fontSize: ms(12),
    fontWeight: '700',
    marginTop: vs(4),
    marginBottom: vs(2),
  },
  statLabel: {
    fontSize: ms(9),
  },
  statDivider: {
    width: 1,
    backgroundColor: '#E2E8F0',
    marginHorizontal: ms(2),
    marginVertical: vs(8),
  },

  // Ride Card
  rideCard: {
    marginHorizontal: ms(16),
    marginBottom: vs(8),
    borderRadius: ms(12),
    padding: ms(10),
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
  },
  cardRow: {
    flexDirection: 'row',
  },
  timeCol: {
    width: ms(50),
    alignItems: 'center',
  },
  cardTimeText: {
    fontSize: ms(16),
    fontWeight: '700',
  },
  cardAmPmText: {
    fontSize: ms(12),
    fontWeight: '700',
  },
  cardDateText: {
    fontSize: ms(10),
    marginTop: vs(4),
    textAlign: 'center',
  },
  timelineCol: {
    flex: 1,
    flexDirection: 'row',
    paddingHorizontal: ms(6),
    borderLeftWidth: 1,
    borderLeftColor: '#F3F4F6',
  },
  timelineGraphic: {
    width: ms(12),
    alignItems: 'center',
    marginRight: ms(8),
    marginTop: vs(4),
  },
  dot: {
    width: ms(6),
    height: ms(6),
    borderRadius: ms(3),
  },
  line: {
    width: 1,
    height: vs(24),
    marginVertical: vs(2),
  },
  addressList: {
    flex: 1,
  },
  addressText: {
    fontSize: ms(12),
    lineHeight: vs(16),
    fontWeight: '500',
  },
  badgesRow: {
    flexDirection: 'row',
    marginTop: vs(6),
    gap: ms(4),
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: ms(8),
    paddingVertical: vs(4),
    borderRadius: ms(12),
  },
  badgeText: {
    fontSize: ms(10),
    fontWeight: '600',
  },
  statusCol: {
    width: ms(90),
    alignItems: 'flex-end',
    justifyContent: 'space-between',
  },
  statusBadge: {
    paddingHorizontal: ms(12),
    paddingVertical: vs(4),
    borderRadius: ms(12),
  },
  statusBadgeText: {
    color: '#FFF',
    fontSize: ms(10),
    fontWeight: '600',
  },
  otpTimeText: {
    fontSize: ms(11),
    fontWeight: '600',
  },
  otpSubText: {
    fontSize: ms(10),
    marginTop: vs(2),
  },
  distanceText: {
    fontSize: ms(12),
    fontWeight: '700',
  },
  distanceSubText: {
    fontSize: ms(10),
    marginTop: vs(2),
  },
});
