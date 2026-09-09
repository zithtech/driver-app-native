import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Animated } from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { ms, vs, s } from '../../../lib/scale';
import moment from 'moment';
import { getLanguageScaledSize, isTamilLanguage } from '../../../utils/languageSizings';

// --- Header Section ---
export const HeaderSection = ({ isOnline, onToggleStatus, theme, isDark, t }: any) => {
  return (
    <View style={[styles.headerContainer, { backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : '#F0F4FF', padding: ms(8), marginBottom: vs(4) }]}>
      <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center' }}>
        <View style={[styles.onlineRing, { backgroundColor: isOnline ? '#D1FAE5' : '#FEE2E2' }]}>
          <View style={[styles.onlineDot, { backgroundColor: isOnline ? '#10B981' : '#EF4444' }]} />
        </View>
        <View style={{ flex: 1, marginLeft: ms(10) }}>
          <Text style={[styles.headerTitle, { color: theme.colors.text }]}>
            {isOnline ? t('you_are_online_header', "You're Online") : t('you_are_offline_header', "You're Offline")}
          </Text>
          <Text style={[styles.headerSubtitle, { color: theme.colors.paragraphText }]} numberOfLines={2}>
            {t('scheduled_requests_availability_msg', "You will receive scheduled ride requests as per your availability.")}
          </Text>
        </View>
      </View>
    </View>
  );
};

// --- Top Tabs Section ---
export const TopTabs = ({ activeTab, onTabChange, hasAcceptedRide, theme, isDark, t }: any) => {
  const isTa = isTamilLanguage();
  return (
    <View style={[styles.tabsWrapper, { backgroundColor: isDark ? 'rgba(255,255,255,0.1)' : '#FFF', borderColor: isDark ? theme.colors.border : '#E2E8F0' }]}>
      <TouchableOpacity 
        style={[styles.tab, activeTab === 'live' && styles.activeTab]}
        onPress={() => onTabChange('live')}
      >
        <View style={{ position: 'relative' }}>
          <Ionicons name="radio-outline" size={ms(18)} color={activeTab === 'live' ? '#2563EB' : theme.colors.textMuted} />
          {hasAcceptedRide && (
            <View style={{ position: 'absolute', top: -vs(2), right: -ms(2), width: ms(8), height: ms(8), borderRadius: ms(4), backgroundColor: '#10B981', borderWidth: 1, borderColor: isDark ? theme.colors.background : '#FFF' }} />
          )}
        </View>
        <Text 
          style={[styles.tabText, { color: activeTab === 'live' ? '#2563EB' : theme.colors.textMuted, flexShrink: isTa ? 1 : 0 }]}
          numberOfLines={isTa ? 1 : undefined}
          adjustsFontSizeToFit={isTa}
        >
          {t('accepted_ride_tab', 'Accepted Ride')}
        </Text>
      </TouchableOpacity>
      
      <TouchableOpacity 
        style={[styles.tab, activeTab === 'scheduled' && styles.activeTab, activeTab === 'scheduled' && { borderBottomColor: '#2563EB' }]}
        onPress={() => onTabChange('scheduled')}
      >
        <Ionicons name="calendar-outline" size={ms(18)} color={activeTab === 'scheduled' ? '#2563EB' : theme.colors.textMuted} />
        <Text 
          style={[styles.tabText, { color: activeTab === 'scheduled' ? '#2563EB' : theme.colors.textMuted, flexShrink: isTa ? 1 : 0 }]}
          numberOfLines={isTa ? 1 : undefined}
          adjustsFontSizeToFit={isTa}
        >
          {t('scheduled_rides_tab', 'Scheduled Rides')}
        </Text>
      </TouchableOpacity>
    </View>
  );
};

