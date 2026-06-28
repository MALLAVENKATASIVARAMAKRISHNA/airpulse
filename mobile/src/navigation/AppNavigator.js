import React from 'react'
import { TouchableOpacity, View, Text, StyleSheet } from 'react-native'
import { createNativeStackNavigator } from '@react-navigation/native-stack'
import { createBottomTabNavigator }   from '@react-navigation/bottom-tabs'
import { Ionicons } from '@expo/vector-icons'

import HomeScreen            from '../screens/HomeScreen'
import PollutantsScreen     from '../screens/PollutantsScreen'
import TrendScreen          from '../screens/TrendScreen'
import HotspotScreen        from '../screens/HotspotScreen'
import RecommendationsScreen from '../screens/RecommendationsScreen'
import SourceAnalysisScreen  from '../screens/SourceAnalysisScreen'
import ProfileScreen        from '../screens/ProfileScreen'

const Stack = createNativeStackNavigator()
const Tab   = createBottomTabNavigator()

function ProfileButton({ navigation }) {
  return (
    <TouchableOpacity
      style={styles.profileBtn}
      onPress={() => navigation.navigate('Profile')}
      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
    >
      <Ionicons name="person-circle" size={30} color="#00897B" />
    </TouchableOpacity>
  )
}

function Tabs() {
  return (
    <Tab.Navigator
      screenOptions={({ navigation }) => ({
        headerStyle:          { backgroundColor: '#fff' },
        headerTitleStyle:     { fontSize: 18, fontWeight: '800', color: '#212121' },
        headerShadowVisible:  false,
        headerRight: () => <ProfileButton navigation={navigation} />,
        tabBarActiveTintColor:   '#00897B',
        tabBarInactiveTintColor: '#9E9E9E',
        tabBarStyle:             { borderTopWidth: 1, borderTopColor: '#F0F0F0', paddingBottom: 4, height: 58 },
        tabBarLabelStyle:        { fontSize: 11, fontWeight: '600', marginBottom: 2 },
      })}
    >
      <Tab.Screen
        name="Home"
        component={HomeScreen}
        options={{
          title: 'AirPulse',
          tabBarLabel: 'Home',
          tabBarIcon: ({ color, size }) => <Ionicons name="home" size={size} color={color} />,
        }}
      />

      <Tab.Screen
        name="Pollutants"
        component={PollutantsScreen}
        options={{
          title: 'Pollutants',
          tabBarLabel: 'Pollutants',
          tabBarIcon: ({ color, size }) => <Ionicons name="flask" size={size} color={color} />,
        }}
      />

      <Tab.Screen
        name="Trend"
        component={TrendScreen}
        options={{
          title: 'AQI Trend',
          tabBarLabel: 'Trend',
          tabBarIcon: ({ color, size }) => <Ionicons name="trending-up" size={size} color={color} />,
        }}
      />

      <Tab.Screen
        name="Hotspot"
        component={HotspotScreen}
        options={{
          title: 'Hotspots',
          tabBarLabel: 'Hotspot',
          tabBarIcon: ({ color, size }) => <Ionicons name="location" size={size} color={color} />,
        }}
      />

      <Tab.Screen
        name="Recommendations"
        component={RecommendationsScreen}
        options={{
          title: 'Recommendations',
          tabBarLabel: 'Tips',
          tabBarIcon: ({ color, size }) => <Ionicons name="shield-checkmark" size={size} color={color} />,
        }}
      />

      <Tab.Screen
        name="Sources"
        component={SourceAnalysisScreen}
        options={{
          title: 'Source Analysis',
          tabBarLabel: 'Sources',
          tabBarIcon: ({ color, size }) => <Ionicons name="analytics" size={size} color={color} />,
        }}
      />
    </Tab.Navigator>
  )
}

export default function AppNavigator({ onLogout }) {
  return (
    <Stack.Navigator>
      <Stack.Screen name="Tabs" component={Tabs} options={{ headerShown: false }} />

      <Stack.Screen
        name="Profile"
        component={ProfileScreen}
        initialParams={{ onLogout }}
        options={{
          title: 'Profile',
          headerStyle:          { backgroundColor: '#fff' },
          headerTitleStyle:     { fontSize: 18, fontWeight: '800', color: '#212121' },
          headerShadowVisible:  false,
          headerTintColor:      '#00897B',
        }}
      />
    </Stack.Navigator>
  )
}

const styles = StyleSheet.create({
  profileBtn: { marginRight: 12 },
})
