import { useEffect, useState } from 'react';

import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { Calendar, DateData } from 'react-native-calendars';
import { ActivityIndicator, Text, TouchableOpacity, View } from 'react-native';

import { availabilityApi } from '@/lib/api';

interface HeatmapData {
  date: string;
  hour_blocks: Array<{
    hour_block: number;
    available_count: number;
    total_members: number;
    percentage: number;
  }>;
}

interface AvailabilityHeatmapProps {
  circleId: string;
  startDate?: string;
  endDate?: string;
  onDatePress?: (date: string) => void;
  showHourDetails?: boolean;
  onTimeSelect?: (date: string, startHour: number, endHour: number) => void;
  onTimeClear?: () => void;
  selectedDate?: string;
  selectedStartHour?: number;
  selectedEndHour?: number;
}

export default function AvailabilityHeatmap({
  circleId,
  startDate,
  endDate,
  onDatePress,
  showHourDetails = false,
  onTimeSelect,
  onTimeClear,
  selectedDate: externalSelectedDate,
  selectedStartHour,
  selectedEndHour,
}: AvailabilityHeatmapProps) {
  const [loading, setLoading] = useState(true);
  const [heatmapData, setHeatmapData] = useState<HeatmapData[]>([]);
  const [internalSelectedDate, setInternalSelectedDate] = useState<string | null>(null);
  const [maxAvailability, setMaxAvailability] = useState<number>(1);
  const [timeSelectionStart, setTimeSelectionStart] = useState<number | null>(null);
  const [previewEndHour, setPreviewEndHour] = useState<number | null>(null);
  
  // Use external selectedDate if provided, otherwise use internal state
  const selectedDate = externalSelectedDate || internalSelectedDate;

  // Calculate date range (default to current month)
  const getDateRange = () => {
    if (startDate && endDate) {
      return { start: startDate, end: endDate };
    }

    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth();
    const start = new Date(year, month, 1).toISOString().split('T')[0];
    const end = new Date(year, month + 1, 0).toISOString().split('T')[0];
    return { start, end };
  };

  useEffect(() => {
    const fetchHeatmap = async () => {
      if (!circleId) return;

      try {
        setLoading(true);
        const { start, end } = getDateRange();
        const data = await availabilityApi.getAvailabilityHeatmap(circleId, start, end);

        if (data?.heatmap) {
          setHeatmapData(data.heatmap);
          setMaxAvailability(data.total_members || 1);
        }
      } catch (error) {
        console.error('Error fetching heatmap:', error);
        setHeatmapData([]);
      } finally {
        setLoading(false);
      }
    };

    fetchHeatmap();
  }, [circleId, startDate, endDate]);

  // Calculate color intensity based on availability percentage
  const getColorIntensity = (percentage: number): string => {
    if (percentage === 0) {
      return 'transparent'; // No availability
    }

    // Use a green color scheme (you can change this to any color)
    // Darkest green (100% availability) = #10B981 (emerald-500)
    // Lightest green (low availability) = #D1FAE5 (emerald-100)

    if (percentage >= 80) {
      return '#10B981'; // emerald-500 - darkest
    } else if (percentage >= 60) {
      return '#34D399'; // emerald-400
    } else if (percentage >= 40) {
      return '#6EE7B7'; // emerald-300
    } else if (percentage >= 20) {
      return '#A7F3D0'; // emerald-200
    } else {
      return '#D1FAE5'; // emerald-100 - lightest
    }
  };

  // Get max availability count for a date (across all hours)
  const getDateMaxAvailability = (date: string): number => {
    const dateData = heatmapData.find((item) => item.date === date);
    if (!dateData || dateData.hour_blocks.length === 0) {
      return 0;
    }
    return Math.max(...dateData.hour_blocks.map((h) => h.available_count));
  };

  // Get average availability percentage for a date
  const getDateAveragePercentage = (date: string): number => {
    const dateData = heatmapData.find((item) => item.date === date);
    if (!dateData || dateData.hour_blocks.length === 0) {
      return 0;
    }
    const total = dateData.hour_blocks.reduce((sum, h) => sum + h.percentage, 0);
    return Math.round(total / dateData.hour_blocks.length);
  };

  // Build marked dates for calendar
  const buildMarkedDates = () => {
    const marked: Record<string, any> = {};
    const { start, end } = getDateRange();

    // Initialize all dates in range
    const startDate = new Date(start);
    const endDate = new Date(end);
    const currentDate = new Date(startDate);

    while (currentDate <= endDate) {
      const dateStr = currentDate.toISOString().split('T')[0];
      const avgPercentage = getDateAveragePercentage(dateStr);
      const color = getColorIntensity(avgPercentage);

      marked[dateStr] = {
        customStyles: {
          container: {
            backgroundColor: color === 'transparent' ? undefined : color,
            borderRadius: 8,
            opacity: color === 'transparent' ? 0.3 : 1,
          },
          text: {
            color: avgPercentage > 50 ? '#FFFFFF' : '#1F2937',
            fontWeight: '600',
          },
        },
        marked: avgPercentage > 0,
      };

      currentDate.setDate(currentDate.getDate() + 1);
    }

    // Mark selected date
    if (selectedDate) {
      marked[selectedDate] = {
        ...marked[selectedDate],
        selected: true,
        selectedColor: '#3B82F6',
        customStyles: {
          ...marked[selectedDate]?.customStyles,
          container: {
            ...marked[selectedDate]?.customStyles?.container,
            borderWidth: 3,
            borderColor: '#3B82F6',
          },
        },
      };
    }

    return marked;
  };

  const handleDatePress = (day: DateData) => {
    if (!externalSelectedDate) {
      setInternalSelectedDate(day.dateString);
    }
    if (onDatePress) {
      onDatePress(day.dateString);
    }
    // Reset time selection when date changes
    setTimeSelectionStart(null);
    setPreviewEndHour(null);
  };

  const handleHourPress = (hour: number) => {
    if (!selectedDate || !onTimeSelect) return;

    if (timeSelectionStart === null) {
      // First click - set start time
      setTimeSelectionStart(hour);
      setPreviewEndHour(hour);
      onTimeSelect(selectedDate, hour, hour);
    } else {
      // Second click - set end time and complete selection
      const start = Math.min(timeSelectionStart, hour);
      const end = Math.max(timeSelectionStart, hour);
      onTimeSelect(selectedDate, start, end);
      setTimeSelectionStart(null);
      setPreviewEndHour(null);
    }
  };

  const handleHourPressIn = (hour: number) => {
    if (!selectedDate || !onTimeSelect || timeSelectionStart === null) return;
    // Update preview as user moves finger/hover
    setPreviewEndHour(hour);
  };

  const handleHourPressOut = () => {
    // Keep preview when user releases, they can tap again to confirm
  };

  const clearTimeSelection = () => {
    setTimeSelectionStart(null);
    setPreviewEndHour(null);
    if (onTimeClear) {
      onTimeClear();
    }
  };

  const isHourInSelectedRange = (hour: number): boolean => {
    if (!selectedDate || selectedStartHour === undefined || selectedEndHour === undefined) {
      return false;
    }
    const start = Math.min(selectedStartHour, selectedEndHour);
    const end = Math.max(selectedStartHour, selectedEndHour);
    return hour >= start && hour <= end;
  };

  const isHourInPreviewRange = (hour: number): boolean => {
    if (!selectedDate || timeSelectionStart === null || previewEndHour === null) {
      return false;
    }
    const start = Math.min(timeSelectionStart, previewEndHour);
    const end = Math.max(timeSelectionStart, previewEndHour);
    return hour >= start && hour <= end;
  };

  const isHourBeingSelected = (hour: number): boolean => {
    if (!selectedDate || timeSelectionStart === null) return false;
    return hour === timeSelectionStart;
  };

  // Get hour details for selected date
  const getSelectedDateHourDetails = () => {
    if (!selectedDate) return null;
    const dateData = heatmapData.find((item) => item.date === selectedDate);
    return dateData?.hour_blocks || [];
  };

  const formatHour = (hour: number): string => {
    if (hour === 0) return '12 AM';
    if (hour < 12) return `${hour} AM`;
    if (hour === 12) return '12 PM';
    return `${hour - 12} PM`;
  };

  if (loading) {
    return (
      <View className="items-center justify-center rounded-xl bg-white p-8 shadow-sm">
        <ActivityIndicator size="large" color="#3B82F6" />
        <Text className="mt-4 text-sm text-gray-600">Loading availability heatmap...</Text>
      </View>
    );
  }

  const selectedHourDetails = getSelectedDateHourDetails();
  const { start, end } = getDateRange();

  return (
    <View className="rounded-xl bg-white p-4 shadow-sm">
      <View className="mb-4 flex-row items-center justify-between">
        <Text className="text-lg font-semibold text-gray-900">Availability Heatmap</Text>
        <View className="flex-row items-center">
          <View className="mr-2 h-3 w-3 rounded bg-emerald-500" />
          <Text className="text-xs text-gray-600">High</Text>
          <View className="mx-1 h-3 w-3 rounded bg-emerald-200" />
          <Text className="text-xs text-gray-600">Low</Text>
        </View>
      </View>

      <Calendar
        current={start}
        minDate={start}
        maxDate={end}
        onDayPress={handleDatePress}
        markedDates={buildMarkedDates()}
        theme={{
          todayTextColor: '#3B82F6',
          arrowColor: '#3B82F6',
          monthTextColor: '#1F2937',
          textDayFontWeight: '500',
          textMonthFontWeight: 'bold',
          selectedDayBackgroundColor: '#3B82F6',
        }}
        markingType="custom"
      />

      {/* Selected Date Details */}
      {selectedDate && selectedHourDetails && selectedHourDetails.length > 0 && showHourDetails && (
        <View className="mt-4 rounded-lg border border-gray-200 bg-gray-50 p-4">
          <View className="mb-3 flex-row items-center justify-between">
            <Text className="text-sm font-semibold text-gray-900">
              {new Date(selectedDate).toLocaleDateString('en-US', {
                weekday: 'long',
                month: 'long',
                day: 'numeric',
              })}
            </Text>
            {onTimeSelect && (timeSelectionStart !== null || (selectedStartHour !== undefined && selectedEndHour !== undefined)) && (
              <TouchableOpacity
                onPress={clearTimeSelection}
                className="rounded-lg px-3 py-1.5"
                style={{ backgroundColor: '#FEE2E2' }}
              >
                <Text className="text-xs font-medium" style={{ color: '#DC2626' }}>
                  Clear
                </Text>
              </TouchableOpacity>
            )}
          </View>
          {onTimeSelect && (
            <Text className="mb-3 text-xs text-gray-500">
              {timeSelectionStart !== null
                ? `Tap another hour to set end time (${formatHour(timeSelectionStart)} - ${previewEndHour !== null ? formatHour(previewEndHour) : '...'})`
                : selectedStartHour !== undefined && selectedEndHour !== undefined
                  ? `Selected: ${formatHour(selectedStartHour)} - ${formatHour(selectedEndHour)}`
                  : 'Tap an hour to start selecting time range'}
            </Text>
          )}
          <View className="flex-row flex-wrap">
            {selectedHourDetails
              .sort((a, b) => a.hour_block - b.hour_block)
              .map((hour) => {
                const color = getColorIntensity(hour.percentage);
                const isSelected = isHourInSelectedRange(hour.hour_block);
                const isSelecting = isHourBeingSelected(hour.hour_block);
                const isPreview = isHourInPreviewRange(hour.hour_block) && !isSelected;

                return (
                  <TouchableOpacity
                    key={hour.hour_block}
                    onPress={() => onTimeSelect && handleHourPress(hour.hour_block)}
                    onPressIn={() => onTimeSelect && handleHourPressIn(hour.hour_block)}
                    onPressOut={handleHourPressOut}
                    disabled={!onTimeSelect}
                    className={`mb-2 mr-2 rounded-lg border-2 p-2 ${
                      isSelected
                        ? 'border-blue-600 bg-blue-600'
                        : isSelecting
                          ? 'border-blue-500 bg-blue-500'
                          : isPreview
                            ? 'border-blue-400 bg-blue-200'
                            : 'border-gray-300 bg-white'
                    }`}
                    style={{
                      backgroundColor: isSelected
                        ? '#2563EB' // blue-600
                        : isSelecting
                          ? '#3B82F6' // blue-500
                          : isPreview
                            ? '#BFDBFE' // blue-200 (more visible preview)
                            : color === 'transparent' ? '#F9FAFB' : color,
                    }}
                  >
                    <Text
                      className="text-xs font-semibold"
                      style={{
                        color: isSelected || isSelecting
                          ? '#FFFFFF'
                          : hour.percentage > 50 && !isPreview && !isSelected
                            ? '#FFFFFF'
                            : '#1F2937',
                      }}
                    >
                      {formatHour(hour.hour_block)}
                    </Text>
                    <Text
                      className="text-xs"
                      style={{
                        color: isSelected || isSelecting
                          ? '#FFFFFF'
                          : hour.percentage > 50 && !isPreview && !isSelected
                            ? '#FFFFFF'
                            : '#6B7280',
                      }}
                    >
                      {hour.available_count}/{hour.total_members}
                    </Text>
                  </TouchableOpacity>
                );
              })}
          </View>
        </View>
      )}

      {/* Legend */}
      <View className="mt-4 rounded-lg bg-blue-50 p-3">
        <View className="flex-row items-center">
          <MaterialIcons name="info" size={16} color="#3B82F6" />
          <Text className="ml-2 flex-1 text-xs text-blue-900">
            Darker colors indicate more members are available. Tap a date to see hour-by-hour
            details.
          </Text>
        </View>
      </View>
    </View>
  );
}

