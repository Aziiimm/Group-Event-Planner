import { useEffect, useState } from 'react';

import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams, useRouter } from 'expo-router';

import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAuth } from '@/hooks/use-auth';
import { circlesApi } from '@/lib/api';

interface CircleMember {
  id: string;
  role: 'owner' | 'admin' | 'member';
  joined_at: string;
  user: {
    id: string;
    display_name: string;
    first_name: string | null;
    last_name: string | null;
    email: string;
  };
}

interface Circle {
  id: string;
  name: string;
  description: string | null;
  owner_id: string;
  created_at: string;
  memberCount: number;
  userRole: 'owner' | 'admin' | 'member' | null;
  hasPendingInvitation?: boolean;
}

interface SearchUser {
  id: string;
  display_name: string;
  first_name: string | null;
  last_name: string | null;
  email: string;
}

interface PendingInvitation {
  id: string;
  created_at: string;
  invitee: {
    id: string;
    display_name: string;
    first_name: string | null;
    last_name: string | null;
    email: string;
  };
  inviter: {
    id: string;
    display_name: string;
    first_name: string | null;
    last_name: string | null;
  };
}

export default function CircleDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();

  const [circle, setCircle] = useState<Circle | null>(null);
  const [members, setMembers] = useState<CircleMember[]>([]);
  const [pendingInvitations, setPendingInvitations] = useState<PendingInvitation[]>([]);
  const [loading, setLoading] = useState(true);
  const [inviteModalVisible, setInviteModalVisible] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchUser[]>([]);
  const [searching, setSearching] = useState(false);
  const [inviting, setInviting] = useState<string | null>(null);
  const [respondingToInvitation, setRespondingToInvitation] = useState(false);

  useEffect(() => {
    if (id) {
      fetchCircleData();
    }
  }, [id]);

  const fetchCircleData = async () => {
    if (!id) return;

    try {
      setLoading(true);
      const circleData = await circlesApi.getCircle(id);
      setCircle(circleData);

      // Try to fetch members and pending invitations, but don't fail if user only has pending invitation
      try {
        const membersData = await circlesApi.getCircleMembers(id);
        setMembers(membersData || []);
      } catch (err: any) {
        // If user has pending invitation, they might not be able to see members yet
        if (circleData.hasPendingInvitation) {
          setMembers([]);
        } else {
          throw err;
        }
      }

      try {
        const pendingData = await circlesApi.getCirclePendingInvitations(id);
        setPendingInvitations(pendingData || []);
      } catch (err: any) {
        // If user has pending invitation, they might not be able to see other pending invitations
        if (circleData.hasPendingInvitation) {
          setPendingInvitations([]);
        } else {
          // Silently fail for pending invitations list
          setPendingInvitations([]);
        }
      }
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to load circle data');
      router.back();
    } finally {
      setLoading(false);
    }
  };

  const handleRespondToInvitation = async (response: 'accept' | 'decline') => {
    if (!id || !user?.id) return;

    try {
      setRespondingToInvitation(true);
      // Get the user's pending invitation for this circle
      const userInvitations = await circlesApi.getPendingInvitations();
      const userInvitation = userInvitations.find(
        (inv: any) => inv.circle_id === id || inv.circle?.id === id,
      );

      if (!userInvitation) {
        Alert.alert('Error', 'Invitation not found');
        return;
      }

      await circlesApi.respondToInvitation(userInvitation.id, response);

      if (response === 'accept') {
        Alert.alert('Success', 'You have joined the circle!', [
          {
            text: 'OK',
            onPress: () => {
              // Refresh the page to show updated membership
              fetchCircleData();
            },
          },
        ]);
      } else {
        Alert.alert('Success', 'Invitation declined', [
          {
            text: 'OK',
            onPress: () => {
              router.back();
            },
          },
        ]);
      }
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to respond to invitation');
    } finally {
      setRespondingToInvitation(false);
    }
  };

  const handleSearchUsers = async (query: string) => {
    setSearchQuery(query);
    if (query.length < 2) {
      setSearchResults([]);
      return;
    }

    try {
      setSearching(true);
      const results = await circlesApi.searchUsers(query);
      // Filter out users who are already members
      const memberIds = new Set(members.map((m) => m.user.id));
      const filtered = results.filter((u: SearchUser) => !memberIds.has(u.id));
      setSearchResults(filtered);
    } catch (error: any) {
      console.error('Search error:', error);
      setSearchResults([]);
    } finally {
      setSearching(false);
    }
  };

  const handleInviteUser = async (inviteeId: string, displayName: string) => {
    if (!id) return;

    try {
      setInviting(inviteeId);
      await circlesApi.createInvitation(id, inviteeId);
      Alert.alert('Success', `Invitation sent to ${displayName}`);
      setInviteModalVisible(false);
      setSearchQuery('');
      setSearchResults([]);
      // Refresh pending invitations
      const pendingData = await circlesApi.getCirclePendingInvitations(id);
      setPendingInvitations(pendingData);
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to send invitation');
    } finally {
      setInviting(null);
    }
  };

  const getInitials = (firstName: string | null, lastName: string | null, displayName: string) => {
    if (firstName && lastName) {
      return `${firstName[0]}${lastName[0]}`.toUpperCase();
    }
    if (displayName) {
      return displayName
        .split(' ')
        .map((n) => n[0])
        .join('')
        .toUpperCase()
        .slice(0, 2);
    }
    return 'U';
  };

  const getDisplayName = (member: CircleMember) => {
    if (!member.user) return 'Unknown User';
    if (member.user.first_name && member.user.last_name) {
      return `${member.user.first_name} ${member.user.last_name}`;
    }
    return member.user.display_name || 'Unknown User';
  };

  const canInvite = circle?.userRole === 'owner' || circle?.userRole === 'admin';

  if (loading) {
    return (
      <View className="flex-1 items-center justify-center bg-gray-50">
        <ActivityIndicator size="large" color="#3B82F6" />
      </View>
    );
  }

  if (!circle) {
    return (
      <View className="flex-1 items-center justify-center bg-gray-50">
        <Text className="text-gray-600">Circle not found</Text>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-gray-50">
      {/* Header */}
      <View
        style={{ paddingTop: insets.top }}
        className="bg-blue-600 pb-6"
      >
        <View className="flex-row items-center px-6">
          <TouchableOpacity
            onPress={() => router.back()}
            className="mr-4 h-10 w-10 items-center justify-center rounded-full bg-white/20"
          >
            <MaterialIcons name="arrow-back" size={24} color="#FFFFFF" />
          </TouchableOpacity>
          <View className="flex-1">
            <Text className="text-2xl font-bold text-white">{circle.name}</Text>
            {circle.description && (
              <Text className="mt-1 text-sm text-white/90">{circle.description}</Text>
            )}
          </View>
        </View>
      </View>

      {/* Content */}
      <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
        {/* Pending Invitation Banner (for users with pending invitations) */}
        {circle?.hasPendingInvitation && (
          <View className="mx-6 mt-6 rounded-xl border-2 border-yellow-300 bg-yellow-50 p-4">
            <Text className="mb-3 text-base font-semibold text-gray-900">
              You have a pending invitation to join this circle
            </Text>
            <View className="flex-row space-x-3">
              <TouchableOpacity
                onPress={() => handleRespondToInvitation('accept')}
                disabled={respondingToInvitation}
                className="flex-1 flex-row items-center justify-center rounded-lg bg-green-600 py-3"
                style={{ opacity: respondingToInvitation ? 0.6 : 1 }}
              >
                {respondingToInvitation ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <>
                    <MaterialIcons name="check" size={20} color="#FFFFFF" />
                    <Text className="ml-2 text-base font-semibold text-white">Accept</Text>
                  </>
                )}
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => handleRespondToInvitation('decline')}
                disabled={respondingToInvitation}
                className="flex-1 flex-row items-center justify-center rounded-lg bg-red-600 py-3"
                style={{ opacity: respondingToInvitation ? 0.6 : 1 }}
              >
                <MaterialIcons name="close" size={20} color="#FFFFFF" />
                <Text className="ml-2 text-base font-semibold text-white">Decline</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Invite Button (for admins/owners) */}
        {canInvite && (
          <View className="px-6 pt-6">
            <TouchableOpacity
              onPress={() => setInviteModalVisible(true)}
              className="flex-row items-center justify-center rounded-xl bg-blue-600 py-3 shadow-sm"
            >
              <MaterialIcons name="person-add" size={20} color="#FFFFFF" />
              <Text className="ml-2 text-base font-semibold text-white">Invite Members</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Members Section */}
        <View className="px-6 pt-6">
          <Text className="mb-5 text-xl font-bold text-gray-900">Members ({members.length})</Text>

          {members.length === 0 && pendingInvitations.length === 0 ? (
            <View className="items-center py-8">
              <MaterialIcons name="people" size={48} color="#9CA3AF" />
              <Text className="mt-4 text-gray-600">No members yet</Text>
            </View>
          ) : (
            <View>
              {/* Active Members */}
              {members
                .filter((member) => member.user) // Filter out members with null user data
                .map((member, index) => (
                  <View
                    key={member.id}
                    className={`flex-row items-center rounded-xl bg-white p-5 shadow-sm ${
                      index < members.length - 1 || pendingInvitations.length > 0 ? 'mb-3' : ''
                    }`}
                  >
                    {/* Avatar */}
                    <LinearGradient
                      colors={['#60A5FA', '#A78BFA']}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                      className="h-12 w-12 items-center justify-center rounded-xl"
                    >
                      <Text className="text-base font-bold text-white">
                        {getInitials(
                          member.user?.first_name || null,
                          member.user?.last_name || null,
                          member.user?.display_name || 'U',
                        )}
                      </Text>
                    </LinearGradient>

                    {/* Member Info */}
                    <View className="ml-4 flex-1">
                      <View className="flex-row flex-wrap items-center">
                        <Text className="text-base font-semibold text-gray-900">
                          {getDisplayName(member)}
                        </Text>
                        {member.role === 'owner' && (
                          <View className="ml-2 rounded bg-blue-100 px-2.5 py-1">
                            <Text className="text-xs font-semibold text-blue-700">Owner</Text>
                          </View>
                        )}
                        {member.role === 'admin' && (
                          <View className="ml-2 rounded bg-purple-100 px-2.5 py-1">
                            <Text className="text-xs font-semibold text-purple-700">Admin</Text>
                          </View>
                        )}
                      </View>
                      <Text className="mt-1.5 text-sm text-gray-600">
                        {member.user?.email || 'No email'}
                      </Text>
                    </View>
                  </View>
                ))}

              {/* Pending Invitations */}
              {pendingInvitations.length > 0 && (
                <>
                  {members.length > 0 && <View className="my-4 border-t border-gray-200" />}
                  {pendingInvitations
                    .filter((invitation) => invitation.invitee) // Filter out null invitees
                    .map((invitation, index) => (
                      <View
                        key={invitation.id}
                        className={`flex-row items-center rounded-xl bg-white p-5 opacity-75 shadow-sm ${
                          index < pendingInvitations.length - 1 ? 'mb-3' : ''
                        }`}
                      >
                        {/* Avatar */}
                        <LinearGradient
                          colors={['#9CA3AF', '#6B7280']}
                          start={{ x: 0, y: 0 }}
                          end={{ x: 1, y: 1 }}
                          className="h-12 w-12 items-center justify-center rounded-xl"
                        >
                          <Text className="text-base font-bold text-white">
                            {getInitials(
                              invitation.invitee?.first_name || null,
                              invitation.invitee?.last_name || null,
                              invitation.invitee?.display_name || 'U',
                            )}
                          </Text>
                        </LinearGradient>

                        {/* Invitee Info */}
                        <View className="ml-4 flex-1">
                          <View className="flex-row flex-wrap items-center">
                            <Text className="text-base font-semibold text-gray-900">
                              {invitation.invitee?.first_name && invitation.invitee?.last_name
                                ? `${invitation.invitee.first_name} ${invitation.invitee.last_name}`
                                : invitation.invitee?.display_name || 'Unknown User'}
                            </Text>
                            <View className="ml-2 rounded bg-yellow-100 px-2.5 py-1">
                              <Text className="text-xs font-semibold text-yellow-700">Pending</Text>
                            </View>
                          </View>
                          <Text className="mt-1.5 text-sm text-gray-600">
                            {invitation.invitee?.email || 'No email'}
                          </Text>
                        </View>
                      </View>
                    ))}
                </>
              )}
            </View>
          )}
        </View>
      </ScrollView>

      {/* Invite Modal */}
      <Modal
        visible={inviteModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setInviteModalVisible(false)}
      >
        <View className="flex-1 items-center justify-end bg-black/50">
          <View
            className="w-full rounded-t-3xl bg-white p-6"
            style={{ paddingBottom: insets.bottom + 24 }}
          >
            <View className="mb-4 flex-row items-center justify-between">
              <Text className="text-2xl font-bold text-gray-900">Invite Members</Text>
              <TouchableOpacity onPress={() => setInviteModalVisible(false)}>
                <MaterialIcons name="close" size={24} color="#6B7280" />
              </TouchableOpacity>
            </View>

            {/* Search Input */}
            <TextInput
              value={searchQuery}
              onChangeText={handleSearchUsers}
              placeholder="Search by display name..."
              placeholderTextColor="#9CA3AF"
              className="mb-4 rounded-xl border border-gray-300 bg-gray-50 px-4 py-3 text-base text-gray-900"
              autoFocus
            />

            {/* Search Results */}
            {searching && (
              <View className="py-8">
                <ActivityIndicator size="small" color="#3B82F6" />
              </View>
            )}

            {!searching && searchQuery.length >= 2 && searchResults.length === 0 && (
              <View className="py-8">
                <Text className="text-center text-gray-500">No users found</Text>
              </View>
            )}

            {!searching && searchResults.length > 0 && (
              <FlatList
                data={searchResults}
                keyExtractor={(item) => item.id}
                renderItem={({ item }) => (
                  <TouchableOpacity
                    onPress={() => handleInviteUser(item.id, item.display_name)}
                    disabled={inviting === item.id}
                    className="mb-3 flex-row items-center rounded-xl border border-gray-200 bg-white p-4"
                    style={{ opacity: inviting === item.id ? 0.6 : 1 }}
                  >
                    <LinearGradient
                      colors={['#60A5FA', '#A78BFA']}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                      className="h-10 w-10 items-center justify-center rounded-xl"
                    >
                      <Text className="text-sm font-bold text-white">
                        {getInitials(item.first_name, item.last_name, item.display_name)}
                      </Text>
                    </LinearGradient>
                    <View className="ml-3 flex-1">
                      <Text className="text-base font-semibold text-gray-900">
                        {item.first_name && item.last_name
                          ? `${item.first_name} ${item.last_name}`
                          : item.display_name}
                      </Text>
                      <Text className="text-sm text-gray-600">{item.display_name}</Text>
                    </View>
                    {inviting === item.id ? (
                      <ActivityIndicator size="small" color="#3B82F6" />
                    ) : (
                      <MaterialIcons name="add-circle" size={24} color="#3B82F6" />
                    )}
                  </TouchableOpacity>
                )}
                className="max-h-96"
              />
            )}

            {searchQuery.length < 2 && (
              <View className="py-8">
                <Text className="text-center text-gray-500">
                  Type at least 2 characters to search
                </Text>
              </View>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}
