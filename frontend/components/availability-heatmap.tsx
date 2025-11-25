import { useMemo } from 'react';
import { View, Text, ScrollView } from 'react-native';

interface HeatmapSlot {
  startTime: string;
  endTime: string;
  availableCount: number;
  totalMembers: number;
  intensity: number;
}

interface AvailabilityHeatmapProps {
  slots: HeatmapSlot[];
  totalMembers: number;
  totalWithAvailability: number;
}

/**
 * Heatmap visualization showing group availability across time slots
 * Intensity = how many group members are available at that time (0-1 scale)
 * Green = high availability, Red = low availability
 */
export function AvailabilityHeatmap({
  slots,
  totalMembers,
  totalWithAvailability,
}: AvailabilityHeatmapProps) {
  // Group slots by day and hour for better visualization
  const groupedByDay = useMemo(() => {
    const groups: { [key: string]: HeatmapSlot[] } = {};

    slots.forEach((slot) => {
      const date = new Date(slot.startTime);
      const dayKey = date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
      });

      if (!groups[dayKey]) {
        groups[dayKey] = [];
      }
      groups[dayKey].push(slot);
    });

    return groups;
  }, [slots]);

  const getIntensityColor = (intensity: number) => {
    // Red (low) -> Yellow (medium) -> Green (high)
    if (intensity === 0) return '#EF4444'; // Red
    if (intensity < 0.25) return '#FCA5A5'; // Light red
    if (intensity < 0.5) return '#FCD34D'; // Yellow
    if (intensity < 0.75) return '#BBF7D0'; // Light green
    return '#22C55E'; // Green
  };

  const getIntensityLabel = (intensity: number, count: number) => {
    if (count === 0) return 'None';
    if (intensity < 0.25) return 'Low';
    if (intensity < 0.5) return 'Medium';
    if (intensity < 0.75) return 'High';
    return 'Very High';
  };

  if (slots.length === 0) {
    return (
      <View className="rounded-xl bg-white p-6 shadow-sm">
        <Text className="text-center text-gray-600">
          No availability data yet. Members need to share their availability.
        </Text>
      </View>
    );
  }

  return (
    <View className="rounded-xl bg-white p-4 shadow-sm">
      {/* Header */}
      <View className="mb-4">
        <Text className="text-lg font-bold text-gray-900">Group Availability Heatmap</Text>
        <Text className="mt-1 text-sm text-gray-600">
          {totalWithAvailability} of {totalMembers} members shared availability
        </Text>
      </View>

      {/* Legend */}
      <View className="mb-4 flex-row items-center rounded-lg bg-gray-50 p-3">
        <View className="flex-row flex-1 flex-wrap">
          <View className="mb-2 mr-3 flex-row items-center">
            <View className="mr-1 h-4 w-4 rounded bg-red-500" />
            <Text className="text-xs text-gray-700">None</Text>
          </View>
          <View className="mb-2 mr-3 flex-row items-center">
            <View className="mr-1 h-4 w-4 rounded bg-yellow-400" />
            <Text className="text-xs text-gray-700">Medium</Text>
          </View>
          <View className="mb-2 mr-3 flex-row items-center">
            <View className="mr-1 h-4 w-4 rounded bg-green-500" />
            <Text className="text-xs text-gray-700">High</Text>
          </View>
        </View>
      </View>

      {/* Days and slots */}
      <ScrollView showsVerticalScrollIndicator={false}>
        {Object.entries(groupedByDay).map(([dayKey, daySLots]) => (
          <View key={dayKey} className="mb-4">
            <Text className="mb-2 font-semibold text-gray-900">{dayKey}</Text>

            {/* Hour grid for this day */}
            <View className="flex-wrap flex-row">
              {daySLots
                .sort(
                  (a, b) =>
                    new Date(a.startTime).getTime() - new Date(b.startTime).getTime(),
                )
                .map((slot, index) => {
                  const startDate = new Date(slot.startTime);
                  const hour = startDate.getHours();
                  const timeStr = `${String(hour).padStart(2, '0')}:00`;
                  const bgColor = getIntensityColor(slot.intensity);
                  const label = getIntensityLabel(slot.intensity, slot.availableCount);

                  return (
                    <View
                      key={index}
                      className="mb-2 mr-2 w-1/4 overflow-hidden rounded-lg"
                    >
                      <View
                        style={{ backgroundColor: bgColor }}
                        className="items-center py-2"
                      >
                        <Text className="text-xs font-semibold text-white">{timeStr}</Text>
                        <Text className="text-xs text-white">
                          {slot.availableCount}/{slot.totalMembers}
                        </Text>
                        <Text className="text-xs font-bold text-white">{label}</Text>
                      </View>
                    </View>
                  );
                })}
            </View>
          </View>
        ))}
      </ScrollView>

      {/* Best time */}
      {slots.length > 0 && (
        <View className="mt-4 border-t border-gray-200 pt-4">
          {(() => {
            const bestSlot = slots.reduce((prev, current) =>
              prev.intensity > current.intensity ? prev : current,
            );
            const bestDate = new Date(bestSlot.startTime);
            const bestTimeStr = bestDate.toLocaleString('en-US', {
              month: 'short',
              day: 'numeric',
              hour: '2-digit',
              minute: '2-digit',
            });

            return (
              <View>
                <Text className="text-sm font-semibold text-gray-900">
                  Best time for the group
                </Text>
                <View className="mt-2 flex-row items-center rounded-lg bg-green-50 p-3">
                  <View
                    className="mr-3 h-6 w-6 rounded"
                    style={{ backgroundColor: getIntensityColor(bestSlot.intensity) }}
                  />
                  <View>
                    <Text className="font-semibold text-green-900">{bestTimeStr}</Text>
                    <Text className="text-sm text-green-700">
                      {bestSlot.availableCount} members available
                    </Text>
                  </View>
                </View>
              </View>
            );
          })()}
        </View>
      )}
    </View>
  );
}