// --- Date Selector Section ---
export const DateSelectorSection = ({ selectedDate, onDateSelect, onFilterPress, onPickDatePress, availableDates = new Set(), theme, isDark, t }: any) => {
  const dates = useMemo(() => {
    const list = [];
    list.push({
      id: 'all',
      dayName: t('show_dates_label', 'Show'),
      dateNum: t('all_dates_label', 'All'),
      month: t('dates_month_label', 'Dates')
    });
    for (let i = 0; i < 3; i++) {
      const d = moment().add(i, 'days');
      list.push({
        id: d.format('YYYY-MM-DD'),
        dayName: i === 0 ? t('today_date_label', 'Today') : d.format('ddd'),
        dateNum: d.format('DD'),
        month: d.format('MMM')
      });
    }
    
    // If selectedDate is not 'all' and not in the list, add it as a custom date
    if (selectedDate && selectedDate !== 'all' && !list.find(d => d.id === selectedDate)) {
      const customD = moment(selectedDate);
      list.push({
        id: selectedDate,
        dayName: customD.format('ddd'),
        dateNum: customD.format('DD'),
        month: customD.format('MMM')
      });
    }
    return list;
  }, [selectedDate]);

  return (
    <View style={styles.sectionContainer}>
      <View style={styles.sectionHeader}>
        <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>{t('upcoming_schedule', 'Upcoming Schedule')}</Text>
        <TouchableOpacity style={[styles.filterBtn, { borderColor: isDark ? theme.colors.border : '#E2E8F0' }]} onPress={onFilterPress}>
          <Ionicons name="filter" size={ms(14)} color="#2563EB" />
          <Text style={[styles.filterBtnText, { color: '#2563EB' }]}>{t('filter_btn', 'Filter')}</Text>
        </TouchableOpacity>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.dateList}>
        {dates.map((dateItem) => {
          const isActive = selectedDate === dateItem.id;
          const hasRides = dateItem.id === 'all' ? availableDates.size > 0 : availableDates.has(dateItem.id);
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
              {hasRides && (
                <View style={{ position: 'absolute', top: vs(4), right: ms(4), width: ms(6), height: ms(6), borderRadius: ms(3), backgroundColor: '#10B981' }} />
              )}
              <Text style={[styles.dateDayText, { color: isActive ? '#BFDBFE' : theme.colors.paragraphText }]}>{dateItem.dayName}</Text>
              <Text style={[{ fontSize: dateItem.id === 'all' ? ms(12) : ms(14), fontWeight: '700', marginVertical: vs(0) }, { color: isActive ? '#FFF' : theme.colors.text }]}>{dateItem.dateNum}</Text>
              <Text style={[styles.dateMonthText, { color: isActive ? '#BFDBFE' : theme.colors.paragraphText }]}>{dateItem.month}</Text>
            </TouchableOpacity>
          );
        })}
        <TouchableOpacity 
          style={[styles.dateCard, { backgroundColor: isDark ? theme.colors.card : '#FFF', borderColor: isDark ? theme.colors.border : '#E2E8F0', justifyContent: 'center' }]}
          onPress={onPickDatePress}
        >
          <Ionicons name="calendar-outline" size={ms(20)} color={theme.colors.textMuted} style={{ alignSelf: 'center', marginBottom: vs(2) }}/>
          <Text style={[styles.dateDayText, { color: theme.colors.textMuted }]}>{t('pick_date_label', 'Pick Date')}</Text>
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
        <Text style={[styles.statLabel, { color: theme.colors.paragraphText }]}>{t('total_rides_stat', 'Total Rides')}</Text>
      </View>
      <View style={styles.statDivider} />
      <View style={styles.statItem}>
        <Ionicons name="time-outline" size={ms(18)} color="#8B5CF6" />
        <Text style={[styles.statValue, { color: theme.colors.text }]}>{stats.totalTime || '0h'}</Text>
        <Text style={[styles.statLabel, { color: theme.colors.paragraphText }]}>{t('total_time_stat', 'Total Time')}</Text>
      </View>
      <View style={styles.statDivider} />
      <View style={styles.statItem}>
        <Ionicons name="map-outline" size={ms(18)} color="#10B981" />
        <Text style={[styles.statValue, { color: theme.colors.text }]}>{stats.totalDistance || 0} km</Text>
        <Text style={[styles.statLabel, { color: theme.colors.paragraphText }]}>{t('total_distance_stat', 'Total Distance')}</Text>
      </View>
      <View style={styles.statDivider} />
      <View style={styles.statItem}>
        <Ionicons name="cash-outline" size={ms(18)} color="#10B981" />
        <Text style={[styles.statValue, { color: theme.colors.text }]}>₹{stats.estEarnings || 0}</Text>
        <Text style={[styles.statLabel, { color: theme.colors.paragraphText }]}>{t('est_earnings_stat', 'Est. Earnings')}</Text>
        <Ionicons name="information-circle-outline" size={ms(12)} color={theme.colors.textMuted} style={{ position: 'absolute', right: ms(2), bottom: vs(2) }} />
      </View>
      {!!stats.driverAllowance && stats.driverAllowance > 0 && (
        <>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Ionicons name="wallet-outline" size={ms(18)} color="#D97706" />
            <Text style={[styles.statValue, { color: theme.colors.text }]}>₹{stats.driverAllowance}</Text>
            <Text style={[styles.statLabel, { color: theme.colors.paragraphText }]}>{t('allowance_stat', 'Allowance')}</Text>
          </View>
        </>
      )}
    </View>
  );
};

