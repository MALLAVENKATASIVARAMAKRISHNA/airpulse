import React from 'react'
import { TouchableOpacity, View, Text, StyleSheet } from 'react-native'
import Svg, { Defs, LinearGradient, Stop, Circle, Path } from 'react-native-svg'
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

function HeaderLogo() {
  return (
    <View style={styles.logoWrap}>
      <Svg width={30} height={30} viewBox="0 0 100 100">
        <Defs>
          <LinearGradient id="hgrad" x1="0" y1="0" x2="1" y2="0">
            <Stop offset="0" stopColor="#006aff" />
            <Stop offset="1" stopColor="#10d343" />
          </LinearGradient>
        </Defs>
        <Circle cx="50" cy="50" r="48" fill="url(#hgrad)" />
        <Path
          d="M 10 50 L 28 50 L 36 62 L 46 18 L 56 82 L 66 38 L 74 50 L 90 50"
          stroke="white" strokeWidth="7" strokeLinecap="round"
          strokeLinejoin="round" fill="none"
        />
      </Svg>
      <View style={styles.logoTextWrap}>
        <Text style={styles.logoName}>
          air<Text style={styles.logoAccent}>pulse</Text>
        </Text>
        <Text style={styles.logoSub}>AI MONITOR</Text>
      </View>
    </View>
  )
}

function ProfileButton({ navigation }) {
  return (
    <TouchableOpacity
      style={styles.profileBtn}
      onPress={() => navigation.navigate('Profile')}
      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
    >
      <Ionicons name="person-circle" size={30} color="rgba(255,255,255,0.7)" />
    </TouchableOpacity>
  )
}

const HEADER_OPTS = {
  headerStyle:         { backgroundColor: '#0c1120' },
  headerTitleStyle:    { fontSize: 17, fontWeight: '700', color: '#ffffff' },
  headerShadowVisible: false,
}

function Tabs() {
  return (
    <Tab.Navigator
      screenOptions={({ navigation }) => ({
        ...HEADER_OPTS,
        headerRight: () => <ProfileButton navigation={navigation} />,
        tabBarActiveTintColor:   '#006aff',
        tabBarInactiveTintColor: 'rgba(255,255,255,0.35)',
        tabBarStyle:             { backgroundColor: '#0c1120', borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.08)', paddingBottom: 4, height: 58 },
        tabBarLabelStyle:        { fontSize: 11, fontWeight: '600', marginBottom: 2 },
      })}
    >
      <Tab.Screen
        name="Home"
        component={HomeScreen}
        options={{
          headerTitle: () => <HeaderLogo />,
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
          ...HEADER_OPTS,
          headerTintColor: '#006aff',
        }}
      />
    </Stack.Navigator>
  )
}

const styles = StyleSheet.create({
  logoWrap:     { flexDirection: 'row', alignItems: 'center', gap: 10 },
  logoTextWrap: { justifyContent: 'center' },
  logoName:     { fontSize: 17, fontWeight: '900', color: '#ffffff', letterSpacing: -0.3 },
  logoAccent:   { color: '#006aff' },
  logoSub:      { fontSize: 8, color: 'rgba(255,255,255,0.35)', letterSpacing: 1.5 },
  profileBtn:   { marginRight: 12 },
})
