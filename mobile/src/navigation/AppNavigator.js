import React from 'react'
import { TouchableOpacity, View, Text, StyleSheet } from 'react-native'
import Svg, { Defs, LinearGradient, Stop, Circle, Path } from 'react-native-svg'
import { createNativeStackNavigator } from '@react-navigation/native-stack'
import { createBottomTabNavigator }   from '@react-navigation/bottom-tabs'
import { Ionicons } from '@expo/vector-icons'

import HomeScreen             from '../screens/HomeScreen'
import PollutantsScreen       from '../screens/PollutantsScreen'
import TrendScreen            from '../screens/TrendScreen'
import HotspotScreen          from '../screens/HotspotScreen'
import RecommendationsScreen  from '../screens/RecommendationsScreen'
import SourceAnalysisScreen   from '../screens/SourceAnalysisScreen'
import ProfileScreen          from '../screens/ProfileScreen'
import ForecastScreen         from '../screens/ForecastScreen'
import HealthAssessmentScreen from '../screens/HealthAssessmentScreen'
import AlertCenterScreen      from '../screens/AlertCenterScreen'

const Stack = createNativeStackNavigator()
const Tab   = createBottomTabNavigator()

const ACTIVE   = '#3DD9AC'
const INACTIVE = 'rgba(255,255,255,0.30)'
const TAB_BG   = '#0f0f0f'
const HDR_BG   = '#0a0a0a'

function HeaderLogo() {
  return (
    <View style={s.logoWrap}>
      <Svg width={28} height={28} viewBox="0 0 100 100">
        <Defs>
          <LinearGradient id="lg" x1="0" y1="0" x2="1" y2="0">
            <Stop offset="0" stopColor="#3DD9AC" />
            <Stop offset="1" stopColor="#60A5FA" />
          </LinearGradient>
        </Defs>
        <Circle cx="50" cy="50" r="48" fill="url(#lg)" />
        <Path
          d="M 10 50 L 28 50 L 36 62 L 46 18 L 56 82 L 66 38 L 74 50 L 90 50"
          stroke="white" strokeWidth="7" strokeLinecap="round" strokeLinejoin="round" fill="none"
        />
      </Svg>
      <View style={s.logoTextWrap}>
        <Text style={s.logoName}>air<Text style={s.logoAccent}>pulse</Text></Text>
        <Text style={s.logoSub}>AI MONITOR</Text>
      </View>
    </View>
  )
}

function ProfileButton({ navigation }) {
  return (
    <TouchableOpacity
      style={s.profileBtn}
      onPress={() => navigation.navigate('Profile')}
      hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
    >
      <View style={s.profileCircle}>
        <Ionicons name="person" size={16} color={ACTIVE} />
      </View>
    </TouchableOpacity>
  )
}

const HEADER_OPTS = {
  headerStyle:         { backgroundColor: HDR_BG },
  headerTitleStyle:    { fontSize: 17, fontWeight: '700', color: '#ffffff' },
  headerShadowVisible: false,
  headerBorderBottomColor: 'transparent',
}

function Tabs() {
  return (
    <Tab.Navigator
      screenOptions={({ navigation }) => ({
        ...HEADER_OPTS,
        headerRight: () => <ProfileButton navigation={navigation} />,
        tabBarActiveTintColor:   ACTIVE,
        tabBarInactiveTintColor: INACTIVE,
        tabBarStyle: {
          backgroundColor: TAB_BG,
          borderTopWidth: 0,
          paddingBottom: 8,
          paddingTop: 6,
          height: 64,
          elevation: 0,
        },
        tabBarLabelStyle:  { fontSize: 10, fontWeight: '700', letterSpacing: 0.3 },
        tabBarItemStyle:   { paddingTop: 2 },
      })}
    >
      <Tab.Screen
        name="Home"
        component={HomeScreen}
        options={{
          headerTitle: () => <HeaderLogo />,
          tabBarLabel: 'Home',
          tabBarIcon: ({ color, size }) => <Ionicons name="home-outline" size={size} color={color} />,
        }}
      />
      <Tab.Screen
        name="Pollutants"
        component={PollutantsScreen}
        options={{
          title: 'Pollutants',
          tabBarLabel: 'Pollutants',
          tabBarIcon: ({ color, size }) => <Ionicons name="flask-outline" size={size} color={color} />,
        }}
      />
      <Tab.Screen
        name="Trend"
        component={TrendScreen}
        options={{
          title: 'AQI Trend',
          tabBarLabel: 'Trend',
          tabBarIcon: ({ color, size }) => <Ionicons name="trending-up-outline" size={size} color={color} />,
        }}
      />
      <Tab.Screen
        name="Hotspot"
        component={HotspotScreen}
        options={{
          title: 'Hotspots',
          tabBarLabel: 'Hotspot',
          tabBarIcon: ({ color, size }) => <Ionicons name="location-outline" size={size} color={color} />,
        }}
      />
      <Tab.Screen
        name="Recommendations"
        component={RecommendationsScreen}
        options={{
          title: 'Recommendations',
          tabBarLabel: 'Tips',
          tabBarIcon: ({ color, size }) => <Ionicons name="shield-checkmark-outline" size={size} color={color} />,
        }}
      />
      <Tab.Screen
        name="Sources"
        component={SourceAnalysisScreen}
        options={{
          title: 'Source Analysis',
          tabBarLabel: 'Sources',
          tabBarIcon: ({ color, size }) => <Ionicons name="analytics-outline" size={size} color={color} />,
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
        options={{ title: 'Profile', ...HEADER_OPTS, headerTintColor: ACTIVE }}
      />
      <Stack.Screen
        name="Forecast"
        component={ForecastScreen}
        options={{ title: 'AQI Forecast', ...HEADER_OPTS, headerTintColor: ACTIVE }}
      />
      <Stack.Screen
        name="HealthAssessment"
        component={HealthAssessmentScreen}
        options={{ title: 'Health Assessment', ...HEADER_OPTS, headerTintColor: ACTIVE }}
      />
      <Stack.Screen
        name="AlertCenter"
        component={AlertCenterScreen}
        options={{ title: 'Alert Center', ...HEADER_OPTS, headerTintColor: ACTIVE }}
      />
    </Stack.Navigator>
  )
}

const s = StyleSheet.create({
  logoWrap:     { flexDirection: 'row', alignItems: 'center', gap: 10 },
  logoTextWrap: { justifyContent: 'center' },
  logoName:     { fontSize: 17, fontWeight: '900', color: '#ffffff', letterSpacing: -0.3 },
  logoAccent:   { color: '#3DD9AC' },
  logoSub:      { fontSize: 8, color: 'rgba(255,255,255,0.30)', letterSpacing: 1.5 },
  profileBtn:   { marginRight: 14 },
  profileCircle:{ width: 34, height: 34, borderRadius: 17, backgroundColor: 'rgba(61,217,172,0.15)', alignItems: 'center', justifyContent: 'center' },
})
