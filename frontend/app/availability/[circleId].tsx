import { useCallback, useEffect, useState } from 'react';

import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';

import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import {
  ActivityIndicator,
  Alert,
  Modal,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Calendar, DateData } from 'react-native-calendars';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAuth } from '@/hooks/use-auth';
import { availabilityApi } from '@/lib/api';

interface AvailabilityBlock {
  id: string;
  user_id: string;
  date: string;
  hour_block: number;
  is_available: boolean;
  user?: {
    id: string;
    display_name: string;
    first_name: string | null;
    last_name: string | null;
  } | null;
}

export default function AvailabilityManagementScreen() {
  const { circleId } = useLocalSearchParams<{ circleId: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  // Get today's date in YYYY-MM-DD format (local timezone)
  const getTodayDate = () => {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const [selectedDate, setSelectedDate] = useState<string>(getTodayDate());
  const [selectedHourBlocks, setSelectedHourBlocks] = useState<Set<number>>(new Set());
  const [availabilityData, setAvailabilityData] = useState<AvailabilityBlock[]>([]);
  const [markedDates, setMarkedDates] = useState<Record<string, any>>({});
  const [showBulkSetModal, setShowBulkSetModal] = useState(false);
  const [bulkStartDate, setBulkStartDate] = useState<string>(getTodayDate());
  const [bulkEndDate, setBulkEndDate] = useState<string>('');
  const [bulkDayFilter, setBulkDayFilter] = useState<
    'all' | 'weekdays' | 'weekends' | 'custom'
  >('all');
  const [selectedDaysOfWeek, setSelectedDaysOfWeek] = useState<Set<number>>(new Set());
  const [bulkDatePickerMode, setBulkDatePickerMode] = useState<'start' | 'end' | null>(null);

  // Fetch existing availability for the current month
  const fetchAvailability = useCallback(async () => {
    if (!circleId) return;

    try {
      setLoading(true);
      const now = new Date();
      const year = now.getFullYear();
      const month = now.getMonth();
      const startDate = new Date(year, month, 1).toISOString().split('T')[0];
      const endDate = new Date(year, month + 1, 0).toISOString().split('T')[0];

      const data = await availabilityApi.getCircleAvailability(circleId, startDate, endDate);
      
      // Filter to only current user's availability
      const userAvailability = (data || []).filter(
        (item: any) => item.user?.id === user?.id || item.user_id === user?.id,
      );

      setAvailabilityData(userAvailability);

      // Build marked dates for calendar
      const marked: Record<string, any> = {};
      userAvailability.forEach((item: AvailabilityBlock) => {
        if (item.is_available) {
          if (!marked[item.date]) {
            marked[item.date] = { marked: true, dotColor: '#10B981' };
          }
        }
      });
      setMarkedDates(marked);
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to load availability');
    } finally {
      setLoading(false);
    }
  }, [circleId, user?.id]);

  useEffect(() => {
    fetchAvailability();
  }, [fetchAvailability]);

  useFocusEffect(
    useCallback(() => {
      fetchAvailability();
    }, [fetchAvailability]),
  );

  // Load hour blocks for selected date
  useEffect(() => {
    if (!selectedDate) return;

    const dateAvailability = availabilityData.filter(
      (item) => item.date === selectedDate && item.is_available,
    );
    const hourBlocks = new Set(dateAvailability.map((item) => item.hour_block));
    setSelectedHourBlocks(hourBlocks);
  }, [selectedDate, availabilityData]);

  const toggleHourBlock = (hour: number) => {
    const newSet = new Set(selectedHourBlocks);
    if (newSet.has(hour)) {
      newSet.delete(hour);
    } else {
      newSet.add(hour);
    }
    setSelectedHourBlocks(newSet);
  };

  const formatHour = (hour: number): string => {
    if (hour === 0) return '12 AM';
    if (hour < 12) return `${hour} AM`;
    if (hour === 12) return '12 PM';
    return `${hour - 12} PM`;
  };

  const handleSave = async () => {
    if (!circleId || !selectedDate) return;

    // Prevent saving availability for past dates (allow today and future dates)
    const today = getTodayDate();
    if (selectedDate < today) {
      Alert.alert('Invalid Date', 'You cannot modify availability for past dates.');
      return;
    }
    // Today and future dates are allowed

    try {
      setSaving(true);

      // Get existing availability blocks for this date to update/delete
      const existingBlocks = availabilityData.filter(
        (item) => item.date === selectedDate && item.user_id === user?.id,
      );

      // If no hours are selected, delete all availability for this date
      if (selectedHourBlocks.size === 0) {
        // Delete all existing blocks for this date
        for (const block of existingBlocks) {
          try {
            await availabilityApi.deleteAvailabilityBlock(block.id);
          } catch (error) {
            // Continue even if delete fails
          }
        }
        Alert.alert('Success', 'Availability removed for this date');
        await fetchAvailability();
        setSaving(false);
        return;
      }

      // Delete blocks that are no longer selected
      const blocksToDelete = existingBlocks.filter(
        (item) => !selectedHourBlocks.has(item.hour_block),
      );
      for (const block of blocksToDelete) {
        try {
          await availabilityApi.deleteAvailabilityBlock(block.id);
        } catch (error) {
          // Continue even if delete fails
        }
      }

      // Update blocks that changed from unavailable to available
      const blocksToUpdate = existingBlocks.filter(
        (item) => selectedHourBlocks.has(item.hour_block) && !item.is_available,
      );
      for (const block of blocksToUpdate) {
        try {
          await availabilityApi.updateAvailabilityBlock(block.id, true);
        } catch (error) {
          // Continue even if update fails
        }
      }

      // Create new blocks for selected hours that don't exist
      const existingHourBlocks = new Set(
        existingBlocks.filter((item) => item.is_available).map((item) => item.hour_block),
      );
      const newHourBlocks = Array.from(selectedHourBlocks).filter(
        (hour) => !existingHourBlocks.has(hour),
      );

      if (newHourBlocks.length > 0) {
        await availabilityApi.setAvailability(circleId, {
          start_date: selectedDate,
          end_date: selectedDate,
          hour_blocks: newHourBlocks,
          is_available: true,
        });
      }

      Alert.alert('Success', 'Availability updated successfully');
      await fetchAvailability();
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to save availability');
    } finally {
      setSaving(false);
    }
  };

  const handleBulkSetOpen = () => {
    if (selectedHourBlocks.size === 0) {
      Alert.alert('Error', 'Please select at least one time block first');
      return;
    }

    if (!circleId || !selectedDate) return;

    // Initialize bulk set with selected date as start
    const today = getTodayDate();
    const startDate = selectedDate < today ? today : selectedDate;
    setBulkStartDate(startDate);

    // Set end date to end of current month by default
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth();
    const defaultEndDate = new Date(year, month + 1, 0).toISOString().split('T')[0];
    setBulkEndDate(defaultEndDate);

    setBulkDayFilter('all');
    setSelectedDaysOfWeek(new Set());
    setShowBulkSetModal(true);
  };

  const getDayOfWeek = (dateString: string): number => {
    // Parse date string (YYYY-MM-DD) and create date in local timezone
    const [year, month, day] = dateString.split('-').map(Number);
    const date = new Date(year, month - 1, day); // month is 0-indexed
    return date.getDay(); // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
  };

  const shouldIncludeDate = (dateString: string): boolean => {
    if (bulkDayFilter === 'all') {
      return true;
    }

    const dayOfWeek = getDayOfWeek(dateString);

    if (bulkDayFilter === 'weekdays') {
      // Monday (1) through Friday (5)
      return dayOfWeek >= 1 && dayOfWeek <= 5;
    }

    if (bulkDayFilter === 'weekends') {
      // Sunday (0) and Saturday (6)
      return dayOfWeek === 0 || dayOfWeek === 6;
    }

    if (bulkDayFilter === 'custom') {
      return selectedDaysOfWeek.has(dayOfWeek);
    }

    return true;
  };

  const handleBulkSetConfirm = async () => {
    if (!circleId || !bulkStartDate || !bulkEndDate) {
      Alert.alert('Error', 'Please select both start and end dates');
      return;
    }

    const today = getTodayDate();
    if (bulkStartDate < today) {
      Alert.alert('Error', 'Start date cannot be in the past');
      return;
    }

    if (bulkStartDate > bulkEndDate) {
      Alert.alert('Error', 'Start date must be before or equal to end date');
      return;
    }

    if (bulkDayFilter === 'custom' && selectedDaysOfWeek.size === 0) {
      Alert.alert('Error', 'Please select at least one day of the week');
      return;
    }

    try {
      setSaving(true);
      setShowBulkSetModal(false);

      // Generate list of dates to apply availability to
      const datesToApply: string[] = [];
      const today = getTodayDate();
      
      // Parse dates in local timezone to avoid timezone issues
      const [startYear, startMonth, startDay] = bulkStartDate.split('-').map(Number);
      const [endYear, endMonth, endDay] = bulkEndDate.split('-').map(Number);
      const startDate = new Date(startYear, startMonth - 1, startDay);
      const endDate = new Date(endYear, endMonth - 1, endDay);
      const currentDate = new Date(startDate);

      while (currentDate <= endDate) {
        // Format date as YYYY-MM-DD in local timezone
        const year = currentDate.getFullYear();
        const month = String(currentDate.getMonth() + 1).padStart(2, '0');
        const day = String(currentDate.getDate()).padStart(2, '0');
        const dateStr = `${year}-${month}-${day}`;
        
        // Only include dates that match the filter and are not in the past
        if (dateStr >= today && shouldIncludeDate(dateStr)) {
          datesToApply.push(dateStr);
        }
        currentDate.setDate(currentDate.getDate() + 1);
      }

      if (datesToApply.length === 0) {
        Alert.alert('Error', 'No valid dates found in the selected range');
        setSaving(false);
        return;
      }

      // First, get all existing availability for the date range
      const existingData = await availabilityApi.getCircleAvailability(
        circleId,
        bulkStartDate,
        bulkEndDate,
      );

      // Filter to only current user's availability and dates we're applying to
      const userAvailability = (existingData || [])
        .filter((item: any) => item.user?.id === user?.id || item.user_id === user?.id)
        .filter((item: any) => datesToApply.includes(item.date));

      // Delete all existing availability for the dates we're applying to (to replace, not add)
      for (const block of userAvailability) {
        try {
          await availabilityApi.deleteAvailabilityBlock(block.id);
        } catch (error) {
          // Continue even if delete fails
        }
      }

      // Apply availability to each date individually
      for (const dateStr of datesToApply) {
        await availabilityApi.setAvailability(circleId, {
          start_date: dateStr,
          end_date: dateStr,
          hour_blocks: Array.from(selectedHourBlocks),
          is_available: true,
        });
      }

      Alert.alert(
        'Success',
        `Availability replaced for ${datesToApply.length} day(s) from ${new Date(bulkStartDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} through ${new Date(bulkEndDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`,
      );
      await fetchAvailability();
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to set availability');
    } finally {
      setSaving(false);
    }
  };

  const toggleDayOfWeek = (day: number) => {
    const newSet = new Set(selectedDaysOfWeek);
    if (newSet.has(day)) {
      newSet.delete(day);
    } else {
      newSet.add(day);
    }
    setSelectedDaysOfWeek(newSet);
  };

  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  if (loading) {
    return (
      <View className="flex-1 items-center justify-center bg-gray-50">
        <ActivityIndicator size="large" color="#3B82F6" />
      </View>
    );
  }

  return (
    <View className="flex-1 bg-gray-50">
      {/* Header */}
      <View style={{ paddingTop: insets.top }} className="bg-blue-600 pb-6">
        <View className="flex-row items-center px-6">
          <TouchableOpacity
            onPress={() => router.back()}
            className="mr-4 h-10 w-10 items-center justify-center rounded-full bg-white/20"
          >
            <MaterialIcons name="arrow-back" size={24} color="#FFFFFF" />
          </TouchableOpacity>
          <View className="flex-1">
            <Text className="text-2xl font-bold text-white">Manage Availability</Text>
            <Text className="mt-1 text-sm text-white/90">Set your available times</Text>
          </View>
        </View>
      </View>

      <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
        {/* Calendar */}
        <View className="mx-6 mt-6 rounded-xl bg-white p-4 shadow-sm">
          <Calendar
            current={selectedDate}
            onDayPress={(day: DateData) => {
              // Allow selecting any date (past or future) for viewing
              setSelectedDate(day.dateString);
            }}
            markedDates={{
              ...markedDates,
              [selectedDate]: {
                ...markedDates[selectedDate],
                selected: true,
                selectedColor: '#3B82F6',
              },
            }}
            theme={{
              selectedDayBackgroundColor: '#3B82F6',
              todayTextColor: '#3B82F6',
              arrowColor: '#3B82F6',
              monthTextColor: '#1F2937',
              textDayFontWeight: '500',
              textMonthFontWeight: 'bold',
            }}
          />
        </View>

        {/* Selected Date Info */}
        <View className="mx-6 mt-6 rounded-xl bg-white p-4 shadow-sm">
          <Text className="mb-3 text-lg font-semibold text-gray-900">
            {new Date(selectedDate).toLocaleDateString('en-US', {
              weekday: 'long',
              year: 'numeric',
              month: 'long',
              day: 'numeric',
            })}
          </Text>

          {/* Hour Blocks Grid */}
          <View className="mb-4">
            <Text className="mb-3 text-sm font-medium text-gray-700">
              {selectedDate < getTodayDate()
                ? 'Available Hours (View Only)'
                : 'Select Available Hours (24-hour format)'}
            </Text>
            <View className="flex-row flex-wrap">
              {Array.from({ length: 24 }, (_, i) => i).map((hour) => {
                const isSelected = selectedHourBlocks.has(hour);
                const isPastDate = selectedDate < getTodayDate();
                return (
                  <TouchableOpacity
                    key={hour}
                    onPress={() => {
                      if (!isPastDate) {
                        toggleHourBlock(hour);
                      }
                    }}
                    disabled={isPastDate}
                    className={`mb-2 mr-2 rounded-lg border-2 p-3 ${
                      isSelected
                        ? 'border-blue-600 bg-blue-50'
                        : 'border-gray-300 bg-white'
                    } ${isPastDate ? 'opacity-60' : ''}`}
                  >
                    <Text
                      className={`text-sm font-semibold ${
                        isSelected ? 'text-blue-600' : 'text-gray-700'
                      }`}
                    >
                      {formatHour(hour)}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          {/* Action Buttons */}
          {selectedDate < getTodayDate() ? (
            <View className="rounded-lg border border-gray-200 bg-gray-50 p-4">
              <View className="flex-row items-center">
                <MaterialIcons name="lock" size={20} color="#6B7280" />
                <Text className="ml-2 text-sm text-gray-600">
                  Past dates are view-only. You cannot modify availability for dates that have
                  already passed.
                </Text>
              </View>
            </View>
          ) : (
            <View className="flex-row space-x-3">
              <TouchableOpacity
                onPress={handleSave}
                disabled={saving}
                className="flex-1 flex-row items-center justify-center rounded-xl bg-blue-600 py-3"
                style={{ opacity: saving ? 0.6 : 1 }}
              >
                {saving ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <>
                    <MaterialIcons
                      name={selectedHourBlocks.size === 0 ? 'delete' : 'save'}
                      size={20}
                      color="#FFFFFF"
                    />
                    <Text className="ml-2 text-base font-semibold text-white">
                      {selectedHourBlocks.size === 0 ? 'Remove All' : 'Save Day'}
                    </Text>
                  </>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                onPress={handleBulkSetOpen}
                disabled={saving || selectedHourBlocks.size === 0}
                className="flex-1 flex-row items-center justify-center rounded-xl border-2 border-blue-600 bg-white py-3"
                style={{ opacity: saving || selectedHourBlocks.size === 0 ? 0.6 : 1 }}
              >
                <MaterialIcons name="date-range" size={20} color="#3B82F6" />
                <Text className="ml-2 text-base font-semibold text-blue-600">Bulk Set</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* Info Section */}
        <View className="mx-6 mb-6 mt-4 rounded-xl bg-blue-50 p-4">
          <View className="flex-row items-start">
            <MaterialIcons name="info" size={20} color="#3B82F6" />
            <View className="ml-3 flex-1">
              <Text className="text-sm font-semibold text-blue-900">Tips</Text>
              <Text className="mt-1 text-xs text-blue-800">
                • Select hours to mark yourself as available{'\n'}
                • Deselect all hours and save to remove availability for a date{'\n'}
                • Use "Save Day" to update the selected date{'\n'}
                • Use "Bulk Set" to apply selected hours to a custom date range with day filters
              </Text>
            </View>
          </View>
        </View>
      </ScrollView>

      {/* Bulk Set Modal */}
      <Modal
        visible={showBulkSetModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowBulkSetModal(false)}
      >
        <View className="flex-1 bg-black/50">
          <View
            className="absolute bottom-0 w-full rounded-t-3xl bg-white pb-6"
            style={{ paddingBottom: Math.max(insets.bottom, 24) }}
          >
            <ScrollView className="max-h-[80%]">
              {/* Modal Header */}
              <View className="flex-row items-center justify-between border-b border-gray-200 px-6 py-4">
                <TouchableOpacity onPress={() => setShowBulkSetModal(false)}>
                  <Text className="text-base font-medium text-gray-600">Cancel</Text>
                </TouchableOpacity>
                <Text className="text-lg font-semibold text-gray-900">Bulk Set Availability</Text>
                <TouchableOpacity onPress={handleBulkSetConfirm} disabled={saving}>
                  <Text
                    className="text-base font-semibold text-blue-600"
                    style={{ opacity: saving ? 0.6 : 1 }}
                  >
                    Apply
                  </Text>
                </TouchableOpacity>
              </View>

              <View className="px-6 py-4">
                {/* Date Range Section */}
                <View className="mb-6">
                  <Text className="mb-3 text-base font-semibold text-gray-900">Date Range</Text>

                  {/* Start Date */}
                  <View className="mb-3">
                    <Text className="mb-2 text-sm font-medium text-gray-700">Start Date</Text>
                    <TouchableOpacity
                      onPress={() => setBulkDatePickerMode('start')}
                      className="rounded-xl border border-gray-300 bg-white px-4 py-3"
                    >
                      <Text className="text-base text-gray-900">
                        {bulkStartDate
                          ? new Date(bulkStartDate).toLocaleDateString('en-US', {
                              month: 'long',
                              day: 'numeric',
                              year: 'numeric',
                            })
                          : 'Select start date'}
                      </Text>
                    </TouchableOpacity>
                  </View>

                  {/* End Date */}
                  <View>
                    <Text className="mb-2 text-sm font-medium text-gray-700">End Date</Text>
                    <TouchableOpacity
                      onPress={() => setBulkDatePickerMode('end')}
                      className="rounded-xl border border-gray-300 bg-white px-4 py-3"
                    >
                      <Text className="text-base text-gray-900">
                        {bulkEndDate
                          ? new Date(bulkEndDate).toLocaleDateString('en-US', {
                              month: 'long',
                              day: 'numeric',
                              year: 'numeric',
                            })
                          : 'Select end date'}
                      </Text>
                    </TouchableOpacity>
                  </View>

                  {/* Date Picker Calendar */}
                  {bulkDatePickerMode && (
                    <View className="mt-4 rounded-xl border border-gray-200 bg-gray-50 p-4">
                      <View className="mb-3 flex-row items-center justify-between">
                        <Text className="text-sm font-semibold text-gray-900">
                          Select {bulkDatePickerMode === 'start' ? 'Start' : 'End'} Date
                        </Text>
                        <TouchableOpacity onPress={() => setBulkDatePickerMode(null)}>
                          <MaterialIcons name="close" size={20} color="#6B7280" />
                        </TouchableOpacity>
                      </View>
                      <Calendar
                        minDate={bulkDatePickerMode === 'start' ? getTodayDate() : bulkStartDate}
                        onDayPress={(day: DateData) => {
                          const today = getTodayDate();
                          if (bulkDatePickerMode === 'start') {
                            if (day.dateString < today) {
                              Alert.alert('Error', 'Start date cannot be in the past');
                              return;
                            }
                            setBulkStartDate(day.dateString);
                            if (bulkEndDate && day.dateString > bulkEndDate) {
                              setBulkEndDate('');
                            }
                          } else {
                            if (day.dateString < bulkStartDate) {
                              Alert.alert(
                                'Error',
                                'End date must be after or equal to start date',
                              );
                              return;
                            }
                            setBulkEndDate(day.dateString);
                          }
                          setBulkDatePickerMode(null);
                        }}
                        markedDates={{
                          [bulkStartDate]: {
                            selected: true,
                            selectedColor: '#3B82F6',
                          },
                          ...(bulkEndDate && {
                            [bulkEndDate]: {
                              selected: true,
                              selectedColor: '#3B82F6',
                            },
                          }),
                        }}
                        theme={{
                          selectedDayBackgroundColor: '#3B82F6',
                          todayTextColor: '#3B82F6',
                          arrowColor: '#3B82F6',
                        }}
                      />
                    </View>
                  )}
                </View>

                {/* Day Filter Section */}
                <View className="mb-6">
                  <Text className="mb-3 text-base font-semibold text-gray-900">
                    Apply to Days
                  </Text>

                  {/* Filter Options */}
                  <View className="mb-4 flex-row flex-wrap">
                    {[
                      { value: 'all', label: 'All Days' },
                      { value: 'weekdays', label: 'Weekdays' },
                      { value: 'weekends', label: 'Weekends' },
                      { value: 'custom', label: 'Custom' },
                    ].map((option) => (
                      <TouchableOpacity
                        key={option.value}
                        onPress={() => setBulkDayFilter(option.value as any)}
                        className={`mb-2 mr-2 rounded-lg border-2 px-4 py-2 ${
                          bulkDayFilter === option.value
                            ? 'border-blue-600 bg-blue-50'
                            : 'border-gray-300 bg-white'
                        }`}
                      >
                        <Text
                          className={`text-sm font-semibold ${
                            bulkDayFilter === option.value ? 'text-blue-600' : 'text-gray-700'
                          }`}
                        >
                          {option.label}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>

                  {/* Custom Day Selection */}
                  {bulkDayFilter === 'custom' && (
                    <View>
                      <Text className="mb-2 text-sm font-medium text-gray-700">
                        Select Days of Week
                      </Text>
                      <View className="flex-row flex-wrap">
                        {dayNames.map((dayName, index) => {
                          const isSelected = selectedDaysOfWeek.has(index);
                          return (
                            <TouchableOpacity
                              key={index}
                              onPress={() => toggleDayOfWeek(index)}
                              className={`mb-2 mr-2 rounded-lg border-2 px-4 py-2 ${
                                isSelected
                                  ? 'border-blue-600 bg-blue-50'
                                  : 'border-gray-300 bg-white'
                              }`}
                            >
                              <Text
                                className={`text-sm font-semibold ${
                                  isSelected ? 'text-blue-600' : 'text-gray-700'
                                }`}
                              >
                                {dayName}
                              </Text>
                            </TouchableOpacity>
                          );
                        })}
                      </View>
                    </View>
                  )}
                </View>

                {/* Preview Info */}
                <View className="rounded-lg border border-gray-200 bg-gray-50 p-4">
                  <Text className="mb-2 text-sm font-semibold text-gray-900">Preview</Text>
                  <Text className="text-xs text-gray-600">
                    Selected hours: {Array.from(selectedHourBlocks)
                      .sort((a, b) => a - b)
                      .map((h) => formatHour(h))
                      .join(', ')}
                  </Text>
                  {bulkStartDate && bulkEndDate && (
                    <Text className="mt-1 text-xs text-gray-600">
                      Date range: {new Date(bulkStartDate).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                      })}{' '}
                      -{' '}
                      {new Date(bulkEndDate).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                      })}
                    </Text>
                  )}
                  {bulkDayFilter !== 'all' && (
                    <Text className="mt-1 text-xs text-gray-600">
                      Filter: {bulkDayFilter === 'weekdays'
                        ? 'Weekdays only'
                        : bulkDayFilter === 'weekends'
                          ? 'Weekends only'
                          : 'Custom days'}
                    </Text>
                  )}
                </View>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