// --- Scheduled Ride Card ---
export const ScheduledRideCard = ({ item, getRemainingTime, theme, isDark, t, onPress, activeTab }: any) => {
  const startTimeObj = moment(item.startTime);
  const remainingTime = getRemainingTime ? getRemainingTime(item.startTime) : { text: '', isUrgent: false };
  const timeText = remainingTime?.text?.replace(/\s*left\s*/i, '')?.replace(t('left'), '')?.trim() || '';
  const pickupLabel = remainingTime?.text?.toLowerCase().includes('now') || timeText.toLowerCase().includes('now') 
    ? remainingTime.text 
    : `${t('pickup_in_prefix', 'Pickup in ')}${timeText}`;

  const getRideTypeLabel = (type: string) => {
    const map: any = {
      'one_way': t('one_way_label', 'One-Way'),
      'round_trip': t('round_trip_label', 'Round-Trip'),
      'outstation_one_way': t('outstation_one_way_label', 'Outstation\nOne-Way'),
      'outstation_round_trip': t('outstation_round_trip_label', 'Outstation\nRound-Trip')
    };
    return map[type?.toLowerCase()] || type || t('one_way_label', 'One-Way');
  };

  const isLive = activeTab === 'live';

  return (
    <TouchableOpacity 
      style={[styles.rideCard, { backgroundColor: 'transparent', borderColor: isLive ? '#10B981' : (isDark ? theme.colors.border : '#E2E8F0'), padding: ms(12), marginHorizontal: ms(8) }]}
      onPress={() => onPress(item)}
      activeOpacity={0.8}
    >
      <View style={[styles.cardRow, { alignItems: 'center' }]}>
        {/* Left Side: Time & Date */}
        <View style={[styles.timeCol, { borderRightWidth: 1, borderRightColor: isDark ? theme.colors.border : '#F3F4F6', paddingRight: ms(12), marginRight: ms(12), width: undefined }]}>
          {isLive && (
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: vs(4) }}>
              <View style={{ width: ms(6), height: ms(6), borderRadius: ms(3), backgroundColor: '#10B981', marginRight: s(4) }} />
              <Text style={{ fontSize: getLanguageScaledSize(9), color: '#10B981', fontWeight: '800' }}>{t('live_badge', 'LIVE')}</Text>
            </View>
          )}
          <Text style={[styles.cardTimeText, { color: theme.colors.text }]}>{startTimeObj.format('hh:mm')}</Text>
          <Text style={[styles.cardAmPmText, { color: theme.colors.text }]}>{startTimeObj.format('A')}</Text>
          <View style={{ width: ms(24), height: 1, backgroundColor: isDark ? theme.colors.border : '#E2E8F0', marginVertical: vs(6) }} />
          <Text style={[styles.cardDateText, { color: theme.colors.textMuted, marginTop: 0 }]}>{startTimeObj.format('ddd, DD MMM')}</Text>
        </View>

        {/* Right Side: Details */}
        <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center' }}>
          <View style={{ flex: 1 }}>
            {/* Addresses */}
            <View style={{ flexDirection: 'row' }}>
              <View style={styles.timelineGraphic}>
                <View style={[styles.dot, { backgroundColor: '#10B981', marginTop: vs(4) }]} />
                <View style={[styles.line, { backgroundColor: isDark ? theme.colors.border : '#F3F4F6', height: vs(16) }]} />
                <View style={[styles.dot, { backgroundColor: '#EF4444' }]} />
              </View>
              <View style={styles.addressList}>
                <Text style={[styles.addressText, { color: theme.colors.text, marginBottom: vs(8) }]} numberOfLines={2}>
                  {item.pickup_address}
                </Text>
                <Text style={[styles.addressText, { color: theme.colors.text }]} numberOfLines={2}>
                  {item.drop_address}
                </Text>
              </View>
            </View>

            {/* Badges */}
            <View style={[styles.badgesRow, { marginTop: vs(8) }]}>
              <View style={[styles.badge, { backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : '#F1F5F9' }]}>
                <Text style={[styles.badgeText, { color: isDark ? theme.colors.textMuted : '#64748B' }]}>{getRideTypeLabel(item.ride_type)}</Text>
              </View>
              
              <View style={[styles.badge, { backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : '#F1F5F9' }]}>
                <Ionicons name="map-outline" size={ms(10)} color={isDark ? theme.colors.textMuted : '#64748B'} />
                <Text style={[styles.badgeText, { color: isDark ? theme.colors.textMuted : '#64748B', marginLeft: s(4) }]}>
                  {`${item.distance_km || 0} km`}
                </Text>
              </View>

              <View style={[styles.badge, { backgroundColor: '#D1FAE5' }]}>
                <Ionicons name="cash-outline" size={ms(10)} color="#10B981" />
                <Text style={[styles.badgeText, { color: '#10B981', marginLeft: s(4) }]}>
                  {`₹${item.total_fare || 0}`}
                </Text>
              </View>
              {!!item.driver_allowance && item.driver_allowance > 0 && (
                <View style={{ justifyContent: 'center', marginLeft: s(4) }}>
                  <Text style={[styles.badgeText, { color: '#D97706' }]}>
                    {`+₹${Math.round(item.driver_allowance)}`}
                  </Text>
                </View>
              )}
            </View>
          </View>
        </View>
      </View>

      {/* Footer Divider */}
      <View style={{ height: 1, backgroundColor: isDark ? theme.colors.border : '#F3F4F6', marginVertical: vs(8), marginTop: vs(12) }} />
      
      {/* Footer Row */}
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingBottom: vs(2) }}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <Ionicons name="time-outline" size={ms(16)} color={theme.colors.textMuted} />
          <Text style={{ marginLeft: s(6), fontSize: getLanguageScaledSize(12), color: theme.colors.text, fontWeight: '600' }}>
            {pickupLabel.startsWith(t('pickup_in_prefix', 'Pickup in ')) ? t('pickup_in_prefix', 'Pickup in ') : ''}
            <Text style={{ color: remainingTime?.isUrgent ? '#EF4444' : '#10B981' }}>
              {pickupLabel.startsWith(t('pickup_in_prefix', 'Pickup in ')) ? pickupLabel.replace(t('pickup_in_prefix', 'Pickup in '), '') : pickupLabel}
            </Text>
          </Text>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <Text style={{ color: '#2563EB', fontSize: getLanguageScaledSize(12), fontWeight: '600', marginRight: s(4) }}>{t('view_details_btn', 'View Details')}</Text>
          <Ionicons name="chevron-forward" size={ms(14)} color="#2563EB" />
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
    fontSize: getLanguageScaledSize(14),
    fontWeight: '700',
  },
  headerSubtitle: {
    fontSize: getLanguageScaledSize(10),
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
    fontSize: getLanguageScaledSize(12),
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
    fontSize: getLanguageScaledSize(14),
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
    fontSize: getLanguageScaledSize(16),
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
    fontSize: getLanguageScaledSize(12),
    fontWeight: '600',
  },
  dateList: {
    paddingHorizontal: ms(16),
    justifyContent: 'space-between',
    flexGrow: 1,
  },
  dateCard: {
    width: ms(52),
    height: ms(52),
    borderRadius: ms(10),
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
  },
  dateDayText: {
    fontSize: getLanguageScaledSize(8),
    fontWeight: '500',
  },
  dateNumText: {
    fontSize: getLanguageScaledSize(16),
    fontWeight: '700',
    marginVertical: vs(0),
  },
  dateMonthText: {
    fontSize: getLanguageScaledSize(8),
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
    fontSize: getLanguageScaledSize(12),
    fontWeight: '700',
    marginTop: vs(4),
    marginBottom: vs(2),
  },
  statLabel: {
    fontSize: getLanguageScaledSize(9),
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
  },
  cardRow: {
    flexDirection: 'row',
  },
  timeCol: {
    width: ms(50),
    alignItems: 'center',
  },
  cardTimeText: {
    fontSize: getLanguageScaledSize(14),
    fontWeight: '700',
  },
  cardAmPmText: {
    fontSize: getLanguageScaledSize(10),
    fontWeight: '700',
  },
  cardDateText: {
    fontSize: getLanguageScaledSize(9),
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
    height: vs(16),
    marginVertical: vs(2),
  },
  addressList: {
    flex: 1,
  },
  addressText: {
    fontSize: getLanguageScaledSize(11),
    lineHeight: vs(14),
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
    paddingHorizontal: ms(6),
    paddingVertical: vs(3),
    borderRadius: ms(12),
  },
  badgeText: {
    fontSize: getLanguageScaledSize(9),
    fontWeight: '600',
    textAlign: 'center',
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
    fontSize: getLanguageScaledSize(10),
    fontWeight: '600',
  },
  otpTimeText: {
    fontSize: getLanguageScaledSize(11),
    fontWeight: '600',
  },
  otpSubText: {
    fontSize: getLanguageScaledSize(10),
    marginTop: vs(2),
  },
  distanceText: {
    fontSize: getLanguageScaledSize(12),
    fontWeight: '700',
  },
  distanceSubText: {
    fontSize: getLanguageScaledSize(10),
    marginTop: vs(2),
  },
});
